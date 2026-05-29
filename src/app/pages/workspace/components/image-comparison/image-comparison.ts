import {
  Component,
  input,
  signal,
  computed,
  output,
  viewChild,
  ElementRef,
  HostListener,
  effect,
  afterNextRender,
  OnDestroy,
  untracked,
} from '@angular/core';
import {
  LucideAngularModule,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  X,
  Loader2,
} from 'lucide-angular';
import type { Theme } from '@types';

@Component({
  selector: 'app-image-comparison',
  imports: [LucideAngularModule],
  templateUrl: './image-comparison.html',
  styleUrl: './image-comparison.css',
})
export class ImageComparisonComponent implements OnDestroy {
  // Inputs
  readonly theme = input.required<Theme>();
  readonly originalImageUrl = input<string | null>(null);
  readonly processedImageUrl = input<string | null>(null);
  readonly isProcessing = input(false);

  // Outputs
  readonly clearImage = output<void>();

  // DOM refs
  readonly comparisonContainer = viewChild<ElementRef<HTMLDivElement>>('comparisonContainer');

  // Icons
  readonly icons = {
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCcw,
    X,
    Loader2,
  };

  // Container size (updated via ResizeObserver)
  readonly containerWidth = signal(0);
  readonly containerHeight = signal(0);
  private resizeObserver: ResizeObserver | null = null;

  // Image natural dimensions
  readonly imageNaturalWidth = signal(0);
  readonly imageNaturalHeight = signal(0);

  // Computed: displayed image dimensions (with object-contain, before zoom)
  readonly displayedImageDimensions = computed(() => {
    const containerW = this.containerWidth();
    const containerH = this.containerHeight();
    const imgW = this.imageNaturalWidth();
    const imgH = this.imageNaturalHeight();

    if (containerW === 0 || containerH === 0 || imgW === 0 || imgH === 0) {
      return { width: containerW, height: containerH, top: 0, left: 0 };
    }

    const containerRatio = containerW / containerH;
    const imageRatio = imgW / imgH;

    let displayedWidth: number;
    let displayedHeight: number;

    if (imageRatio > containerRatio) {
      // Image is wider - fills width, has vertical margins
      displayedWidth = containerW;
      displayedHeight = containerW / imageRatio;
    } else {
      // Image is taller - fills height, has horizontal margins
      displayedHeight = containerH;
      displayedWidth = containerH * imageRatio;
    }

    const left = (containerW - displayedWidth) / 2;
    const top = (containerH - displayedHeight) / 2;

    return { width: displayedWidth, height: displayedHeight, top, left };
  });

  // Computed: bounds for slider based on image area (considering zoom and pan)
  readonly sliderBounds = computed(() => {
    const containerW = this.containerWidth();
    const dims = this.displayedImageDimensions();
    const zoom = this.zoomLevel();
    const pan = this.panOffset();

    if (containerW === 0 || dims.width === 0) {
      return { min: 0, max: 100, top: 0, height: 100 };
    }

    // Apply zoom to the displayed dimensions
    const scaledWidth = dims.width * zoom;
    const scaledHeight = dims.height * zoom;

    // Calculate the center of the container
    const containerCenterX = containerW / 2;
    const containerCenterY = this.containerHeight() / 2;

    // The image is centered, then scaled from center, then panned
    const scaledImageLeft = containerCenterX - scaledWidth / 2 + pan.x * zoom;
    const scaledImageRight = containerCenterX + scaledWidth / 2 + pan.x * zoom;
    const scaledImageTop = containerCenterY - scaledHeight / 2 + pan.y * zoom;
    const scaledImageBottom = containerCenterY + scaledHeight / 2 + pan.y * zoom;

    // Convert to percentages and clamp to container bounds
    const minPercent = Math.max(0, (scaledImageLeft / containerW) * 100);
    const maxPercent = Math.min(100, (scaledImageRight / containerW) * 100);

    // Calculate top and height for slider (clamped to container)
    const topPx = Math.max(0, scaledImageTop);
    const bottomPx = Math.min(this.containerHeight(), scaledImageBottom);
    const topPercent = (topPx / this.containerHeight()) * 100;
    const heightPercent = ((bottomPx - topPx) / this.containerHeight()) * 100;

    return { min: minPercent, max: maxPercent, top: topPercent, height: heightPercent };
  });

