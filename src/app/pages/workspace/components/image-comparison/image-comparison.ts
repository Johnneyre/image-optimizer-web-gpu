import {
  Component,
  input,
  signal,
  computed,
  output,
  viewChild,
  ElementRef,
  HostListener,
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

type Theme = 'dark' | 'light';

@Component({
  selector: 'app-image-comparison',
  imports: [LucideAngularModule],
  templateUrl: './image-comparison.html',
  styleUrl: './image-comparison.css',
})
export class ImageComparisonComponent {
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

  // ============================================================================
  // Comparison Slider — uses stopPropagation to prevent pan conflict
  // ============================================================================

  onSliderMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation(); // Prevent pan from triggering
    this.isSliderDragging.set(true);
    this.updateSliderPosition(event);
  }

  onSliderTouchStart(event: TouchEvent): void {
    event.preventDefault();
    event.stopPropagation(); // Prevent pan from triggering
    this.isSliderDragging.set(true);
    this.updateSliderPositionFromTouch(event);
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isSliderDragging()) {
      event.preventDefault();
      this.updateSliderPosition(event);
      return; // Slider takes priority over panning
    }
    if (this.isPanning()) {
      const dx = event.clientX - this.panStart.x;
      const dy = event.clientY - this.panStart.y;
      this.panOffset.update((current) => ({
        x: current.x + dx / this.zoomLevel(),
        y: current.y + dy / this.zoomLevel(),
      }));
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
  // Zoom & Pan — only activates when NOT slider dragging
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
    this.sliderPosition.set(50);
  }

  onImageMouseDown(event: MouseEvent): void {
    // Only start panning if zoomed in and slider is NOT being dragged
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
