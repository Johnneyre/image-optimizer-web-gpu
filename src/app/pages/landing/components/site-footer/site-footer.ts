import { Component, signal } from '@angular/core';
import { TermsModalComponent } from '../terms-modal/terms-modal';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [TermsModalComponent],
  templateUrl: './site-footer.html',
})
export class SiteFooterComponent {
  readonly currentYear = new Date().getFullYear();

  readonly termsOpen = signal(false);
}
