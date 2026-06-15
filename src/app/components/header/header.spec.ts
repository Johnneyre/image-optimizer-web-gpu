import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { HeaderComponent } from './header';

describe('HeaderComponent', () => {
  let fixture: ComponentFixture<HeaderComponent>;
  let component: HeaderComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeaderComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('theme', 'dark');
  });

  it('should create the component', async () => {
    await fixture.whenStable();
    expect(component).toBeTruthy();
  });

  it('renders the brand text inside a <p>, not an <h1>', async () => {
    await fixture.whenStable();
    const header = fixture.nativeElement as HTMLElement;

    expect(header.textContent).toContain('WebGPU Image Optimizer');
    expect(header.querySelector('h1')).toBeNull();

    const paragraphs = Array.from(header.querySelectorAll('p'));
    const brand = paragraphs.find((p) => p.textContent?.includes('WebGPU Image Optimizer'));
    expect(brand).toBeTruthy();
  });

  it('shows the initializing text when isInitializing is true', async () => {
    fixture.componentRef.setInput('isInitializing', true);
    await fixture.whenStable();

    const header = fixture.nativeElement as HTMLElement;
    expect(header.textContent).toContain('Inicializando');
  });

  it('does not show the initializing text when isInitializing is false', async () => {
    await fixture.whenStable();

    const header = fixture.nativeElement as HTMLElement;
    expect(header.textContent).not.toContain('Inicializando');
  });

  it('shows the unsupported message when isSupported is false', async () => {
    fixture.componentRef.setInput('isSupported', false);
    await fixture.whenStable();

    const header = fixture.nativeElement as HTMLElement;
    expect(header.textContent).toContain('WebGPU no soportado');
  });

  it('renders adapterInfo text when set', async () => {
    fixture.componentRef.setInput('adapterInfo', 'NVIDIA RTX 4090');
    await fixture.whenStable();

    const header = fixture.nativeElement as HTMLElement;
    expect(header.textContent).toContain('NVIDIA RTX 4090');
  });

  it('emits themeToggle when the toggle button is clicked', async () => {
    let emitted = false;
    component.themeToggle.subscribe(() => (emitted = true));

    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(button).toBeTruthy();
    button!.dispatchEvent(new MouseEvent('click'));

    expect(emitted).toBe(true);
  });

  it('emits themeToggle when onToggleTheme() is called', async () => {
    let emitted = false;
    component.themeToggle.subscribe(() => (emitted = true));

    component.onToggleTheme();

    expect(emitted).toBe(true);
  });

  it('starts with scrolled() false and updates from window.scrollY on scroll', async () => {
    await fixture.whenStable();
    expect(component.scrolled()).toBe(false);

    Object.defineProperty(window, 'scrollY', { value: 50, configurable: true });
    component.onWindowScroll();
    expect(component.scrolled()).toBe(true);

    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    component.onWindowScroll();
    expect(component.scrolled()).toBe(false);
  });
});
