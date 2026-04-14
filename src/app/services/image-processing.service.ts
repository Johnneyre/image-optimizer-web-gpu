import { Injectable, signal, computed, OnDestroy, effect } from '@angular/core';
import { Subject, debounceTime, switchMap, from, catchError, of, filter } from 'rxjs';

// ============================================================================
// Tipos
// ============================================================================

export interface ProcessingParams {
  brightness: number;
  contrast: number;
  quality: number;
}

export interface ProcessingResult {
  imageData: Uint8Array;
  width: number;
  height: number;
  processingTimeMs: number;
}

export interface ProcessingStats {
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
  processingTimeMs: number;
}

// ============================================================================
// Servicio
// ============================================================================

@Injectable({
  providedIn: 'root',
})
export class ImageProcessingService implements OnDestroy {
  private worker: Worker | null = null;
  private requestIdCounter = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: ProcessingResult) => void;
    reject: (reason: Error) => void;
  }>();

  private processRequest$ = new Subject<{
    file: File | Blob;
    params: ProcessingParams;
  }>();

  // Signals públicos
  readonly isSupported = signal<boolean | null>(null);
  readonly isInitializing = signal(true);
  readonly isProcessing = signal(false);
  readonly adapterInfo = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);

  readonly currentFile = signal<File | null>(null);
  readonly originalImageUrl = signal<string | null>(null);
  readonly processedImageUrl = signal<string | null>(null);
  readonly processingTimeMs = signal<number>(0);

  // Parámetros reactivos
  readonly quality = signal(80);
  readonly brightness = signal(0);
  readonly contrast = signal(1);

  // Computed
  readonly isReady = computed(() => this.isSupported() === true && !this.isInitializing());
  readonly hasImage = computed(() => this.currentFile() !== null);

  readonly params = computed<ProcessingParams>(() => ({
    quality: this.quality(),
    brightness: this.brightness(),
    contrast: this.contrast(),
  }));

  readonly stats = computed<ProcessingStats | null>(() => {
    const file = this.currentFile();
    const url = this.processedImageUrl();
    const time = this.processingTimeMs();

    if (!file || !url) return null;

    const qualityFactor = this.quality() / 100;
    const estimatedSize = Math.round(file.size * qualityFactor * 0.7);

    return {
      originalSize: file.size,
      processedSize: estimatedSize,
      compressionRatio: ((file.size - estimatedSize) / file.size) * 100,
      processingTimeMs: time,
    };
  });

  constructor() {
    this.initializeWorker();
    this.setupReactiveProcessing();
  }

  private setupReactiveProcessing(): void {
    effect(() => {
      const file = this.currentFile();
      const params = this.params();
      const isReady = this.isReady();

      if (file && isReady) {
        this.processRequest$.next({ file, params });
      }
    });

    this.processRequest$
      .pipe(
        debounceTime(100),
        filter(() => this.isReady()),
        switchMap(({ file, params }) =>
          from(this.processImageInternal(file, params)).pipe(
            catchError((error) => {
              if (error.message !== 'Request cancelada') {
                this.lastError.set(error.message);
              }
              return of(null);
            })
          )
        )
      )
      .subscribe(async (result) => {
        if (result) {
          await this.updateProcessedImage(result);
        }
      });
  }

  private async initializeWorker(): Promise<void> {
    if (typeof Worker === 'undefined') {
      this.isSupported.set(false);
      this.isInitializing.set(false);
      return;
    }

    try {
      this.worker = new Worker(new URL('../workers/image-processor.worker', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      this.worker.postMessage({ type: 'init' });
    } catch (error) {
      this.isSupported.set(false);
      this.isInitializing.set(false);
    }
  }

  private handleWorkerMessage(event: MessageEvent): void {
    const data = event.data;

    switch (data.type) {
      case 'init-complete':
        this.isSupported.set(data.supported);
        this.isInitializing.set(false);
        if (data.adapterInfo) {
          this.adapterInfo.set(data.adapterInfo);
        }
        break;

      case 'result':
        this.handleProcessingResult(data);
        break;

      case 'error':
        this.handleProcessingError(data.message, data.requestId);
        break;
    }
  }

  private handleWorkerError(error: ErrorEvent): void {
    this.lastError.set(`Worker error: ${error.message}`);
    this.isProcessing.set(false);
    this.pendingRequests.forEach((req) => req.reject(new Error(error.message)));
    this.pendingRequests.clear();
  }

  private handleProcessingResult(data: {
    imageData: Uint8Array;
    width: number;
    height: number;
    processingTimeMs: number;
    requestId: number;
  }): void {
    const request = this.pendingRequests.get(data.requestId);
    if (request) {
      this.pendingRequests.delete(data.requestId);
      this.isProcessing.set(this.pendingRequests.size > 0);
      request.resolve({
        imageData: data.imageData,
        width: data.width,
        height: data.height,
        processingTimeMs: data.processingTimeMs,
      });
    }
  }

  private handleProcessingError(message: string, requestId?: number): void {
    if (requestId !== undefined) {
      const request = this.pendingRequests.get(requestId);
      if (request) {
        this.pendingRequests.delete(requestId);
        request.reject(new Error(message));
      }
    }
    this.isProcessing.set(this.pendingRequests.size > 0);
  }

  private async updateProcessedImage(result: ProcessingResult): Promise<void> {
    console.log('[Service] updateProcessedImage', { width: result.width, height: result.height, dataLength: result.imageData.length });

    // Liberar URL anterior
    const oldUrl = this.processedImageUrl();
    if (oldUrl && oldUrl.startsWith('blob:')) {
      URL.revokeObjectURL(oldUrl);
    }

    // Crear ImageData y renderizar en canvas
    const canvas = document.createElement('canvas');
    canvas.width = result.width;
    canvas.height = result.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('[Service] No se pudo crear contexto 2D');
      return;
    }

    const imageData = new ImageData(
      new Uint8ClampedArray(result.imageData),
      result.width,
      result.height
    );
    ctx.putImageData(imageData, 0, 0);

    console.log('[Service] ImageData aplicada al canvas');

    // Generar URL usando promesa
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png');
    });

    if (blob) {
      const url = URL.createObjectURL(blob);
      console.log('[Service] URL creada:', url, 'blob size:', blob.size);
      this.processedImageUrl.set(url);
      this.processingTimeMs.set(result.processingTimeMs);
    } else {
      console.error('[Service] toBlob devolvió null');
    }
  }

  // API Pública
  async setFile(file: File): Promise<void> {
    this.clearFile();

    if (!file.type.startsWith('image/')) {
      this.lastError.set('El archivo no es una imagen válida');
      return;
    }

    this.currentFile.set(file);
    this.originalImageUrl.set(URL.createObjectURL(file));
    this.lastError.set(null);
  }

  setQuality(value: number): void {
    this.quality.set(Math.max(1, Math.min(100, value)));
  }

  setBrightness(value: number): void {
    this.brightness.set(Math.max(-1, Math.min(1, value)));
  }

  setContrast(value: number): void {
    this.contrast.set(Math.max(0, Math.min(2, value)));
  }

  resetAdjustments(): void {
    this.quality.set(80);
    this.brightness.set(0);
    this.contrast.set(1);
  }

  clearFile(): void {
    const url = this.originalImageUrl();
    if (url) URL.revokeObjectURL(url);

    const processedUrl = this.processedImageUrl();
    if (processedUrl && processedUrl.startsWith('blob:')) {
      URL.revokeObjectURL(processedUrl);
    }

    this.cancelAllRequests();

    this.currentFile.set(null);
    this.originalImageUrl.set(null);
    this.processedImageUrl.set(null);
    this.processingTimeMs.set(0);
    this.lastError.set(null);
  }

  async generateDownloadBlob(
    format: 'image/webp' | 'image/png' | 'image/jpeg' = 'image/webp',
    quality: number = 0.85
  ): Promise<Blob> {
    const url = this.processedImageUrl();
    if (!url) throw new Error('No hay imagen procesada');

    const response = await fetch(url);
    const blob = await response.blob();

    // Si ya es el formato correcto, retornar
    if (format === 'image/png') return blob;

    // Convertir a otro formato
    const img = new Image();
    img.src = url;
    await new Promise((resolve) => (img.onload = resolve));

    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear contexto');

    ctx.drawImage(img, 0, 0);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Error generando blob'))),
        format,
        quality
      );
    });
  }

  private async processImageInternal(
    file: File | Blob,
    params: ProcessingParams
  ): Promise<ProcessingResult> {
    if (!this.worker || !this.isReady()) {
      throw new Error('Servicio no inicializado');
    }

    const requestId = ++this.requestIdCounter;
    this.isProcessing.set(true);
    this.lastError.set(null);

    const imageBitmap = await createImageBitmap(file);

    return new Promise<ProcessingResult>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.worker!.postMessage(
        {
          type: 'process',
          imageBitmap,
          operation: 'quality',
          params,
          requestId,
        },
        [imageBitmap]
      );
    });
  }

  private cancelAllRequests(): void {
    this.pendingRequests.forEach((req) => req.reject(new Error('Request cancelada')));
    this.pendingRequests.clear();
    this.isProcessing.set(false);

    if (this.worker) {
      this.worker.postMessage({ type: 'cancel', requestId: this.requestIdCounter + 1 });
    }
  }

  ngOnDestroy(): void {
    this.clearFile();
    this.processRequest$.complete();

    if (this.worker) {
      this.worker.postMessage({ type: 'destroy' });
      this.worker.terminate();
    }
  }
}
