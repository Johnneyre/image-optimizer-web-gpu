import { TestBed } from '@angular/core/testing';
import { HeroSectionComponent } from './hero-section';

describe('HeroSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSectionComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HeroSectionComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render exactly one <h1> containing the main heading copy', async () => {
    const fixture = TestBed.createComponent(HeroSectionComponent);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    const headings = host.querySelectorAll('h1');
    expect(headings.length).toBe(1);
    expect(headings[0]?.textContent).toContain('Optimiza tus imágenes');
    expect(headings[0]?.textContent).toContain('en segundos');
  });

  it('should render the feature labels', async () => {
    const fixture = TestBed.createComponent(HeroSectionComponent);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Procesamiento en segundos');
    expect(text).toContain('100% local y privado');
    expect(text).toContain('WebP · JPEG');
  });
});
