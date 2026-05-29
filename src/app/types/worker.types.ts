export type OutputFormat = 'image/webp' | 'image/jpeg';

export interface BufferCache {
  size: number;
  inputBuffer: GPUBuffer;
  outputBuffer: GPUBuffer;
  stagingBuffer: GPUBuffer;
  bindGroup: GPUBindGroup | null;
}

export interface RgbaCache {
  data: Uint8Array;
  width: number;
  height: number;
}

export interface WorkerProcessResult {
  blobData: ArrayBuffer;
  blobType: string;
  blobSize: number;
  width: number;
  height: number;
  processingTimeMs: number;
  encodingTimeMs: number;
}

export interface ProcessImageMessage {
  type: 'process';
  imageBitmap: ImageBitmap;
  operation: 'grayscale' | 'brightness' | 'contrast' | 'quality';
  params: {
    brightness?: number;
    contrast?: number;
    quality?: number;
  };
  // Output encoding params
  outputFormat: OutputFormat;
  outputQuality: number; // 0-1
  requestId: number;
}

// Re-encode cached result with different format/quality (no GPU processing)
export interface EncodeMessage {
  type: 'encode';
  outputFormat: OutputFormat;
  outputQuality: number;
  requestId: number;
}

export interface InitMessage {
  type: 'init';
}

export interface DestroyMessage {
  type: 'destroy';
}

export interface CancelMessage {
  type: 'cancel';
  requestId: number;
}

export type WorkerMessage = ProcessImageMessage | EncodeMessage | InitMessage | DestroyMessage | CancelMessage;

// Result now returns encoded blob data instead of raw RGBA
export interface ProcessResult {
  type: 'result';
  blobData: ArrayBuffer; // Encoded image (WebP/JPEG)
  blobType: string; // MIME type
  blobSize: number;
  width: number;
  height: number;
  processingTimeMs: number;
  encodingTimeMs: number;
  requestId: number;
}

export interface ErrorResult {
  type: 'error';
  message: string;
  requestId?: number;
}

export interface InitResult {
  type: 'init-complete';
  supported: boolean;
  adapterInfo?: string;
}

export type WorkerResult = ProcessResult | ErrorResult | InitResult;
