import { Component } from '@angular/core';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  templateUrl: './site-footer.html',
})
export class SiteFooterComponent {
  readonly currentYear = new Date().getFullYear();
}
