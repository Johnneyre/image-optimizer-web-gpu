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
  readonly processedBlobSize = signal<number>(0);

  // Formato de salida seleccionado
  readonly outputFormat = signal<DownloadFormat>('image/webp');

  // Parámetros de imagen usados en el último procesamiento GPU
  private lastGpuParams: { brightness: number; contrast: number } | null = null;
  // Track if worker has cached RGBA data
  private workerHasCache = false;
  // URL procesada anterior: sigue visible como capa base durante el fade-in,
  // así que se revoca recién cuando llega el siguiente resultado
  private staleProcessedUrl: string | null = null;

  // Parámetros reactivos
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
          // CASO ESPECIAL: quality=100% sin ajustes → usar archivo original.
          // Pasa por el mismo pipeline para que el debounce descarte requests
          // intermedias (p.ej. quality=99 al arrastrar el slider hasta 100).
          const useOriginal = params.quality === 100 && !hasAdjustments;

          // Detectar si necesitamos GPU o solo re-encoding
          const gpuParamsChanged =
            this.lastGpuParams?.brightness !== params.brightness ||
            this.lastGpuParams.contrast !== params.contrast;

          const needsGpu = gpuParamsChanged || !this.workerHasCache;

          // Activate processing state immediately to prevent UI flash
          this.isProcessing.set(true);

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

  // Revoca la URL procesada de hace dos resultados y marca la actual como "stale".
  // La actual no se revoca aún porque el visor la mantiene como capa base del fade-in.
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

    // Crear blob desde ArrayBuffer recibido del worker
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

    // Liberar el cache RGBA y los buffers GPU retenidos en el worker
    this.worker?.postMessage({ type: 'clear-cache' });

    this.currentFile.set(null);
    this.originalImageUrl.set(null);
    this.processedImageUrl.set(null);
    this.processingTimeMs.set(0);
    this.processedBlobSize.set(0);
    this.lastError.set(null);
    this.lastGpuParams = null;
    this.workerHasCache = false;

    // Resetear ajustes a valores por defecto
    this.quality.set(80);
    this.brightness.set(0);
    this.contrast.set(1);
    this.outputFormat.set('image/webp');
  }

  async generateDownloadBlob(
    format: DownloadFormat = 'image/webp',
    quality: number = 0.85,
  ): Promise<Blob> {
    // Si estamos usando el archivo original (quality=100% sin ajustes)
    const file = this.currentFile();
    if (!this.workerHasCache && file && this.worker) {
      // El formato del archivo ya coincide con el solicitado: descargar tal cual
      if (file.type === format) {
        return file;
      }

      // Formato distinto: convertir el original en el worker (sin GPU)
      const imageBitmap = await createImageBitmap(file);
      return this.requestWorkerBlob(
        { type: 'encode-file', imageBitmap, outputFormat: format, outputQuality: quality },
        [imageBitmap],
      );
    }

    // Si hay cache en el worker, pedir re-encode con los parámetros de descarga
    if (this.workerHasCache && this.worker) {
      return this.requestWorkerBlob({
        type: 'encode',
        outputFormat: format,
        outputQuality: quality,
      });
    }

    throw new Error('No hay imagen procesada');
  }

  // Envía un mensaje de encoding al worker con un listener efímero que resuelve
  // con el blob resultante (independiente del pipeline reactivo de pendingRequests)
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
