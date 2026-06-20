export interface ProcessingParams {
  brightness: number;
  contrast: number;
  quality: number;
}

export interface ProcessingStats {
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
  processingTimeMs: number;
}
