/// <reference lib="webworker" />

import type {
  ProcessImageMessage,
  EncodeMessage,
  WorkerMessage,
  ProcessResult,
  InitResult,
  OutputFormat,
  BufferCache,
  RgbaCache,
} from '../types/worker.types';

// ============================================================================
// Shader WGSL - Brightness y Contrast
// ============================================================================

const IMAGE_PROCESSING_SHADER = /* wgsl */ `
struct Params {
  width: u32,
  height: u32,
  brightness: f32,
  contrast: f32,
}

@group(0) @binding(0) var<storage, read> inputPixels: array<u32>;
@group(0) @binding(1) var<storage, read_write> outputPixels: array<u32>;
@group(0) @binding(2) var<uniform> params: Params;

fn unpackRGBA(packed: u32) -> vec4<f32> {
  return vec4<f32>(
    f32(packed & 0xFFu) / 255.0,
    f32((packed >> 8u) & 0xFFu) / 255.0,
    f32((packed >> 16u) & 0xFFu) / 255.0,
    f32((packed >> 24u) & 0xFFu) / 255.0
  );
}

fn packRGBA(color: vec4<f32>) -> u32 {
  let c = clamp(color, vec4<f32>(0.0), vec4<f32>(1.0));
  return u32(c.r * 255.0) |
         (u32(c.g * 255.0) << 8u) |
         (u32(c.b * 255.0) << 16u) |
         (u32(c.a * 255.0) << 24u);
}

fn contrastCurve(x: f32, contrast: f32) -> f32 {
  return (x - 0.5) * contrast + 0.5;
}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let x = global_id.x;
  let y = global_id.y;

  if (x >= params.width || y >= params.height) {
    return;
  }

  let index = y * params.width + x;
  let pixel = unpackRGBA(inputPixels[index]);

  var color = pixel.rgb;

  // 1. Brillo (aditivo)
  color = color + vec3<f32>(params.brightness);

  // 2. Contraste (centrado en 0.5)
  color = vec3<f32>(
    contrastCurve(color.r, params.contrast),
    contrastCurve(color.g, params.contrast),
    contrastCurve(color.b, params.contrast)
  );

  // Clamp final y preservar alpha original
  let result = vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), pixel.a);
  outputPixels[index] = packRGBA(result);
}
`;

// ============================================================================
// Estado Global
// ============================================================================

let device: GPUDevice | null = null;
let adapter: GPUAdapter | null = null;
let pipeline: GPUComputePipeline | null = null;
let isDeviceLost = false;

let bufferCache: BufferCache | null = null;
let paramsBuffer: GPUBuffer | null = null;
let currentRequestId = 0;
let processingLock: Promise<void> = Promise.resolve();

// Cache del último resultado RGBA para re-encoding sin GPU
let rgbaCache: RgbaCache | null = null;

// ============================================================================
// Inicialización WebGPU
// ============================================================================

async function initializeWebGPU(): Promise<InitResult> {
  try {
    if (!navigator.gpu) {
      return { type: 'init-complete', supported: false };
    }

    adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      return { type: 'init-complete', supported: false };
    }

    device = await adapter.requestDevice({
      requiredLimits: {
        maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        maxBufferSize: adapter.limits.maxBufferSize,
      },
    });

    isDeviceLost = false;

    device.lost.then((info) => {
      isDeviceLost = true;
      cleanup();

      self.postMessage({
        type: 'error',
        message: `GPU device lost: ${info.message}. Please reload.`,
      });
    });

    pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: IMAGE_PROCESSING_SHADER }),
        entryPoint: 'main',
      },
    });

    paramsBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const adapterInfo = adapter.info;
    console.log('adapterInfo', adapterInfo);

    console.log('[WebGPU Worker] GPU Adapter Info:', {
      vendor: adapterInfo?.vendor,
      architecture: adapterInfo?.architecture,
      device: adapterInfo?.device,
      description: adapterInfo?.description,
    });

    // Para mostrar al usuario
    const displayName = getAdapterDisplayName(adapterInfo);

    console.log('displayName', displayName);

    // Para logs de debugging
    const fullDetails = getAdapterDetails(adapterInfo);
    console.log('[WebGPU Worker] GPU Adapter Details:', fullDetails);

    const info = adapterInfo
      ? adapterInfo.description ||
        adapterInfo.device ||
        `${adapterInfo.vendor} - ${adapterInfo.architecture}`
      : 'WebGPU Ready';

    console.log('info', info);

    return {
      type: 'init-complete',
      supported: true,
      adapterInfo: displayName, // Ej: "NVIDIA GeForce RTX 4050 Laptop GPU"
    };
  } catch (error) {
    console.error('[WebGPU Worker] Initialization failed:', error);
    return { type: 'init-complete', supported: false };
  }
}

