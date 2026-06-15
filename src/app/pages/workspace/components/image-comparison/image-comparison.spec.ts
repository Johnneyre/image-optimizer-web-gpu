import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { ImageComparisonComponent } from './image-comparison';

describe('ImageComparisonComponent', () => {
  let fixture: ComponentFixture<ImageComparisonComponent>;
  let component: ImageComparisonComponent;

  beforeEach(async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );

    await TestBed.configureTestingModule({
      imports: [ImageComparisonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageComparisonComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('theme', 'dark');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should create the component', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('renders the original image when originalImageUrl is provided', async () => {
    fixture.componentRef.setInput('originalImageUrl', 'blob:original');
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const images = Array.from(host.querySelectorAll('img'));
    const original = images.find((img) => img.getAttribute('src') === 'blob:original');
    expect(original).toBeTruthy();
  });

  it('renders the processed image layer when processedImageUrl is provided', async () => {
    fixture.componentRef.setInput('originalImageUrl', 'blob:original');
    fixture.componentRef.setInput('processedImageUrl', 'blob:processed');
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const images = Array.from(host.querySelectorAll('img'));
    const processed = images.find((img) => img.getAttribute('src') === 'blob:processed');
    expect(processed).toBeTruthy();
  });

  it('exposes a single pending layer when only a processed URL exists', async () => {
    fixture.componentRef.setInput('processedImageUrl', 'blob:processed');
    await fixture.whenStable();

    const layers = component.imageLayers();
    expect(layers.length).toBe(1);
    expect(layers[0].url).toBe('blob:processed');
    expect(layers[0].fadeIn).toBe(true);
  });

  it('returns no layers when there is no processed image', async () => {
    fixture.componentRef.setInput('originalImageUrl', 'blob:original');
    await fixture.whenStable();

    expect(component.imageLayers().length).toBe(0);
  });

  it('emits clearImage when the close button is clicked', async () => {
    let emitted = false;
    component.clearImage.subscribe(() => (emitted = true));
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const closeButton = host.querySelector('button[aria-label="Cerrar imagen"]');
    expect(closeButton).toBeTruthy();
    (closeButton as HTMLButtonElement).dispatchEvent(new MouseEvent('click'));

    expect(emitted).toBe(true);
  });

  it('emits clearImage when onClearImage() is called', async () => {
    let emitted = false;
    component.clearImage.subscribe(() => (emitted = true));

    component.onClearImage();

    expect(emitted).toBe(true);
  });

  it('shows a processing indicator when isProcessing is true', async () => {
    fixture.componentRef.setInput('isProcessing', true);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('Procesando');
  });

  it('does not show the processing indicator when isProcessing is false', async () => {
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).not.toContain('Procesando');
  });

  it('starts the slider centered at 50', async () => {
    await fixture.whenStable();
    expect(component.sliderPosition()).toBe(50);
  });

  it('zoomIn and zoomOut adjust the zoom level within limits', async () => {
    await fixture.whenStable();
    expect(component.zoomLevel()).toBe(1);

    component.zoomIn();
    expect(component.zoomLevel()).toBeCloseTo(1.25, 5);

    component.zoomOut();
    expect(component.zoomLevel()).toBeCloseTo(1, 5);
  });

  it('clamps zoom out at the minimum of 0.25', async () => {
    await fixture.whenStable();

    for (let i = 0; i < 10; i++) {
      component.zoomOut();
    }
    expect(component.zoomLevel()).toBe(0.25);
  });

  it('clamps zoom in at the maximum of 4', async () => {
    await fixture.whenStable();

    for (let i = 0; i < 20; i++) {
      component.zoomIn();
    }
    expect(component.zoomLevel()).toBe(4);
  });

  it('resetView restores zoom and pan to defaults', async () => {
    await fixture.whenStable();

    component.zoomIn();
    component.zoomIn();
    component.resetView();

    expect(component.zoomLevel()).toBe(1);
    expect(component.panOffset()).toEqual({ x: 0, y: 0 });
  });

  it('updates image natural dimensions on image load', async () => {
    await fixture.whenStable();

    const img = document.createElement('img');
    Object.defineProperty(img, 'naturalWidth', { value: 800, configurable: true });
    Object.defineProperty(img, 'naturalHeight', { value: 600, configurable: true });
    const event = { target: img } as unknown as Event;

    component.onImageLoad(event);

    expect(component.imageNaturalWidth()).toBe(800);
    expect(component.imageNaturalHeight()).toBe(600);
  });

  it('transformStyle reflects the current zoom and pan', async () => {
    await fixture.whenStable();

    component.zoomIn();
    expect(component.transformStyle()).toContain('scale(1.25)');
    expect(component.transformStyle()).toContain('translate(0px, 0px)');
  });

  it('starts dragging the slider on mouse down', async () => {
    fixture.componentRef.setInput('originalImageUrl', 'blob:original');
    await fixture.whenStable();

    expect(component.isSliderDragging()).toBe(false);

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX: 100,
    } as unknown as MouseEvent;

    component.onSliderMouseDown(event);
    expect(component.isSliderDragging()).toBe(true);
  });

  it('stops dragging and panning on pointer up', async () => {
    await fixture.whenStable();

    component.isSliderDragging.set(true);
    component.isPanning.set(true);

    component.onPointerUp();

    expect(component.isSliderDragging()).toBe(false);
    expect(component.isPanning()).toBe(false);
  });
});
