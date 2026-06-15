import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { LandingPage } from './landing';

describe('LandingPage', () => {
  beforeEach(async () => {
    // setFile() -> URL.createObjectURL; clearFile() -> URL.revokeObjectURL.
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:test'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
    });

    // ImageProcessingService is providedIn: 'root' and constructs a Worker on init.
    vi.stubGlobal(
      'Worker',
      class {
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: ((event: ErrorEvent) => void) | null = null;
        postMessage(): void {}
        addEventListener(): void {}
        removeEventListener(): void {}
        terminate(): void {}
      },
    );

    await TestBed.configureTestingModule({
      imports: [LandingPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should create the component', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('navigates to /workspace after a file is selected', async () => {
    const fixture = TestBed.createComponent(LandingPage);
    const component = fixture.componentInstance;
    await fixture.whenStable();

    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const file = new File([new ArrayBuffer(10)], 'p.png', { type: 'image/png' });
    await component.onFileSelected(file);

    expect(nav).toHaveBeenCalledWith(['/workspace']);
  });
});