function getAdapterDisplayName(adapterInfo: GPUAdapterInfo | null): string {
  if (!adapterInfo) return 'WebGPU Ready';

  // 1. Intentar description primero (nombre comercial completo)
  if (adapterInfo.description && adapterInfo.description.trim()) {
    return adapterInfo.description;
  }

  // 2. Construir con vendor + architecture + device si hay info
  const parts: string[] = [];

  if (adapterInfo.vendor) {
    // Capitalizar vendor para mejor lectura
    const vendorName = adapterInfo.vendor.charAt(0).toUpperCase() + adapterInfo.vendor.slice(1);
    parts.push(vendorName);
  }

  if (adapterInfo.architecture) {
    parts.push(adapterInfo.architecture.toUpperCase());
  }

  if (adapterInfo.device && adapterInfo.device !== '') {
    parts.push(`[${adapterInfo.device}]`);
  }

  if (parts.length > 0) {
    return parts.join(' ');
  }

  // 3. Fallback genérico
  return 'GPU Desconocida';
}

function getAdapterDetails(adapterInfo: GPUAdapterInfo | null): Record<string, string> {
  if (!adapterInfo) return {};

  const details: Record<string, string> = {};

  // Info estándar
  if (adapterInfo.vendor) details['Fabricante'] = adapterInfo.vendor;
  if (adapterInfo.architecture) details['Arquitectura'] = adapterInfo.architecture;
  if (adapterInfo.device) details['Device ID'] = adapterInfo.device;
  if (adapterInfo.description) details['Descripción'] = adapterInfo.description;

  // Info no estándar (solo en Chrome con developer features)
  const info = adapterInfo as any;
  if (info.type) details['Tipo'] = info.type;
  if (info.backend) details['Backend'] = info.backend;
  if (info.driver) details['Driver'] = info.driver;

  return details;
}

// ============================================================================
// Gestión de Buffers
// ============================================================================

function ensureBuffers(pixelCount: number): BufferCache {
  if (!device || !pipeline) throw new Error('Device no inicializado');

  const requiredSize = pixelCount * 4;

  if (bufferCache?.size === requiredSize) {
    return bufferCache;
  }

  if (bufferCache) {
    bufferCache.inputBuffer.destroy();
    bufferCache.outputBuffer.destroy();
    bufferCache.stagingBuffer.destroy();
    bufferCache.bindGroup = null;
  }

  const inputBuffer = device.createBuffer({
    size: requiredSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });

  const outputBuffer = device.createBuffer({
    size: requiredSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const stagingBuffer = device.createBuffer({
    size: requiredSize,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: inputBuffer } },
      { binding: 1, resource: { buffer: outputBuffer } },
      { binding: 2, resource: { buffer: paramsBuffer! } },
    ],
  });

  bufferCache = {
    size: requiredSize,
    inputBuffer,
    outputBuffer,
    stagingBuffer,
    bindGroup,
  };

  return bufferCache;
}

// ============================================================================
// Encoding con OffscreenCanvas (ejecuta en Worker, no bloquea main thread)
// ============================================================================

