import { TestBed } from '@angular/core/testing';
import { StatsSectionComponent } from './stats-section';

describe('StatsSectionComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsSectionComponent],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(StatsSectionComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should expose the three headline stats', () => {
    const fixture = TestBed.createComponent(StatsSectionComponent);
    const stats = fixture.componentInstance.stats;
    expect(stats).toHaveLength(3);
    expect(stats.map((s) => s.value)).toEqual(['~80%', '<250ms', '0 bytes']);
    expect(stats.map((s) => s.label)).toEqual([
      'Reducción promedio',
      'Tiempo de proceso',
      'Datos enviados',
    ]);
  });

  it('should render the stat values', async () => {
    const fixture = TestBed.createComponent(StatsSectionComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('~80%');
    expect(text).toContain('<250ms');
    expect(text).toContain('0 bytes');
  });

  it('should render the stat labels', async () => {
    const fixture = TestBed.createComponent(StatsSectionComponent);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Reducción promedio');
    expect(text).toContain('Tiempo de proceso');
    expect(text).toContain('Datos enviados');
  });

  it('should render one card per stat', async () => {
    const fixture = TestBed.createComponent(StatsSectionComponent);
    await fixture.whenStable();
    const cards = (fixture.nativeElement as HTMLElement).querySelectorAll('p.font-mono');
    expect(cards).toHaveLength(3);
  });
});
