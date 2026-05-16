export interface ProcessImageMessage {
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

export type WorkerMessage = ProcessImageMessage | InitMessage | DestroyMessage | CancelMessage;

export interface ProcessResult {
  type: 'result';
  imageData: Uint8Array;
  width: number;
  height: number;
  processingTimeMs: number;
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
