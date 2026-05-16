import {
  Component,
  signal,
  output,
  afterNextRender,
  DestroyRef,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'app-hero-demo',
  standalone: true,
  templateUrl: './hero-demo.html',
  styleUrl: './hero-demo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroDemoComponent {
  private readonly destroyRef = inject(DestroyRef);
  private destroyed = false;

  /** Emitted when the single-run animation finishes */
  readonly completed = output<void>();

  /** Emitted when the animation step changes (1, 2, or 3) */
  readonly stepChange = output<number>();

  // Animation state signals
  readonly activeScene = signal<'upload' | 'editor'>('upload');
  readonly cursorTop = signal(80);
  readonly cursorLeft = signal(80);
  readonly cursorClicking = signal(false);
  readonly uploadHovered = signal(false);
  readonly scanPos = signal(0);
  readonly wrapperTransition = signal('none');
  readonly scanlineTransition = signal('none');
  readonly showScanline = signal(false);
  readonly showLabelLeft = signal(false);
  readonly showLabelRight = signal(false);
  readonly showDownload = signal(false);
  readonly downloadGlow = signal(false);
  readonly downloadHovered = signal(false);
  readonly scanComplete = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
    });

    afterNextRender(() => {
      setTimeout(() => this.runAnimation(), 1200);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.destroyed) return resolve();
      setTimeout(resolve, ms);
    });
  }

  private setScanPosition(pct: number, duration = '0s', easing = 'linear'): void {
    this.scanPos.set(pct);
    if (duration === '0s') {
      this.wrapperTransition.set('none');
      this.scanlineTransition.set('none');
    } else {
      this.wrapperTransition.set(`clip-path ${duration} ${easing}`);
      this.scanlineTransition.set(`left ${duration} ${easing}`);
    }
  }

  private resetState(): void {
    this.activeScene.set('upload');
    this.cursorTop.set(80);
    this.cursorLeft.set(80);
    this.cursorClicking.set(false);
    this.uploadHovered.set(false);
    this.setScanPosition(0);
    this.showScanline.set(false);
    this.showLabelLeft.set(false);
    this.showLabelRight.set(false);
    this.showDownload.set(false);
    this.downloadGlow.set(false);
    this.downloadHovered.set(false);
    this.scanComplete.set(false);
  }

  private async runAnimation(): Promise<void> {
    this.resetState();
    await this.sleep(100);
    if (this.destroyed) return;

    // === STEP 1: Upload ===
    this.stepChange.emit(1);

    // Move cursor to upload button
    this.cursorTop.set(58);
    this.cursorLeft.set(50);
    await this.sleep(800);

    // Hover
    this.uploadHovered.set(true);
    await this.sleep(200);

    // Click
    this.cursorClicking.set(true);
    await this.sleep(200);
    this.cursorClicking.set(false);
    await this.sleep(200);

    // Move cursor away
    this.cursorTop.set(95);
    this.cursorLeft.set(90);

    // === STEP 2: GPU Processing ===
    this.stepChange.emit(2);

    // Switch to editor scene
    this.activeScene.set('editor');
    await this.sleep(600);

    // Start scan from left
    this.showScanline.set(true);
    this.setScanPosition(0);
    await this.sleep(50);

    // Sweep right (reveal original with filter from left)
    this.setScanPosition(100, '1.5s', 'cubic-bezier(0.8, 0, 0.2, 1)');
    await this.sleep(1400);

    // Return to center (50 = left is original with filter, right is optimized clear)
    this.setScanPosition(50, '1.2s', 'cubic-bezier(0.25, 1, 0.5, 1)');
    await this.sleep(1100);

    // Mark scan as complete
    this.scanComplete.set(true);

    // Show labels
    this.showLabelLeft.set(true);
    this.showLabelRight.set(true);
    await this.sleep(300);

    // === STEP 3: Download ===
    this.stepChange.emit(3);

    // Show download button
    this.showDownload.set(true);
    await this.sleep(400);
    this.downloadGlow.set(true);
    await this.sleep(600);

    // Move cursor to download button
    this.cursorTop.set(90);
    this.cursorLeft.set(50);
    await this.sleep(800);

    // Hover download button
    this.downloadHovered.set(true);
    await this.sleep(200);

    // Click download button
    this.cursorClicking.set(true);
    await this.sleep(150);
    this.cursorClicking.set(false);
    await this.sleep(150);

    // Hold the success state
    await this.sleep(1500);

    if (!this.destroyed) {
      this.completed.emit();
    }
  }
}
