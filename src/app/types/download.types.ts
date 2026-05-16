export type DownloadFormat = 'image/webp' | 'image/jpeg' | 'image/png';

export interface QualityPreset {
  label: string;
  value: number;
  description: string;
}

export interface DownloadRequest {
  format: DownloadFormat;
  quality: number;
}