  // Computed: pan limits to prevent image from going out of view
  readonly panLimits = computed(() => {
    const containerW = this.containerWidth();
    const containerH = this.containerHeight();
    const dims = this.displayedImageDimensions();
    const zoom = this.zoomLevel();

    if (zoom <= 1) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    }

    const scaledWidth = dims.width * zoom;
    const scaledHeight = dims.height * zoom;

    // How much the scaled image exceeds the container
    const excessW = Math.max(0, scaledWidth - containerW) / 2;
    const excessH = Math.max(0, scaledHeight - containerH) / 2;

    // Pan limits (in pre-zoom coordinates)
    const maxPanX = excessW / zoom;
    const maxPanY = excessH / zoom;

    return { minX: -maxPanX, maxX: maxPanX, minY: -maxPanY, maxY: maxPanY };
  });

  // Slider state
  readonly sliderPosition = signal(50);
  readonly isSliderDragging = signal(false);

  // Zoom & Pan state
  readonly zoomLevel = signal(1);
  readonly panOffset = signal({ x: 0, y: 0 });
  readonly isPanning = signal(false);
  private panStart = { x: 0, y: 0 };

  // Computed
  readonly transformStyle = computed(() => {
    const zoom = this.zoomLevel();
    const pan = this.panOffset();
    return `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`;
  });

  constructor() {
    afterNextRender(() => {
      this.setupResizeObserver();
    });

    // Clamp slider position when bounds change
    effect(() => {
      const bounds = this.sliderBounds();
      // Use untracked to avoid circular dependency
      const currentPos = untracked(() => this.sliderPosition());

      // Only adjust if slider is outside bounds
      if (currentPos < bounds.min) {
        this.sliderPosition.set(bounds.min);
      } else if (currentPos > bounds.max) {
        this.sliderPosition.set(bounds.max);
      }
    });
  }

  private setupResizeObserver(): void {
    const container = this.comparisonContainer()?.nativeElement;
    if (!container) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        this.containerWidth.set(entry.contentRect.width);
        this.containerHeight.set(entry.contentRect.height);
      }
    });

    this.resizeObserver.observe(container);

    // Initial size
    const rect = container.getBoundingClientRect();
    this.containerWidth.set(rect.width);
    this.containerHeight.set(rect.height);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ============================================================================
  // Comparison Slider
  // ============================================================================

  onSliderMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isSliderDragging.set(true);
    this.updateSliderPosition(event);
  }

  onSliderTouchStart(event: TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isSliderDragging.set(true);
    this.updateSliderPositionFromTouch(event);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isSliderDragging()) {
      event.preventDefault();
      this.updateSliderPosition(event);
      return;
    }
    if (this.isPanning()) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;
      const limits = this.panLimits();

      this.panOffset.update((current) => {
        const newX = current.x + dx / this.zoomLevel();
        const newY = current.y + dy / this.zoomLevel();
        return {
          x: Math.max(limits.minX, Math.min(limits.maxX, newX)),
          y: Math.max(limits.minY, Math.min(limits.maxY, newY)),
        };
      });
      this.panStart = { x: event.clientX, y: event.clientY };
    }
  }

  @HostListener('document:touchmove', ['$event'])
  onTouchMove(event: TouchEvent): void {
    if (this.isSliderDragging()) {
      event.preventDefault();
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
    const bounds = this.sliderBounds();
    const percentage = (x / rect.width) * 100;
    this.sliderPosition.set(Math.max(bounds.min, Math.min(bounds.max, percentage)));
  }

  private updateSliderPositionFromTouch(event: TouchEvent): void {
    const container = this.comparisonContainer()?.nativeElement;
    if (!container || !event.touches[0]) return;

    const rect = container.getBoundingClientRect();
    const x = event.touches[0].clientX - rect.left;
    const bounds = this.sliderBounds();
    const percentage = (x / rect.width) * 100;
    this.sliderPosition.set(Math.max(bounds.min, Math.min(bounds.max, percentage)));
  }

  onImageLoad(event: Event): void {
    const img = event.target as HTMLImageElement;
    this.imageNaturalWidth.set(img.naturalWidth);
    this.imageNaturalHeight.set(img.naturalHeight);
  }

  // ============================================================================
  // Zoom & Pan
  // ============================================================================

  zoomIn(): void {
    this.zoomLevel.update((z) => Math.min(z + 0.25, 4));
  }

  zoomOut(): void {
    this.zoomLevel.update((z) => Math.max(z - 0.25, 0.25));
  }

  resetView(): void {
    this.zoomLevel.set(1);
    this.panOffset.set({ x: 0, y: 0 });
    // Center slider within image bounds
    const bounds = this.sliderBounds();
    this.sliderPosition.set((bounds.min + bounds.max) / 2);
  }

  onImageMouseDown(event: MouseEvent): void {
    if (this.zoomLevel() > 1 && event.button === 0 && !this.isSliderDragging()) {
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

  onClearImage(): void {
    this.clearImage.emit();
  }
}
