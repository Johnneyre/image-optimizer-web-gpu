import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { WorkspacePage } from './workspace';
import { ImageProcessingService } from '@services/image-processing.service';

function makeFile(size: number, name = 'photo.png', type = 'image/png'): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

describe('WorkspacePage', () => {
  let svc: ImageProcessingService;

  beforeEach(async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:test'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });

    await TestBed.configureTestingModule({
      imports: [WorkspacePage],
      providers: [provideRouter([])],
    }).compileComponents();

    svc = TestBed.inject(ImageProcessingService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create the page', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('fileName() reflects the current file name and is null when no file', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    expect(component.fileName()).toBeNull();

    svc.currentFile.set(makeFile(1000, 'sunset.png'));
    expect(component.fileName()).toBe('sunset.png');
  });

  it('originalSize() is a human-readable string derived from the file size', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    expect(component.originalSize()).toBeNull();

    svc.currentFile.set(makeFile(1024));
    expect(component.originalSize()).toBe('1 KB');
  });

  it('processedSize() formats the processed blob size from stats', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    expect(component.processedSize()).toBeNull();

    svc.currentFile.set(makeFile(1024));
    svc.processedImageUrl.set('blob:x');
    svc.processedBlobSize.set(512);

    expect(component.processedSize()).toBe('512 B');
  });

  it('sizeDifference() reports a reduction with a negative percent label', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    svc.currentFile.set(makeFile(1000));
    svc.processedImageUrl.set('blob:x');
    svc.processedBlobSize.set(200);

    const diff = component.sizeDifference();
    expect(diff).not.toBeNull();
    expect(diff?.isReduction).toBe(true);
    expect(diff?.percent.startsWith('-')).toBe(true);
    expect(diff?.bytes).toBe('800 B');
  });

  it('sizeDifference() reports an increase with a positive percent label', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    svc.currentFile.set(makeFile(200));
    svc.processedImageUrl.set('blob:x');
    svc.processedBlobSize.set(1000);

    const diff = component.sizeDifference();
    expect(diff).not.toBeNull();
    expect(diff?.isReduction).toBe(false);
    expect(diff?.percent.startsWith('+')).toBe(true);
    expect(diff?.bytes).toBe('800 B');
  });

  it('sizeDifference() reports 0% when original and processed sizes are equal', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    svc.currentFile.set(makeFile(500));
    svc.processedImageUrl.set('blob:x');
    svc.processedBlobSize.set(500);

    const diff = component.sizeDifference();
    expect(diff).not.toBeNull();
    expect(diff?.isReduction).toBe(false);
    expect(diff?.percent).toBe('0%');
    expect(diff?.bytes).toBe('0 B');
  });

  it('sizeDifference() is null without complete stats', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    expect(fixture.componentInstance.sizeDifference()).toBeNull();
  });

  it('processingTime() returns an "Xms" string or null when zero', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    expect(component.processingTime()).toBeNull();

    svc.processingTimeMs.set(12.3);
    expect(component.processingTime()).toBe('12.3ms');
  });

  it('hasStats() is true only when stats are available', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    expect(component.hasStats()).toBe(false);

    svc.currentFile.set(makeFile(1000));
    svc.processedImageUrl.set('blob:x');
    svc.processedBlobSize.set(200);

    expect(component.hasStats()).toBe(true);
  });

  it('canDownload() is true when a processed url exists and not processing', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;

    expect(component.canDownload()).toBe(false);

    svc.processedImageUrl.set('blob:x');
    expect(component.canDownload()).toBe(true);

    svc.isProcessing.set(true);
    expect(component.canDownload()).toBe(false);
  });

  it('clearImage() clears the service file and navigates home', () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const clearSpy = vi.spyOn(svc, 'clearFile');

    svc.currentFile.set(makeFile(1000));
    component.clearImage();

    expect(clearSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
    expect(svc.currentFile()).toBeNull();
  });

  it('onDownloadRequested() returns early and leaves isDownloading false when there is no file', async () => {
    const fixture = TestBed.createComponent(WorkspacePage);
    const component = fixture.componentInstance;
    const generateSpy = vi.spyOn(svc, 'generateDownloadBlob');

    expect(component.fileName()).toBeNull();

    await component.onDownloadRequested({ format: 'image/webp', quality: 0.85 });

    expect(component.isDownloading()).toBe(false);
    expect(generateSpy).not.toHaveBeenCalled();
  });
});
