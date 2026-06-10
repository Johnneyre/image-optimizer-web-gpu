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
  LoaderCircle,
  FileDown,
  Clock,
  SlidersHorizontal,
} from 'lucide-angular';
import type { Theme, DownloadFormat, DownloadRequest, QualityPreset } from '@types';

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
  readonly outputFormat = input<DownloadFormat>('image/webp');
  readonly isProcessing = input(false);
  readonly hasProcessedImage = input(false);
  readonly canDownload = input(false);
  readonly hasStats = input(false);

  readonly shouldBlockControls = computed(() => this.isProcessing() && !this.hasProcessedImage());

  // Outputs
  readonly qualityChange = output<number>();
  readonly brightnessChange = output<number>();
  readonly contrastChange = output<number>();
  readonly presetSelect = output<number>();
  readonly resetAdjustments = output<void>();
  readonly downloadRequested = output<DownloadRequest>();
  readonly formatChange = output<DownloadFormat>();

  // Icons
  readonly icons = {
    Image,
    Sun,
    Contrast,
    RotateCcw,
    Download,
    LoaderCircle,
    FileDown,
    Clock,
    SlidersHorizontal,
  };

  // Local state
  readonly selectedPreset = signal<number | null>(80);
  readonly selectedFormat = signal<DownloadFormat>('image/webp');
  readonly activeTab = signal<'quality' | 'adjustments'>('quality');

  // Dot indicator on the "Ajustes" tab when brightness/contrast deviate from defaults
  readonly hasActiveAdjustments = computed(() => this.brightness() !== 0 || this.contrast() !== 1);

  readonly qualityPresets: QualityPreset[] = [
    { label: '100%', value: 100, description: 'Original' },
    { label: '80%', value: 80, description: 'Alta' },
    { label: '60%', value: 60, description: 'Media' },
    { label: '30%', value: 30, description: 'Baja' },
  ];

  readonly formatOptions: { value: DownloadFormat; label: string }[] = [
    { value: 'image/webp', label: 'WebP' },
    { value: 'image/jpeg', label: 'JPEG' },
  ];

  readonly formatExtension = computed(() => {
    const fmt = this.selectedFormat();
    switch (fmt) {
      case 'image/webp':
        return '.webp';
      case 'image/jpeg':
        return '.jpg';
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

    // Sync format selection with the service-driven input so the UI never
    // diverges from the format actually used for processing
    effect(() => {
      this.selectedFormat.set(this.outputFormat());
    });
  }

  onSelectTab(tab: 'quality' | 'adjustments'): void {
    this.activeTab.set(tab);
  }

  onSelectPreset(value: number): void {
    this.presetSelect.emit(value);
  }

  onQualityChange(event: Event): void {
    const value = Number.parseInt((event.target as HTMLInputElement).value, 10);
    this.qualityChange.emit(value);
  }

  onBrightnessChange(event: Event): void {
    const value = Number.parseFloat((event.target as HTMLInputElement).value);
    this.brightnessChange.emit(value);
  }

  onContrastChange(event: Event): void {
    const value = Number.parseFloat((event.target as HTMLInputElement).value);
    this.contrastChange.emit(value);
  }

  onResetAdjustments(): void {
    this.resetAdjustments.emit();
  }

  onFormatChange(format: DownloadFormat): void {
    this.selectedFormat.set(format);
    this.formatChange.emit(format);
  }

  onDownload(): void {
    this.downloadRequested.emit({
      format: this.selectedFormat(),
      quality: this.quality() / 100,
    });
  }
}
