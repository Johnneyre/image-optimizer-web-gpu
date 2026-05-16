export interface ProcessingParams {
  brightness: number;
  contrast: number;
  quality: number;
}

export interface ProcessingResult {
  imageData: Uint8Array;
  width: number;
  height: number;
  processingTimeMs: number;
}

export interface ProcessingStats {
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
  processingTimeMs: number;
}