async function encodeImage(
  rgbaData: Uint8Array,
  width: number,
  height: number,
  format: OutputFormat,
  quality: number,
): Promise<{ buffer: ArrayBuffer; mimeType: string; timeMs: number }> {
  const tStart = performance.now();

  // Crear ImageData desde RGBA
  const imageData = new ImageData(
    new Uint8ClampedArray(rgbaData.buffer as ArrayBuffer, rgbaData.byteOffset, rgbaData.byteLength),
    width,
    height,
  );

  // Ajustar quality para evitar lossless bloat en 100%
  let finalQuality = quality;
  if (finalQuality >= 1) {
    finalQuality = 0.98;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo crear contexto 2D en OffscreenCanvas');

  ctx.putImageData(imageData, 0, 0);

  const blob = await canvas.convertToBlob({
    type: format,
    quality: finalQuality,
  });

  const buffer = await blob.arrayBuffer();
  const timeMs = performance.now() - tStart;

  return { buffer, mimeType: blob.type, timeMs };
}

// ============================================================================
// Procesamiento GPU + Encoding
// ============================================================================

async function processImage(message: ProcessImageMessage): Promise<ProcessResult | null> {
  const { imageBitmap, params, outputFormat, outputQuality, requestId } = message;

  if (isDeviceLost) {
    imageBitmap.close();
    throw new Error('GPU device lost - please reload');
  }

  if (requestId < currentRequestId) {
    imageBitmap.close();
    return null;
  }

  if (!device || !pipeline || !paramsBuffer) {
    imageBitmap.close();
    throw new Error('WebGPU no inicializado');
  }

  await processingLock;

  if (requestId < currentRequestId) {
    imageBitmap.close();
    return null;
  }

  if (isDeviceLost) {
    imageBitmap.close();
    throw new Error('GPU device lost - please reload');
  }

  let releaseLock: () => void;
  processingLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  const startTime = performance.now();
  const { width, height } = imageBitmap;
  const pixelCount = width * height;

  try {
    // Extraer píxeles
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear contexto 2D');

    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const inputData = new Uint8Array(imageData.data.buffer);

    // Buffers
    const buffers = ensureBuffers(pixelCount);

    if (isDeviceLost) {
      throw new Error('GPU device lost during buffer setup');
    }

    // Subir datos
    device.queue.writeBuffer(buffers.inputBuffer, 0, inputData);

    // Parámetros
    const brightness = params.brightness ?? 0;
    const contrast = params.contrast ?? 1;

    const paramsData = new ArrayBuffer(16);
    const view = new DataView(paramsData);
    view.setUint32(0, width, true);
    view.setUint32(4, height, true);
    view.setFloat32(8, brightness, true);
    view.setFloat32(12, contrast, true);
    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    // Ejecutar shader
    const workgroupsX = Math.ceil(width / 16);
    const workgroupsY = Math.ceil(height / 16);

    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, buffers.bindGroup!);
    computePass.dispatchWorkgroups(workgroupsX, workgroupsY);
    computePass.end();

    commandEncoder.copyBufferToBuffer(
      buffers.outputBuffer,
      0,
      buffers.stagingBuffer,
      0,
      pixelCount * 4,
    );

    device.queue.submit([commandEncoder.finish()]);

    if (requestId < currentRequestId) {
      imageBitmap.close();
      releaseLock!();
      return null;
    }

    if (isDeviceLost) {
      throw new Error('GPU device lost before readback');
    }

    // Leer resultado
    try {
      await buffers.stagingBuffer.mapAsync(GPUMapMode.READ);
    } catch (mapError) {
      if (isDeviceLost) {
        throw new Error('GPU device lost during mapAsync');
      }
      throw mapError;
    }

    const resultData = new Uint8Array(buffers.stagingBuffer.getMappedRange().slice(0));
    buffers.stagingBuffer.unmap();

    const gpuTimeMs = performance.now() - startTime;

    // Cachear resultado RGBA para re-encoding
    rgbaCache = { data: resultData, width, height };

    // Encoding con OffscreenCanvas
    const {
      buffer: encodedBuffer,
      mimeType,
      timeMs: encodingTimeMs,
    } = await encodeImage(resultData, width, height, outputFormat, outputQuality);

    imageBitmap.close();
    releaseLock!();

    return {
      type: 'result',
      blobData: encodedBuffer,
      blobType: mimeType,
      blobSize: encodedBuffer.byteLength,
      width,
      height,
      processingTimeMs: gpuTimeMs,
      encodingTimeMs,
      requestId,
    };
  } catch (error) {
    imageBitmap.close();
    releaseLock!();
    throw error;
  }
}

// ============================================================================
// Re-encoding (sin GPU, usa cache RGBA)
// ============================================================================

async function reEncode(message: EncodeMessage): Promise<ProcessResult | null> {
  const { outputFormat, outputQuality, requestId } = message;

  if (!rgbaCache) {
    throw new Error('No hay datos cacheados para re-encoding');
  }

  if (requestId < currentRequestId) {
    return null;
  }

  const { data, width, height } = rgbaCache;

  // Encoding con OffscreenCanvas
  const {
    buffer: encodedBuffer,
    mimeType,
    timeMs: encodingTimeMs,
  } = await encodeImage(data, width, height, outputFormat, outputQuality);

  return {
    type: 'result',
    blobData: encodedBuffer,
    blobType: mimeType,
    blobSize: encodedBuffer.byteLength,
    width,
    height,
    processingTimeMs: 0, // No GPU processing
    encodingTimeMs,
    requestId,
  };
}

function cleanup(): void {
  try {
    bufferCache?.inputBuffer.destroy();
    bufferCache?.outputBuffer.destroy();
    bufferCache?.stagingBuffer.destroy();
    paramsBuffer?.destroy();
    device?.destroy();
  } catch {
    // Ignorar errores durante cleanup de recursos GPU
  }

  bufferCache = null;
  paramsBuffer = null;
  pipeline = null;
  device = null;
  adapter = null;
  isDeviceLost = false;
  rgbaCache = null;
}

// ============================================================================
// Message Handler
// ============================================================================

globalThis.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'init': {
        const gpuResult = await initializeWebGPU();
        self.postMessage(gpuResult);
        break;
      }

      case 'process': {
        currentRequestId = message.requestId;
        const result = await processImage(message);
        if (result) {
          self.postMessage(result, [result.blobData]);
        }
        break;
      }

      case 'encode': {
        currentRequestId = message.requestId;
        const result = await reEncode(message);
        if (result) {
          self.postMessage(result, [result.blobData]);
        }
        break;
      }

      case 'cancel': {
        if (message.requestId > currentRequestId) {
          currentRequestId = message.requestId;
        }
        break;
      }

      case 'destroy': {
        cleanup();
        self.postMessage({ type: 'destroyed' });
        break;
      }
    }
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Error desconocido',
      requestId: 'requestId' in message ? message.requestId : undefined,
    });
  }
};
