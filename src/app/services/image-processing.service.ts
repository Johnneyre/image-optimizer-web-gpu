import { Injectable, signal, computed, OnDestroy, effect, untracked } from '@angular/core';
import { Subject, debounceTime, switchMap, from, catchError, of, filter } from 'rxjs';
import type { ProcessingParams, ProcessingStats, DownloadFormat } from '@types';
import type { ProcessResult, WorkerProcessResult } from '../types/worker.types';

@Injectable({
  providedIn: 'root',
})
export class ImageProcessingService implements OnDestroy {
  private worker: Worker | null = null;
  private requestIdCounter = 0;
  private readonly pendingRequests = new Map<
    number,
    {
      resolve: (value: WorkerProcessResult) => void;
      reject: (reason: Error) => void;
    }
  >();

  private readonly processRequest$ = new Subject<{
    file: File;
    params: ProcessingParams;
    needsGpu: boolean;
    useOriginal: boolean;
  }>();

  // Public signals
  readonly isSupported = signal<boolean | null>(null);
  readonly isInitializing = signal(true);
  readonly isProcessing = signal(false);
  readonly adapterInfo = signal<string | null>(null);
  readonly lastError = signal<string | null>(null);

  readonly currentFile = signal<File | null>(null);
  readonly originalImageUrl = signal<string | null>(null);
  readonly processedImageUrl = signal<string | null>(null);
  readonly processingTimeMs = signal<number>(0);
  readonly processedBlobSize = signal<number>(0);

  // Selected output format
  readonly outputFormat = signal<DownloadFormat>('image/webp');

  // Image params used in the last GPU processing
  private lastGpuParams: { brightness: number; contrast: number } | null = null;
  // Track if worker has cached RGBA data
  private workerHasCache = false;
  // Previous processed URL: stays visible as the base layer during the fade-in,
  // so it's revoked only when the next result arrives
  private staleProcessedUrl: string | null = null;

  // Reactive params
  readonly quality = signal(80);
  readonly brightness = signal(0);
  readonly contrast = signal(1);

  // Computed
  readonly isReady = computed(() => this.isSupported() === true && !this.isInitializing());
  readonly hasImage = computed(() => this.currentFile() !== null);

  readonly hasImageAdjustments = computed(() => {
    const b = this.brightness();
    const c = this.contrast();
    return b !== 0 || c !== 1;
  });

  readonly params = computed<ProcessingParams>(() => ({
    quality: this.quality(),
    brightness: this.brightness(),
    contrast: this.contrast(),
  }));

  readonly stats = computed<ProcessingStats | null>(() => {
    const file = this.currentFile();
    const url = this.processedImageUrl();
    const time = this.processingTimeMs();
    const processedSize = this.processedBlobSize();

    if (!file || !url || processedSize === 0) return null;

    const diff = file.size - processedSize;

    return {
      originalSize: file.size,
      processedSize: processedSize,
      compressionRatio: (diff / file.size) * 100,
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
      const hasAdjustments = this.hasImageAdjustments();

      // Track outputFormat so format changes trigger re-processing
      this.outputFormat();

      if (file && isReady) {
        untracked(() => {
          // SPECIAL CASE: quality=100% with no adjustments → use the original file.
          // Goes through the same pipeline so the debounce drops intermediate
          // requests (e.g. quality=99 while dragging the slider up to 100).
          const useOriginal = params.quality === 100 && !hasAdjustments;

          // Detect whether we need GPU or just re-encoding
          const gpuParamsChanged =
            this.lastGpuParams?.brightness !== params.brightness ||
            this.lastGpuParams.contrast !== params.contrast;

          const needsGpu = gpuParamsChanged || !this.workerHasCache;

          // isProcessing is set in processInternal, after the debounce:
          // moving a slider doesn't show "Procesando" until the real work starts
          this.processRequest$.next({ file, params, needsGpu, useOriginal });
        });
      }
    });

    this.processRequest$
      .pipe(
        debounceTime(300),
        filter(() => this.isReady()),
        switchMap(({ file, params, needsGpu, useOriginal }) => {
          if (useOriginal) {
            this.useOriginalFile(file);
            this.isProcessing.set(this.pendingRequests.size > 0);
            return of(null);
          }
          return from(this.processInternal(file, params, needsGpu)).pipe(
            catchError((error) => {
              if (error.message !== 'Request cancelada') {
                this.lastError.set(error.message);
              }
              this.isProcessing.set(this.pendingRequests.size > 0);
              return of(null);
            }),
          );
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.updateFromWorkerResult(result);
        }
      });
  }

  private useOriginalFile(file: File): void {
    this.rotateStaleProcessedUrl();

    this.lastGpuParams = null;
    this.workerHasCache = false;

    const url = URL.createObjectURL(file);
    this.processedImageUrl.set(url);
    this.processedBlobSize.set(file.size);
    this.processingTimeMs.set(0);
  }

