import { Component, input, output, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UpperCasePipe } from '@angular/common';
import {
  LucideAngularModule,
  Image,
  Sun,
  Contrast,
  RotateCcw,
  Download,
  Loader2,
  FileDown,
  Clock,
  SlidersHorizontal,
} from 'lucide-angular';

type Theme = 'dark' | 'light';

export type DownloadFormat = 'image/webp' | 'image/jpeg' | 'image/png';

interface QualityPreset {
  label: string;
  value: number;
  description: string;
}

export interface DownloadRequest {
  format: DownloadFormat;
  quality: number;
}

@Component({
  selector: 'app-sidebar-controls',
  imports: [FormsModule, LucideAngularModule, UpperCasePipe],
  templateUrl: './sidebar-controls.html',
  styleUrl: './sidebar-controls.css',
})
export class SidebarControlsComponent {
  // Inputs
  readonly theme = input.required<Theme>();
  readonly fileName = input<string | null>(null);
  readonly originalSize = input<string | null>(null);
  readonly processedSize = input<string | null>(null);
  readonly sizeDifference = input<{ bytes: string; percent: string; isReduction: boolean } | null>(
    null,
  );
  readonly processingTime = input<string | null>(null);
  readonly quality = input(80);
  readonly brightness = input(0);
  readonly contrast = input(1);
  readonly isProcessing = input(false);
  readonly canDownload = input(false);
  readonly hasStats = input(false);

  // Outputs
  readonly qualityChange = output<number>();
  readonly brightnessChange = output<number>();
  readonly contrastChange = output<number>();
  readonly presetSelect = output<number>();
  readonly resetAdjustments = output<void>();
  readonly downloadRequested = output<DownloadRequest>();

  // Icons
  readonly icons = {
    Image,
    Sun,
    Contrast,
    RotateCcw,
    Download,
    Loader2,
    FileDown,
    Clock,
    SlidersHorizontal,
  };

  // Local state
  readonly selectedPreset = signal<number | null>(80);
  readonly selectedFormat = signal<DownloadFormat>('image/webp');

  readonly qualityPresets: QualityPreset[] = [
    { label: '100%', value: 100, description: 'Original' },
    { label: '80%', value: 80, description: 'Alta' },
    { label: '60%', value: 60, description: 'Media' },
    { label: '30%', value: 30, description: 'Baja' },
  ];

  readonly formatOptions: { value: DownloadFormat; label: string }[] = [
    { value: 'image/webp', label: 'WebP' },
    { value: 'image/jpeg', label: 'JPEG' },
    { value: 'image/png', label: 'PNG' },
  ];

  readonly formatExtension = computed(() => {
    const fmt = this.selectedFormat();
    switch (fmt) {
      case 'image/webp':
        return '.webp';
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      default:
        return '.webp';
    }
  });

  constructor() {
    // Sync preset selection with quality input
    effect(() => {
      const q = this.quality();
      const preset = this.qualityPresets.find((p) => p.value === q);
      this.selectedPreset.set(preset ? preset.value : null);
    });
  }

  onSelectPreset(value: number): void {
    this.presetSelect.emit(value);
  }

  onQualityChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.qualityChange.emit(value);
  }

  onBrightnessChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.brightnessChange.emit(value);
  }

  onContrastChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.contrastChange.emit(value);
  }

  onResetAdjustments(): void {
    this.resetAdjustments.emit();
  }

  onFormatChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as DownloadFormat;
    this.selectedFormat.set(value);
  }

  onDownload(): void {
    this.downloadRequested.emit({
      format: this.selectedFormat(),
      quality: this.quality() / 100,
    });
  }
}
