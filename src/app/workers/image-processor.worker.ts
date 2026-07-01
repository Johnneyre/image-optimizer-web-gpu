/// <reference lib="webworker" />

import type {
  ProcessImageMessage,
  EncodeMessage,
  EncodeFileMessage,
  WorkerMessage,
  ProcessResult,
  InitResult,
  OutputFormat,
  BufferCache,
  RgbaCache,
} from '../types/worker.types';

// ============================================================================
// WGSL Shader - Brightness and Contrast
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

  // 1. Brightness (additive)
  color = color + vec3<f32>(params.brightness);

  // 2. Contrast (centered on 0.5)
  color = vec3<f32>(
    contrastCurve(color.r, params.contrast),
    contrastCurve(color.g, params.contrast),
    contrastCurve(color.b, params.contrast)
  );

  // Final clamp and preserve original alpha
  let result = vec4<f32>(clamp(color, vec3<f32>(0.0), vec3<f32>(1.0)), pixel.a);
  outputPixels[index] = packRGBA(result);
}
`;

// ============================================================================
// Global State
// ============================================================================

let device: GPUDevice | null = null;
let adapter: GPUAdapter | null = null;
let pipeline: GPUComputePipeline | null = null;
let isDeviceLost = false;

let bufferCache: BufferCache | null = null;
let paramsBuffer: GPUBuffer | null = null;
let currentRequestId = 0;
let processingLock: Promise<void> = Promise.resolve();

// Cache of the last RGBA result for re-encoding without GPU
let rgbaCache: RgbaCache | null = null;

// Reusable canvases: avoid allocating hundreds of MB per operation on large images
let extractCanvas: OffscreenCanvas | null = null;
let extractCtx: OffscreenCanvasRenderingContext2D | null = null;
let encodeCanvas: OffscreenCanvas | null = null;
let encodeCtx: OffscreenCanvasRenderingContext2D | null = null;

function getExtractContext(width: number, height: number): OffscreenCanvasRenderingContext2D {
  if (!extractCanvas || !extractCtx) {
    extractCanvas = new OffscreenCanvas(width, height);
    extractCtx = extractCanvas.getContext('2d', { willReadFrequently: true });
    if (!extractCtx) throw new Error('No se pudo crear contexto 2D en OffscreenCanvas');
  } else if (extractCanvas.width !== width || extractCanvas.height !== height) {
    extractCanvas.width = width;
    extractCanvas.height = height;
  }
  return extractCtx;
}

function getEncodeContext(width: number, height: number): OffscreenCanvasRenderingContext2D {
  if (!encodeCanvas || !encodeCtx) {
    encodeCanvas = new OffscreenCanvas(width, height);
    encodeCtx = encodeCanvas.getContext('2d');
    if (!encodeCtx) throw new Error('No se pudo crear contexto 2D en OffscreenCanvas');
  } else if (encodeCanvas.width !== width || encodeCanvas.height !== height) {
    encodeCanvas.width = width;
    encodeCanvas.height = height;
  }
  return encodeCtx;
}

function releaseCaches(): void {
  rgbaCache = null;

  if (bufferCache) {
    bufferCache.inputBuffer.destroy();
    bufferCache.outputBuffer.destroy();
    bufferCache.stagingBuffer.destroy();
    bufferCache.bindGroup = null;
    bufferCache = null;
  }

  extractCanvas = null;
  extractCtx = null;
  encodeCanvas = null;
  encodeCtx = null;
}

// ============================================================================
// WebGPU Initialization
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
    const info = adapterInfo
      ? `${adapterInfo.vendor} - ${adapterInfo.architecture}`
      : 'WebGPU Ready';
    return {
      type: 'init-complete',
      supported: true,
      adapterInfo: info,
    };
  } catch {
    return { type: 'init-complete', supported: false };
  }
}

// ============================================================================
// Buffer Management
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
// Encoding with OffscreenCanvas (runs in the Worker, doesn't block the main thread)
// ============================================================================

async function encodeImage(
  rgbaData: Uint8Array,
  width: number,
  height: number,
  format: OutputFormat,
  quality: number,
): Promise<{ buffer: ArrayBuffer; mimeType: string; timeMs: number }> {
  const tStart = performance.now();

  // Create ImageData from RGBA
  const imageData = new ImageData(
    new Uint8ClampedArray(rgbaData.buffer as ArrayBuffer, rgbaData.byteOffset, rgbaData.byteLength),
    width,
    height,
  );

  // Clamp quality to avoid lossless bloat at 100%
  let finalQuality = quality;
  if (finalQuality >= 1) {
    finalQuality = 0.98;
  }

  const ctx = getEncodeContext(width, height);
  ctx.putImageData(imageData, 0, 0);

  const blob = await ctx.canvas.convertToBlob({
    type: format,
    quality: finalQuality,
  });

  const buffer = await blob.arrayBuffer();
  const timeMs = performance.now() - tStart;

  return { buffer, mimeType: blob.type, timeMs };
}

// ============================================================================
// GPU Processing + Encoding
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
    // Extract pixels
    const ctx = getExtractContext(width, height);
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const inputData = new Uint8Array(imageData.data.buffer);

    // Buffers
    const buffers = ensureBuffers(pixelCount);

    if (isDeviceLost) {
      throw new Error('GPU device lost during buffer setup');
    }

    // Upload data
    device.queue.writeBuffer(buffers.inputBuffer, 0, inputData);

    // Parameters
    const brightness = params.brightness ?? 0;
    const contrast = params.contrast ?? 1;

    const paramsData = new ArrayBuffer(16);
    const view = new DataView(paramsData);
    view.setUint32(0, width, true);
    view.setUint32(4, height, true);
    view.setFloat32(8, brightness, true);
    view.setFloat32(12, contrast, true);
    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    // Run the shader
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

    // Read result
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

    // Cache the RGBA result for re-encoding
    rgbaCache = { data: resultData, width, height };

    // Encoding with OffscreenCanvas
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
// Re-encoding (no GPU, uses RGBA cache)
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

  // Encoding with OffscreenCanvas
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

// Direct encode of a bitmap (no GPU, doesn't touch the RGBA cache)
// Used to convert the original file to another format on download
async function encodeFile(message: EncodeFileMessage): Promise<ProcessResult> {
  const { imageBitmap, outputFormat, outputQuality, requestId } = message;
  const { width, height } = imageBitmap;

  try {
    const tStart = performance.now();

    let finalQuality = outputQuality;
    if (finalQuality >= 1) {
      finalQuality = 0.98;
    }

    const ctx = getEncodeContext(width, height);
    ctx.drawImage(imageBitmap, 0, 0);

    const blob = await ctx.canvas.convertToBlob({
      type: outputFormat,
      quality: finalQuality,
    });

    const buffer = await blob.arrayBuffer();
    const encodingTimeMs = performance.now() - tStart;

    return {
      type: 'result',
      blobData: buffer,
      blobType: blob.type,
      blobSize: buffer.byteLength,
      width,
      height,
      processingTimeMs: 0,
      encodingTimeMs,
      requestId,
    };
  } finally {
    imageBitmap.close();
  }
}

function cleanup(): void {
  try {
    releaseCaches();
    paramsBuffer?.destroy();
    device?.destroy();
  } catch {
    // Ignore errors during GPU resource cleanup
  }

  paramsBuffer = null;
  pipeline = null;
  device = null;
  adapter = null;
  isDeviceLost = false;
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
        } else {
          // Request superseded by a newer one: always reply so the main thread doesn't leave orphaned pending promises
          self.postMessage({ type: 'cancelled', requestId: message.requestId });
        }
        break;
      }

      case 'encode': {
        currentRequestId = message.requestId;
        const result = await reEncode(message);
        if (result) {
          self.postMessage(result, [result.blobData]);
        } else {
          self.postMessage({ type: 'cancelled', requestId: message.requestId });
        }
        break;
      }

      case 'encode-file': {
        // Independent of the processing flow: doesn't touch currentRequestId
        const result = await encodeFile(message);
        self.postMessage(result, [result.blobData]);
        break;
      }

      case 'cancel': {
        if (message.requestId > currentRequestId) {
          currentRequestId = message.requestId;
        }
        break;
      }

      case 'clear-cache': {
        releaseCaches();
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
