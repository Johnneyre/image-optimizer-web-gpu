import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { DownloadOverlayComponent } from './download-overlay';

describe('DownloadOverlayComponent', () => {
  let fixture: ComponentFixture<DownloadOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DownloadOverlayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DownloadOverlayComponent);
    fixture.componentRef.setInput('theme', 'dark');
  });

  it('should create', async () => {
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the loader overlay when isVisible is true', async () => {
    fixture.componentRef.setInput('isVisible', true);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const icon = host.querySelector('lucide-icon');
    expect(icon).not.toBeNull();
    expect(host.textContent).toContain('Generando imagen optimizada');
    expect(host.textContent).toContain('Procesando con WebGPU');
  });

  it('hides the overlay when isVisible is false (default)', async () => {
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lucide-icon')).toBeNull();
    expect(host.textContent).not.toContain('Generando imagen optimizada');
  });

  it('toggles the overlay when isVisible changes', async () => {
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('lucide-icon')).toBeNull();

    fixture.componentRef.setInput('isVisible', true);
    await fixture.whenStable();
    expect(host.querySelector('lucide-icon')).not.toBeNull();

    fixture.componentRef.setInput('isVisible', false);
    await fixture.whenStable();
    expect(host.querySelector('lucide-icon')).toBeNull();
  });

  it('applies the dark theme background when visible', async () => {
    fixture.componentRef.setInput('theme', 'dark');
    fixture.componentRef.setInput('isVisible', true);
    await fixture.whenStable();

    const overlay = (fixture.nativeElement as HTMLElement).querySelector('div');
    expect(overlay?.className).toContain('bg-slate-950/85');
  });

  it('applies the light theme background when visible', async () => {
    fixture.componentRef.setInput('theme', 'light');
    fixture.componentRef.setInput('isVisible', true);
    await fixture.whenStable();

    const overlay = (fixture.nativeElement as HTMLElement).querySelector('div');
    expect(overlay?.className).toContain('bg-white/85');
  });
});
