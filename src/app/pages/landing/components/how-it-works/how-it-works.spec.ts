import { TestBed } from '@angular/core/testing';
import { HowItWorksComponent } from './how-it-works';

describe('HowItWorksComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HowItWorksComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(HowItWorksComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the section heading', async () => {
    const fixture = TestBed.createComponent(HowItWorksComponent);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Optimización en tres simples pasos');
    expect(text).toContain('Cómo funciona');
  });

  it('renders all step titles and descriptions', async () => {
    const fixture = TestBed.createComponent(HowItWorksComponent);
    await fixture.whenStable();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Sube tu imagen');
    expect(text).toContain(
      'Arrastra o selecciona cualquier imagen. Soportamos PNG, JPEG, WebP, AVIF y GIF.',
    );
    expect(text).toContain('Procesamiento GPU');
    expect(text).toContain(
      'Tu GPU comprime la imagen usando shaders optimizados. Todo ocurre localmente.',
    );
    expect(text).toContain('Descarga el resultado');
    expect(text).toContain(
      'Obtén tu imagen optimizada al instante. Sin colas, sin límites, sin costos.',
    );
  });

  it('exposes the three steps and the active step data', () => {
    const fixture = TestBed.createComponent(HowItWorksComponent);
    const component = fixture.componentInstance;

    expect(component.steps).toHaveLength(3);
    expect(component.steps.map((s) => s.n)).toEqual(['01', '02', '03']);
    expect(component.activeStepData.title).toBe('Sube tu imagen');
  });

  it('updates the current step via onStepChange', () => {
    const fixture = TestBed.createComponent(HowItWorksComponent);
    const component = fixture.componentInstance;

    component.onStepChange(2);

    expect(component.currentStep()).toBe(2);
    expect(component.activeStepData.title).toBe('Procesamiento GPU');
  });
});
