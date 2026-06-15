import { TestBed } from '@angular/core/testing';
import { SiteFooterComponent } from './site-footer';

describe('SiteFooterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteFooterComponent],
    }).compileComponents();
  });

  it('should create the component', async () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should expose the current year', async () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    await fixture.whenStable();
    expect(fixture.componentInstance.currentYear).toBe(new Date().getFullYear());
  });

  it('should render a contentinfo footer element', async () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    await fixture.whenStable();
    const footer = (fixture.nativeElement as HTMLElement).querySelector('footer');
    expect(footer).toBeTruthy();
  });

  it('should render the brand text', async () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('WebGPU Image Optimizer');
    expect(text).toContain('Procesamiento 100% local');
  });

  it('should render the copyright with the current year', async () => {
    const fixture = TestBed.createComponent(SiteFooterComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(String(new Date().getFullYear()));
    expect(text).toContain('Todos los derechos reservados');
  });
});
