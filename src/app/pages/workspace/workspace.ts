import { Component, signal, computed, inject, afterNextRender } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, AlertCircle } from 'lucide-angular';
import { ImageProcessingService } from '../../services/image-processing.service';
import { ThemeService } from '../../services/theme.service';
import { ImageComparisonComponent } from '../../components/image-comparison/image-comparison';
import {
  SidebarControlsComponent,
  DownloadRequest,
} from '../../components/sidebar-controls/sidebar-controls';
import { DownloadOverlayComponent } from '../../components/download-overlay/download-overlay';

@Component({
  selector: 'app-workspace',
  imports: [
    LucideAngularModule,
    ImageComparisonComponent,
    SidebarControlsComponent,
    DownloadOverlayComponent,
  ],
  templateUrl: './workspace.html',
  styleUrl: './workspace.css',
})
export class WorkspacePage {
  // Servicios
  private readonly imageService = inject(ImageProcessingService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  // Iconos
  readonly icons = { AlertCircle };

  readonly isDownloading = signal(false);

  readonly isProcessing = this.imageService.isProcessing;
  readonly originalImageUrl = this.imageService.originalImageUrl;
  readonly processedImageUrl = this.imageService.processedImageUrl;
  readonly quality = this.imageService.quality;
  readonly brightness = this.imageService.brightness;
  readonly contrast = this.imageService.contrast;
  readonly stats = this.imageService.stats;
  readonly hasImage = this.imageService.hasImage;

  readonly theme = this.themeService.theme;

  readonly canDownload = computed(() => this.processedImageUrl() !== null && !this.isProcessing());

  readonly fileName = computed(() => {
    const file = this.imageService.currentFile();
    return file ? file.name : null;
  });

  readonly originalSize = computed(() => {
    const file = this.imageService.currentFile();
    return file ? this.formatFileSize(file.size) : null;
  });

  readonly processedSize = computed(() => {
    const stats = this.stats();
    return stats ? this.formatFileSize(stats.processedSize) : null;
  });

  readonly sizeDifference = computed(() => {
    const stats = this.stats();
    if (!stats) return null;

    const diff = stats.originalSize - stats.processedSize;
    const percent = stats.compressionRatio.toFixed(1);
    return {
      bytes: this.formatFileSize(Math.abs(diff)),
      percent: diff > 0 ? `-${percent}%` : `+${Math.abs(Number.parseFloat(percent))}%`,
      isReduction: diff > 0,
    };
  });

  readonly processingTime = computed(() => {
    const time = this.imageService.processingTimeMs();
    return time > 0 ? `${time.toFixed(1)}ms` : null;
  });

  readonly hasStats = computed(() => this.stats() !== null);

  constructor() {
    afterNextRender(() => {
      // Guard: redirect if no image loaded
      if (!this.hasImage()) {
        this.router.navigate(['/']);
      }
    });
  }

  onQualityChange(value: number): void {
    this.imageService.setQuality(value);
  }

  onBrightnessChange(value: number): void {
    this.imageService.setBrightness(value);
  }

  onContrastChange(value: number): void {
    this.imageService.setContrast(value);
  }

  onPresetSelect(value: number): void {
    this.imageService.setQuality(value);
  }

  resetAdjustments(): void {
    this.imageService.resetAdjustments();
  }

  clearImage(): void {
    this.imageService.clearFile();
    this.router.navigate(['/']);
  }

  async onDownloadRequested(request: DownloadRequest): Promise<void> {
    const fileName = this.fileName();
    if (!fileName) return;

    this.isDownloading.set(true);

    try {
      const blob = await this.imageService.generateDownloadBlob(request.format, request.quality);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Preserve original filename, change extension based on format
      const baseName = fileName.replace(/\.[^/.]+$/, '');
      const ext = this.getExtensionForFormat(request.format);
      link.download = `${baseName}${ext}`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando:', error);
    } finally {
      this.isDownloading.set(false);
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private getExtensionForFormat(format: string): string {
    switch (format) {
      case 'image/webp':
        return '.webp';
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      default:
        return '.webp';
    }
  }
}
