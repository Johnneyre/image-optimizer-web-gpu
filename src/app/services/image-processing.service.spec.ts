import { TestBed } from '@angular/core/testing';
import { ImageProcessingService } from './image-processing.service';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;

  // jsdom does not implement these, so capture the originals (likely undefined)
  // to restore them in afterEach and avoid leaking stubs to other test files.
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');

  const makeImageFile = (name = 'photo.png', type = 'image/png'): File =>
    new File([new ArrayBuffer(1000)], name, { type });

  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:test'),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });

    TestBed.configureTestingModule({ providers: [ImageProcessingService] });
    service = TestBed.inject(ImageProcessingService);
  });

  afterEach(() => {
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL);
    } else {
      delete (URL as { createObjectURL?: unknown }).createObjectURL;
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', originalRevokeObjectURL);
    } else {
      delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
    }

    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should create the service', () => {
    expect(service).toBeTruthy();
  });

  describe('worker unavailability in jsdom', () => {
    it('reports unsupported and not initializing/ready', () => {
      // jsdom has no Worker, so initializeWorker() sets these synchronously
      expect(service.isSupported()).toBe(false);
      expect(service.isInitializing()).toBe(false);
      expect(service.isReady()).toBe(false);
    });
  });

  describe('setQuality', () => {
    it('clamps below the minimum to 1', () => {
      service.setQuality(-50);
      expect(service.quality()).toBe(1);
    });

    it('clamps above the maximum to 100', () => {
      service.setQuality(500);
      expect(service.quality()).toBe(100);
    });

    it('keeps an in-range value', () => {
      service.setQuality(42);
      expect(service.quality()).toBe(42);
    });
  });

  describe('setBrightness', () => {
    it('clamps below the minimum to -1', () => {
      service.setBrightness(-5);
      expect(service.brightness()).toBe(-1);
    });

    it('clamps above the maximum to 1', () => {
      service.setBrightness(5);
      expect(service.brightness()).toBe(1);
    });

    it('keeps an in-range value', () => {
      service.setBrightness(0.25);
      expect(service.brightness()).toBe(0.25);
    });
  });

  describe('setContrast', () => {
    it('clamps below the minimum to 0', () => {
      service.setContrast(-3);
      expect(service.contrast()).toBe(0);
    });

    it('clamps above the maximum to 2', () => {
      service.setContrast(10);
      expect(service.contrast()).toBe(2);
    });

    it('keeps an in-range value', () => {
      service.setContrast(1.5);
      expect(service.contrast()).toBe(1.5);
    });
  });

  describe('resetAdjustments', () => {
    it('restores quality=80, brightness=0, contrast=1', () => {
      service.setQuality(10);
      service.setBrightness(0.5);
      service.setContrast(1.7);

      service.resetAdjustments();

      expect(service.quality()).toBe(80);
      expect(service.brightness()).toBe(0);
      expect(service.contrast()).toBe(1);
    });
  });

  describe('setOutputFormat', () => {
    it('defaults to image/webp', () => {
      expect(service.outputFormat()).toBe('image/webp');
    });

    it('updates the output format', () => {
      service.setOutputFormat('image/jpeg');
      expect(service.outputFormat()).toBe('image/jpeg');
    });
  });

  describe('params computed', () => {
    it('reflects the current quality, brightness and contrast', () => {
      service.setQuality(55);
      service.setBrightness(0.3);
      service.setContrast(1.2);

      expect(service.params()).toEqual({
        quality: 55,
        brightness: 0.3,
        contrast: 1.2,
      });
    });
  });

  describe('hasImageAdjustments computed', () => {
    it('is false at default brightness=0 and contrast=1', () => {
      expect(service.hasImageAdjustments()).toBe(false);
    });

    it('is true when brightness differs from 0', () => {
      service.setBrightness(0.1);
      expect(service.hasImageAdjustments()).toBe(true);
    });

    it('is true when contrast differs from 1', () => {
      service.setContrast(1.4);
      expect(service.hasImageAdjustments()).toBe(true);
    });
  });

  describe('hasImage computed', () => {
    it('is false with no current file', () => {
      expect(service.hasImage()).toBe(false);
    });
  });

  describe('stats computed', () => {
    it('is null when there is no file', () => {
      expect(service.stats()).toBeNull();
    });
  });

  describe('setFile', () => {
    it('rejects a non-image file', async () => {
      const textFile = new File([new ArrayBuffer(1000)], 'notes.txt', {
        type: 'text/plain',
      });

      await service.setFile(textFile);

      expect(service.currentFile()).toBeNull();
      expect(service.originalImageUrl()).toBeNull();
      expect(service.lastError()).toBe('El archivo no es una imagen válida');
    });

    it('accepts an image file and sets the original URL', async () => {
      const file = makeImageFile();

      await service.setFile(file);

      expect(service.currentFile()).toBe(file);
      expect(service.originalImageUrl()).toBe('blob:test');
      expect(service.lastError()).toBeNull();
      expect(service.hasImage()).toBe(true);
    });
  });

  describe('clearFile', () => {
    it('resets file and adjustment signals back to defaults', async () => {
      await service.setFile(makeImageFile());
      service.setQuality(20);
      service.setBrightness(0.4);
      service.setContrast(0.8);
      service.setOutputFormat('image/jpeg');

      service.clearFile();

      expect(service.currentFile()).toBeNull();
      expect(service.originalImageUrl()).toBeNull();
      expect(service.processedImageUrl()).toBeNull();
      expect(service.quality()).toBe(80);
      expect(service.brightness()).toBe(0);
      expect(service.contrast()).toBe(1);
      expect(service.outputFormat()).toBe('image/webp');
      expect(service.hasImage()).toBe(false);
    });
  });

  describe('generateDownloadBlob', () => {
    it('rejects when there is no processed image or worker', async () => {
      // No file, no worker cache and no worker -> falls through to the throw
      await expect(service.generateDownloadBlob()).rejects.toThrow('No hay imagen procesada');
    });
  });
});
