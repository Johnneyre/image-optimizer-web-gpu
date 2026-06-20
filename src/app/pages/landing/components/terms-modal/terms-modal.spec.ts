import { TestBed, ComponentFixture } from '@angular/core/testing';
import { TermsModalComponent } from './terms-modal';

describe('TermsModalComponent', () => {
  let fixture: ComponentFixture<TermsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TermsModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TermsModalComponent);
    await fixture.whenStable();
  });

  function dialogEl(): HTMLDialogElement {
    return (fixture.nativeElement as HTMLElement).querySelector('dialog')!;
  }

  // Abre el modal stubeando showModal (jsdom no implementa el top layer real).
  async function openModal(): Promise<HTMLDialogElement> {
    const dialog = dialogEl();
    dialog.showModal = vi.fn(() => {
      (dialog as unknown as { open: boolean }).open = true;
    });

    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();
    return dialog;
  }

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('keeps the legal content out of the DOM while closed', () => {
    const dialog = dialogEl();
    expect(dialog).not.toBeNull();
    // El contenido se renderiza solo al abrir (mejor para SEO y DOM inicial).
    expect(dialog.querySelector('article')).toBeNull();
    expect(dialog.textContent?.trim()).toBe('');
  });

  it('renders accessible, self-contained content when opened', async () => {
    const dialog = await openModal();

    // Etiqueta accesible asociada al encabezado visible
    expect(dialog.getAttribute('aria-labelledby')).toBe('terms-title');
    expect(dialog.querySelector('#terms-title')?.textContent?.trim()).toBe(
      'Términos y Condiciones',
    );

    // Contenido como documento autocontenido
    const article = dialog.querySelector('article');
    expect(article).not.toBeNull();

    const text = dialog.textContent ?? '';
    expect(text).toContain('nunca se suben');
    expect(text).toContain('localStorage');
  });

  it('calls showModal exactly once when opened', async () => {
    const dialog = dialogEl();
    const showModal = vi.fn(() => {
      (dialog as unknown as { open: boolean }).open = true;
    });
    dialog.showModal = showModal;

    fixture.componentRef.setInput('open', true);
    await fixture.whenStable();

    expect(showModal).toHaveBeenCalledTimes(1);
  });

  it('emits closed when the close (X) button is clicked', async () => {
    const dialog = await openModal();

    let closeCount = 0;
    fixture.componentInstance.closed.subscribe(() => closeCount++);

    dialog
      .querySelector<HTMLButtonElement>('button[aria-label="Cerrar términos y condiciones"]')
      ?.click();

    expect(closeCount).toBe(1);
  });

  it('emits closed when the "Entendido" button is clicked', async () => {
    const dialog = await openModal();

    let closeCount = 0;
    fixture.componentInstance.closed.subscribe(() => closeCount++);

    Array.from(dialog.querySelectorAll('button'))
      .find((b) => b.textContent?.trim() === 'Entendido')
      ?.click();

    expect(closeCount).toBe(1);
  });

  it('emits closed when the dialog is cancelled with Escape', () => {
    let closeCount = 0;
    fixture.componentInstance.closed.subscribe(() => closeCount++);

    dialogEl().dispatchEvent(new Event('cancel'));

    expect(closeCount).toBe(1);
  });
});
