import { TestBed } from '@angular/core/testing';
import { UploadZoneComponent } from './upload-zone';

function makeFile(name: string, type: string, size = 1000): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

function fileChangeEvent(files: File[]): Event {
  return { target: { files } } as unknown as Event;
}

function dropEvent(files: File[] | null): DragEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    dataTransfer: files ? { files } : null,
  } as unknown as DragEvent;
}

function dragEvent(): DragEvent {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as DragEvent;
}

describe('UploadZoneComponent', () => {
  beforeEach(async () => {
    // ImageProcessingService (providedIn root) touches Worker / URL during its
    // lifecycle; keep them harmless in jsdom.
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: ((ev: MessageEvent) => void) | null = null;
        onerror: ((ev: ErrorEvent) => void) | null = null;
        postMessage(): void {}
        addEventListener(): void {}
        removeEventListener(): void {}
        terminate(): void {}
      },
    );
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:test'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });

    await TestBed.configureTestingModule({
      imports: [UploadZoneComponent],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should create', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('emits fileSelected with the file when a valid image is chosen via the input', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    let emitted: File | undefined;
    component.fileSelected.subscribe((f) => (emitted = f));

    const file = makeFile('photo.png', 'image/png');
    component.onFileSelect(fileChangeEvent([file]));

    expect(emitted).toBe(file);
  });

  it('emits fileSelected when a valid image is dropped', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    let emitted: File | undefined;
    component.fileSelected.subscribe((f) => (emitted = f));

    const file = makeFile('photo.webp', 'image/webp');
    component.onDrop(dropEvent([file]));

    expect(emitted).toBe(file);
    expect(component.isDragging()).toBe(false);
  });

  it('ignores non-image files chosen via the input', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    let emitted: File | undefined;
    component.fileSelected.subscribe((f) => (emitted = f));

    const file = makeFile('notes.txt', 'text/plain');
    component.onFileSelect(fileChangeEvent([file]));

    expect(emitted).toBeUndefined();
  });

  it('ignores non-image files dropped', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    let emitted: File | undefined;
    component.fileSelected.subscribe((f) => (emitted = f));

    const file = makeFile('archive.zip', 'application/zip');
    component.onDrop(dropEvent([file]));

    expect(emitted).toBeUndefined();
  });

  it('does not emit when the input change carries no files', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    let emitted: File | undefined;
    component.fileSelected.subscribe((f) => (emitted = f));

    component.onFileSelect(fileChangeEvent([]));
    component.onDrop(dropEvent(null));

    expect(emitted).toBeUndefined();
  });

  it('toggles isDragging on drag over and leave', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    expect(component.isDragging()).toBe(false);

    component.onDragOver(dragEvent());
    expect(component.isDragging()).toBe(true);

    component.onDragLeave(dragEvent());
    expect(component.isDragging()).toBe(false);
  });

  it('updates the heading text when dragging', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Coloca tu imagen aquí');

    component.onDragOver(dragEvent());
    await fixture.whenStable();

    expect(host.textContent).toContain('Suelta tu imagen aquí');
  });

  it('triggerFileInput clicks the hidden file input', async () => {
    const fixture = TestBed.createComponent(UploadZoneComponent);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    const input = component.fileInput()?.nativeElement;
    expect(input).toBeTruthy();
    const clickSpy = vi.spyOn(input as HTMLInputElement, 'click');

    component.triggerFileInput();

    expect(clickSpy).toHaveBeenCalledOnce();
  });
});
