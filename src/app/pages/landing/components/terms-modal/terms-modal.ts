import { Component, input, output, effect, inject, viewChild, ElementRef } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { LucideAngularModule, FileText, X } from 'lucide-angular';

@Component({
  selector: 'app-terms-modal',
  imports: [LucideAngularModule],
  templateUrl: './terms-modal.html',
  styleUrl: './terms-modal.css',
  host: {
    class: 'contents',
  },
})
export class TermsModalComponent {
  private readonly document = inject(DOCUMENT);

  readonly open = input(false);
  readonly closed = output<void>();

  readonly icons = { FileText, X };

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Syncs the native <dialog> with the `open` input.
    effect((onCleanup) => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;

      if (this.open()) {
        if (!dialog.open) dialog.showModal();
        this.document.body.style.overflow = 'hidden';
        onCleanup(() => {
          this.document.body.style.overflow = '';
        });
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  // Escape (native `cancel` event): the parent controls the state via `open`.
  onCancel(event: Event): void {
    event.preventDefault();
    this.close();
  }
}
