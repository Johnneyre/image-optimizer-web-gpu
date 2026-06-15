import { TestBed } from '@angular/core/testing';
import type { DownloadFormat, DownloadRequest } from '@types';
import { SidebarControlsComponent } from './sidebar-controls';

describe('SidebarControlsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarControlsComponent],
    }).compileComponents();
  });

  async function createComponent() {
    const fixture = TestBed.createComponent(SidebarControlsComponent);
    fixture.componentRef.setInput('theme', 'dark');
    fixture.componentRef.setInput('fileName', 'photo.png');
    fixture.componentRef.setInput('originalSize', '1.0 MB');
    fixture.componentRef.setInput('processedSize', '400 KB');
    fixture.componentRef.setInput('sizeDifference', {
      bytes: '600 KB',
      percent: '-60%',
      isReduction: true,
    });
    fixture.componentRef.setInput('processingTime', '120 ms');
    fixture.componentRef.setInput('quality', 80);
    fixture.componentRef.setInput('brightness', 0);
    fixture.componentRef.setInput('contrast', 1);
    fixture.componentRef.setInput('outputFormat', 'image/webp');
    fixture.componentRef.setInput('isProcessing', false);
    fixture.componentRef.setInput('hasProcessedImage', true);
    fixture.componentRef.setInput('canDownload', true);
    fixture.componentRef.setInput('hasStats', true);
    await fixture.whenStable();
    return fixture;
  }

  it('should create with required inputs set', async () => {
    const fixture = await createComponent();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('emits qualityChange when the quality handler fires', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: number | undefined;
    component.qualityChange.subscribe((v) => (emitted = v));

    const input = document.createElement('input');
    input.value = '55';
    component.onQualityChange({ target: input } as unknown as Event);

    expect(emitted).toBe(55);
  });

  it('emits brightnessChange when the brightness handler fires', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: number | undefined;
    component.brightnessChange.subscribe((v) => (emitted = v));

    const input = document.createElement('input');
    input.value = '0.25';
    component.onBrightnessChange({ target: input } as unknown as Event);

    expect(emitted).toBe(0.25);
  });

  it('emits contrastChange when the contrast handler fires', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: number | undefined;
    component.contrastChange.subscribe((v) => (emitted = v));

    const input = document.createElement('input');
    input.value = '1.5';
    component.onContrastChange({ target: input } as unknown as Event);

    expect(emitted).toBe(1.5);
  });

  it('emits presetSelect when a preset is chosen', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: number | undefined;
    component.presetSelect.subscribe((v) => (emitted = v));

    component.onSelectPreset(30);

    expect(emitted).toBe(30);
  });

  it('emits formatChange and updates local format when format changes', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: DownloadFormat | undefined;
    component.formatChange.subscribe((v) => (emitted = v));

    component.onFormatChange('image/jpeg');

    expect(emitted).toBe('image/jpeg');
    expect(component.selectedFormat()).toBe('image/jpeg');
    expect(component.formatExtension()).toBe('.jpg');
  });

  it('emits resetAdjustments when reset is triggered', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted = false;
    component.resetAdjustments.subscribe(() => (emitted = true));

    component.onResetAdjustments();

    expect(emitted).toBe(true);
  });

  it('emits downloadRequested with selected format and normalized quality', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    let emitted: DownloadRequest | undefined;
    component.downloadRequested.subscribe((v) => (emitted = v));

    component.onDownload();

    expect(emitted).toEqual({ format: 'image/webp', quality: 0.8 });
  });

  it('syncs selectedPreset with the quality input', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.selectedPreset()).toBe(80);

    fixture.componentRef.setInput('quality', 60);
    await fixture.whenStable();
    expect(component.selectedPreset()).toBe(60);

    // Non-preset value clears the selection.
    fixture.componentRef.setInput('quality', 73);
    await fixture.whenStable();
    expect(component.selectedPreset()).toBeNull();
  });

  it('reflects hasActiveAdjustments from brightness/contrast', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.hasActiveAdjustments()).toBe(false);

    fixture.componentRef.setInput('brightness', 0.5);
    await fixture.whenStable();
    expect(component.hasActiveAdjustments()).toBe(true);
  });

  it('blocks controls only while processing without a processed image', async () => {
    const fixture = await createComponent();
    const component = fixture.componentInstance;
    expect(component.shouldBlockControls()).toBe(false);

    fixture.componentRef.setInput('isProcessing', true);
    fixture.componentRef.setInput('hasProcessedImage', false);
    await fixture.whenStable();
    expect(component.shouldBlockControls()).toBe(true);
  });

  it('renders file name and size stats from inputs', async () => {
    const fixture = await createComponent();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('photo.png');
    expect(text).toContain('1.0 MB');
    expect(text).toContain('400 KB');
    expect(text).toContain('-60%');
    expect(text).toContain('80%');
  });
});
