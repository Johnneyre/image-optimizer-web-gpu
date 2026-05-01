import { Component } from '@angular/core';
import { LucideAngularModule, Sparkles } from 'lucide-angular';

@Component({
  selector: 'app-site-footer',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './site-footer.html',
  styleUrl: './site-footer.css',
})
export class SiteFooterComponent {
  readonly icons = { Sparkles };
  readonly currentYear = new Date().getFullYear();
}
