import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

interface LocalStorageStub {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
}

describe('ThemeService', () => {
  let storage: LocalStorageStub;

  beforeEach(() => {
    storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', storage);
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should be created', () => {
    const service = TestBed.inject(ThemeService);
    expect(service).toBeTruthy();
  });

  it('should default theme to dark (matchMedia absent in jsdom)', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.theme()).toBe('dark');
  });

  it('isDark()/isLight() should reflect the default dark theme', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.isDark()).toBe(true);
    expect(service.isLight()).toBe(false);
  });

  it('toggle() should flip dark -> light', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.theme()).toBe('light');
    expect(service.isLight()).toBe(true);
    expect(service.isDark()).toBe(false);
  });

  it('toggle() should flip back light -> dark', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    service.toggle();
    expect(service.theme()).toBe('dark');
    expect(service.isDark()).toBe(true);
  });

  it('should persist theme changes to localStorage via the effect', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(storage.setItem).toHaveBeenCalledWith('theme', 'dark');

    storage.setItem.mockClear();
    service.toggle();
    TestBed.tick();
    expect(storage.setItem).toHaveBeenCalledWith('theme', 'light');
  });
});
