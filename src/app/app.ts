import {
  Component,
  signal,
  computed,
  effect,
  ElementRef,
  viewChild,
  HostListener,
  inject,
  afterNextRender,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Upload,
  Download,
  Image,
  Zap,
  X,
  Sun,
  Moon,
  Contrast,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Gpu,
  Clock,
  FileDown,
  SlidersHorizontal,
} from 'lucide-angular';
import { ImageProcessingService } from './services/image-processing.service';

// ============================================================================
// Tipos
// ============================================================================

interface QualityPreset {
  label: string;
  value: number;
  description: string;
}

type Theme = 'dark' | 'light';

// ============================================================================
// Componente Principal
// ============================================================================

@Component({
  selector: 'app-root',
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // Servicios
  readonly imageService = inject(ImageProcessingService);

  // Referencias DOM
  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly comparisonContainer = viewChild<ElementRef<HTMLDivElement>>('comparisonContainer');

  // Iconos
  readonly icons = {
    Upload, Download, Image, Zap, X, Sun, Moon, Contrast,
    AlertCircle, Loader2, ChevronLeft, ChevronRight,
    ZoomIn, ZoomOut, RotateCcw, Gpu, Clock, FileDown, SlidersHorizontal,
  };

  // ============================================================================
  // Estado Local
  // ============================================================================

  // Tema
  readonly theme = signal<Theme>('dark');

  // UI State
  readonly isDragging = signal(false);
  readonly sliderPosition = signal(50);
  readonly isSliderDragging = signal(false);

  // Zoom y Pan
  readonly zoomLevel = signal(1);
  readonly panOffset = signal({ x: 0, y: 0 });
  readonly isPanning = signal(false);
  private panStart = { x: 0, y: 0 };

  // Presets
  readonly selectedPreset = signal<number | null>(80);
  readonly qualityPresets: QualityPreset[] = [
    { label: '100%', value: 100, description: 'Original' },
    { label: '80%', value: 80, description: 'Alta' },
    { label: '60%', value: 60, description: 'Media' },
    { label: '30%', value: 30, description: 'Baja' },
  ];

  // ============================================================================
  // Signals del Servicio (Acceso directo)
  // ============================================================================

  readonly isSupported = this.imageService.isSupported;
  readonly isInitializing = this.imageService.isInitializing;
  readonly isProcessing = this.imageService.isProcessing;
  readonly isReady = this.imageService.isReady;
  readonly adapterInfo = this.imageService.adapterInfo;
  readonly lastError = this.imageService.lastError;
  readonly hasImage = this.imageService.hasImage;
  readonly originalImageUrl = this.imageService.originalImageUrl;
  readonly processedImageUrl = this.imageService.processedImageUrl;
  readonly quality = this.imageService.quality;
  readonly brightness = this.imageService.brightness;
  readonly contrast = this.imageService.contrast;
  readonly stats = this.imageService.stats;

  // ============================================================================
  // Computed
  // ============================================================================

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
      percent: diff > 0 ? `-${percent}%` : `+${Math.abs(parseFloat(percent))}%`,
      isReduction: diff > 0,
    };
  });

  readonly processingTime = computed(() => {
    const time = this.imageService.processingTimeMs();
    return time > 0 ? `${time.toFixed(1)}ms` : null;
  });

  readonly transformStyle = computed(() => {
    const zoom = this.zoomLevel();
    const pan = this.panOffset();
    return `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`;
  });

  readonly themeClass = computed(() => this.theme() === 'dark' ? 'theme-dark' : 'theme-light');

  // ============================================================================
  // Constructor y Effects
  // ============================================================================

  constructor() {
    // Cargar tema guardado
    afterNextRender(() => {
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      if (savedTheme) {
        this.theme.set(savedTheme);
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        this.theme.set('light');
      }
    });

    // Effect: sincronizar preset con quality
    effect(() => {
      const quality = this.quality();
      const preset = this.qualityPresets.find(p => p.value === quality);
      this.selectedPreset.set(preset ? preset.value : null);
    });
  }

  // ============================================================================
  // Tema
  // ============================================================================

  toggleTheme(): void {
    const newTheme = this.theme() === 'dark' ? 'light' : 'dark';
    this.theme.set(newTheme);
    localStorage.setItem('theme', newTheme);
  }

  // ============================================================================
  // Manejo de Archivos
  // ============================================================================

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  triggerFileInput(): void {
    this.fileInput()?.nativeElement.click();
  }

  private async handleFile(file: File): Promise<void> {
    this.resetView();
    await this.imageService.setFile(file);
  }

  clearImage(): void {
    this.imageService.clearFile();
    this.resetView();
  }

  // ============================================================================
  // Controles de Calidad - Actualizan Signals del Servicio
  // ============================================================================

  selectPreset(value: number): void {
    this.imageService.setQuality(value);
  }

  onQualityChange(event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value, 10);
    this.imageService.setQuality(value);
  }

  onBrightnessChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.imageService.setBrightness(value);
  }

  onContrastChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.imageService.setContrast(value);
  }

  resetAdjustments(): void {
    this.imageService.resetAdjustments();
  }

  // ============================================================================
  // Comparison Slider
  // ============================================================================

  onSliderMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isSliderDragging.set(true);
    this.updateSliderPosition(event);
  }

  onSliderTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.isSliderDragging.set(true);
    this.updateSliderPositionFromTouch(event);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isSliderDragging()) {
      this.updateSliderPosition(event);
    }
    if (this.isPanning()) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;
      this.panOffset.update(current => ({
        x: current.x + dx / this.zoomLevel(),
        y: current.y + dy / this.zoomLevel(),
      }));
      this.panStart = { x: event.clientX, y: event.clientY };
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (this.isSliderDragging()) {
      this.updateSliderPositionFromTouch(event);
    }
  }

  @HostListener('document:mouseup')
  @HostListener('document:touchend')
  onPointerUp(): void {
    this.isSliderDragging.set(false);
    this.isPanning.set(false);
  }

  private updateSliderPosition(event: MouseEvent): void {
    const container = this.comparisonContainer()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    this.sliderPosition.set(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }

  private updateSliderPositionFromTouch(event: TouchEvent): void {
    const container = this.comparisonContainer()?.nativeElement;
    if (!container || !event.touches[0]) return;

    const rect = container.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    this.sliderPosition.set(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }

  // ============================================================================
  // Zoom y Pan
  // ============================================================================

  zoomIn(): void {
    this.zoomLevel.update(z => Math.min(z + 0.25, 4));
  }

  zoomOut(): void {
    this.zoomLevel.update(z => Math.max(z - 0.25, 0.25));
  }

  resetView(): void {
    this.zoomLevel.set(1);
    this.panOffset.set({ x: 0, y: 0 });
    this.sliderPosition.set(50);
  }

  onImageMouseDown(event: MouseEvent): void {
    if (this.zoomLevel() > 1 && event.button === 0) {
      event.preventDefault();
      this.isPanning.set(true);
      this.panStart = { x: event.clientX, y: event.clientY };
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  // ============================================================================
  // Descarga
  // ============================================================================

  async downloadImage(): Promise<void> {
    const fileName = this.fileName();
    if (!fileName) return;

    try {
      const blob = await this.imageService.generateDownloadBlob('image/webp', this.quality() / 100);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName.replace(/\.[^/.]+$/, '') + '_optimized.webp';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error descargando:', error);
    }
  }

  // ============================================================================
  // Utilidades
  // ============================================================================

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