  // Revokes the processed URL from two results ago and marks the current one as "stale".
  // The current one isn't revoked yet because the viewer keeps it as the fade-in base layer.
  private rotateStaleProcessedUrl(): void {
    if (this.staleProcessedUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.staleProcessedUrl);
    }
    this.staleProcessedUrl = this.processedImageUrl();
  }

  private initializeWorker(): void {
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
    } catch {
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
        this.handleProcessingResult(data as ProcessResult);
        break;

      case 'cancelled':
        this.handleRequestCancelled(data.requestId);
        break;

      case 'error':
        this.handleProcessingError(data.message, data.requestId);
        break;
    }
  }

  private handleRequestCancelled(requestId: number): void {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      this.pendingRequests.delete(requestId);
      request.reject(new Error('Request cancelada'));
    }
    this.isProcessing.set(this.pendingRequests.size > 0);
  }

  private handleWorkerError(error: ErrorEvent): void {
    this.lastError.set(`Worker error: ${error.message}`);
    this.isProcessing.set(false);
    this.pendingRequests.forEach((req) => req.reject(new Error(error.message)));
    this.pendingRequests.clear();
  }

  private handleProcessingResult(data: ProcessResult): void {
    const request = this.pendingRequests.get(data.requestId);
    if (request) {
      this.pendingRequests.delete(data.requestId);
      this.isProcessing.set(this.pendingRequests.size > 0);
      request.resolve({
        blobData: data.blobData,
        blobType: data.blobType,
        blobSize: data.blobSize,
        width: data.width,
        height: data.height,
        processingTimeMs: data.processingTimeMs,
        encodingTimeMs: data.encodingTimeMs,
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

  private updateFromWorkerResult(result: WorkerProcessResult): void {
    this.rotateStaleProcessedUrl();

    // Build a blob from the ArrayBuffer received from the worker
    const blob = new Blob([result.blobData], { type: result.blobType });
    const url = URL.createObjectURL(blob);

    this.processedImageUrl.set(url);
    this.processedBlobSize.set(result.blobSize);
    this.processingTimeMs.set(result.processingTimeMs + result.encodingTimeMs);
  }

  private async processInternal(
    file: File | Blob,
    params: ProcessingParams,
    needsGpu: boolean,
  ): Promise<WorkerProcessResult> {
    if (!this.worker || !this.isReady()) {
      throw new Error('Servicio no inicializado');
    }

    const requestId = ++this.requestIdCounter;
    this.isProcessing.set(true);
    this.lastError.set(null);

    const format = this.outputFormat();
    const outputQuality = params.quality / 100;

    if (needsGpu) {
      // Full GPU processing + encoding
      const imageBitmap = await createImageBitmap(file);

      return new Promise<WorkerProcessResult>((resolve, reject) => {
        this.pendingRequests.set(requestId, {
          resolve: (result) => {
            // Update tracking
            this.lastGpuParams = {
              brightness: params.brightness,
              contrast: params.contrast,
            };
            this.workerHasCache = true;
            resolve(result);
          },
          reject,
        });

        this.worker!.postMessage(
          {
            type: 'process',
            imageBitmap,
            operation: 'quality',
            params,
            outputFormat: format,
            outputQuality,
            requestId,
          },
          [imageBitmap],
        );
      });
    } else {
      // Re-encode only (no GPU) - worker uses cached RGBA
      return new Promise<WorkerProcessResult>((resolve, reject) => {
        this.pendingRequests.set(requestId, { resolve, reject });

        this.worker!.postMessage({
          type: 'encode',
          outputFormat: format,
          outputQuality,
          requestId,
        });
      });
    }
  }

  // Public API
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

  setOutputFormat(format: DownloadFormat): void {
    this.outputFormat.set(format);
  }

  clearFile(): void {
    const url = this.originalImageUrl();
    if (url) URL.revokeObjectURL(url);

    const processedUrl = this.processedImageUrl();
    if (processedUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(processedUrl);
    }

    if (this.staleProcessedUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(this.staleProcessedUrl);
    }
    this.staleProcessedUrl = null;

    this.cancelAllRequests();

    // Release the RGBA cache and GPU buffers held by the worker
    this.worker?.postMessage({ type: 'clear-cache' });

    this.currentFile.set(null);
    this.originalImageUrl.set(null);
    this.processedImageUrl.set(null);
    this.processingTimeMs.set(0);
    this.processedBlobSize.set(0);
    this.lastError.set(null);
    this.lastGpuParams = null;
    this.workerHasCache = false;

    // Reset adjustments to defaults
    this.quality.set(80);
    this.brightness.set(0);
    this.contrast.set(1);
    this.outputFormat.set('image/webp');
  }

  async generateDownloadBlob(
    format: DownloadFormat = 'image/webp',
    quality: number = 0.85,
  ): Promise<Blob> {
    // If we're using the original file (quality=100% with no adjustments)
    const file = this.currentFile();
    if (!this.workerHasCache && file && this.worker) {
      // The file format already matches the requested one: download as-is
      if (file.type === format) {
        return file;
      }

      // Different format: convert the original in the worker (no GPU)
      const imageBitmap = await createImageBitmap(file);
      return this.requestWorkerBlob(
        { type: 'encode-file', imageBitmap, outputFormat: format, outputQuality: quality },
        [imageBitmap],
      );
    }

    // If the worker has a cache, request a re-encode with the download params
    if (this.workerHasCache && this.worker) {
      return this.requestWorkerBlob({
        type: 'encode',
        outputFormat: format,
        outputQuality: quality,
      });
    }

    throw new Error('No hay imagen procesada');
  }

  // Sends an encoding message to the worker with an ephemeral listener that resolves
  // with the resulting blob (independent of the reactive pendingRequests pipeline)
  private requestWorkerBlob(
    message: Record<string, unknown>,
    transfer: Transferable[] = [],
  ): Promise<Blob> {
    const requestId = ++this.requestIdCounter;

    return new Promise<Blob>((resolve, reject) => {
      const handler = (event: MessageEvent) => {
        const data = event.data;
        if (data.requestId !== requestId) return;

        if (data.type === 'result') {
          this.worker!.removeEventListener('message', handler);
          resolve(new Blob([data.blobData], { type: data.blobType }));
        } else if (data.type === 'error') {
          this.worker!.removeEventListener('message', handler);
          reject(new Error(data.message));
        } else if (data.type === 'cancelled') {
          this.worker!.removeEventListener('message', handler);
          reject(new Error('Request cancelada'));
        }
      };

      this.worker!.addEventListener('message', handler);
      this.worker!.postMessage({ ...message, requestId }, transfer);
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
