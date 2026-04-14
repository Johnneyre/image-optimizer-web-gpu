/// <reference lib="webworker" />

// ============================================================================
// Tipos e Interfaces
// ============================================================================

interface ProcessImageMessage {
  type: 'process';
  imageBitmap: ImageBitmap;
  operation: 'grayscale' | 'brightness' | 'contrast' | 'quality';
  params: {
    brightness?: number;
    contrast?: number;
    quality?: number;
  };
  requestId: number;
}

interface InitMessage {
  type: 'init';
}

interface DestroyMessage {
  type: 'destroy';
}

interface CancelMessage {
  type: 'cancel';
  requestId: number;
}

type WorkerMessage = ProcessImageMessage | InitMessage | DestroyMessage | CancelMessage;

interface ProcessResult {
  type: 'result';
  imageData: Uint8Array;
  width: number;
  height: number;
  processingTimeMs: number;
  requestId: number;
}

interface ErrorResult {
  type: 'error';
  message: string;
  requestId?: number;
}

interface InitResult {
  type: 'init-complete';
  supported: boolean;
  adapterInfo?: string;
}

// ============================================================================
// Shader WGSL
// ============================================================================

const IMAGE_PROCESSING_SHADER = /* wgsl */ `
struct Params {
  width: u32,
  height: u32,
  brightness: f32,
  contrast: f32,
  quality: f32,
  _padding: f32,
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

  // Brillo
  color = color + vec3<f32>(params.brightness);

  // Contraste
  color = vec3<f32>(
    contrastCurve(color.r, params.contrast),
    contrastCurve(color.g, params.contrast),
    contrastCurve(color.b, params.contrast)
  );

  // Simulación de compresión de calidad
  let qualityFactor = params.quality / 100.0;
  let levels = mix(4.0, 256.0, qualityFactor);
  color = floor(color * levels + 0.5) / levels;

  // Mezcla con escala de grises para calidades bajas
  let luminance = dot(color, vec3<f32>(0.2126, 0.7152, 0.0722));
  let chromaRetention = smoothstep(0.0, 0.3, qualityFactor);
  color = mix(vec3<f32>(luminance), color, chromaRetention);

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

let bufferCache: {
  size: number;
  inputBuffer: GPUBuffer;
  outputBuffer: GPUBuffer;
  stagingBuffer: GPUBuffer;
} | null = null;

let paramsBuffer: GPUBuffer | null = null;
let currentRequestId = 0;

// ============================================================================
// Inicialización
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

    device.lost.then((info) => {
      console.error('WebGPU device lost:', info.message);
      cleanup();
    });

    pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ code: IMAGE_PROCESSING_SHADER }),
        entryPoint: 'main',
      },
    });

    paramsBuffer = device.createBuffer({
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const adapterInfo = adapter.info;
    return {
      type: 'init-complete',
      supported: true,
      adapterInfo: adapterInfo ? `${adapterInfo.vendor} - ${adapterInfo.architecture}` : 'WebGPU Ready',
    };
  } catch (error) {
    return { type: 'init-complete', supported: false };
  }
}

// ============================================================================
// Gestión de Buffers
// ============================================================================

function ensureBuffers(pixelCount: number) {
  if (!device) throw new Error('Device no inicializado');

  const requiredSize = pixelCount * 4;

  if (bufferCache && bufferCache.size === requiredSize) {
    return bufferCache;
  }

  if (bufferCache) {
    bufferCache.inputBuffer.destroy();
    bufferCache.outputBuffer.destroy();
    bufferCache.stagingBuffer.destroy();
  }

  bufferCache = {
    size: requiredSize,
    inputBuffer: device.createBuffer({
      size: requiredSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    outputBuffer: device.createBuffer({
      size: requiredSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    }),
    stagingBuffer: device.createBuffer({
      size: requiredSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    }),
  };

  return bufferCache;
}

// ============================================================================
// Procesamiento
// ============================================================================

async function processImage(message: ProcessImageMessage): Promise<ProcessResult | null> {
  const { imageBitmap, params, requestId } = message;

  if (requestId < currentRequestId) {
    imageBitmap.close();
    return null;
  }

  if (!device || !pipeline || !paramsBuffer) {
    throw new Error('WebGPU no inicializado');
  }

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

    // Subir datos
    device.queue.writeBuffer(buffers.inputBuffer, 0, inputData);

    // Parámetros - usar DataView para escribir u32 y f32 correctamente
    const paramsData = new ArrayBuffer(24);
    const view = new DataView(paramsData);
    view.setUint32(0, width, true);  // width como u32
    view.setUint32(4, height, true); // height como u32
    view.setFloat32(8, params.brightness ?? 0, true);
    view.setFloat32(12, params.contrast ?? 1, true);
    view.setFloat32(16, params.quality ?? 100, true);
    view.setFloat32(20, 0, true);  // padding
    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    // Bind group
    const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buffers.inputBuffer } },
        { binding: 1, resource: { buffer: buffers.outputBuffer } },
        { binding: 2, resource: { buffer: paramsBuffer } },
      ],
    });

    // Ejecutar shader
    const commandEncoder = device.createCommandEncoder();
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(pipeline);
    computePass.setBindGroup(0, bindGroup);
    computePass.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
    computePass.end();

    commandEncoder.copyBufferToBuffer(buffers.outputBuffer, 0, buffers.stagingBuffer, 0, pixelCount * 4);
    device.queue.submit([commandEncoder.finish()]);

    // Verificar cancelación
    if (requestId < currentRequestId) {
      imageBitmap.close();
      return null;
    }

    // Leer resultado
    await buffers.stagingBuffer.mapAsync(GPUMapMode.READ);
    const resultData = new Uint8Array(buffers.stagingBuffer.getMappedRange().slice(0));
    buffers.stagingBuffer.unmap();

    const processingTimeMs = performance.now() - startTime;
    imageBitmap.close();

    return {
      type: 'result',
      imageData: resultData,
      width,
      height,
      processingTimeMs,
      requestId,
    };
  } catch (error) {
    imageBitmap.close();
    throw error;
  }
}

// ============================================================================
// Limpieza
// ============================================================================

function cleanup(): void {
  if (bufferCache) {
    bufferCache.inputBuffer.destroy();
    bufferCache.outputBuffer.destroy();
    bufferCache.stagingBuffer.destroy();
    bufferCache = null;
  }
  paramsBuffer?.destroy();
  paramsBuffer = null;
  pipeline = null;
  device?.destroy();
  device = null;
  adapter = null;
}

// ============================================================================
// Message Handler
// ============================================================================

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    switch (message.type) {
      case 'init': {
        const result = await initializeWebGPU();
        self.postMessage(result);
        break;
      }

      case 'process': {
        currentRequestId = message.requestId;
        const result = await processImage(message);
        if (result) {
          // Transferir el ArrayBuffer
          self.postMessage(result, [result.imageData.buffer]);
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
      requestId: (message as ProcessImageMessage).requestId,
    } as ErrorResult);
  }
};
