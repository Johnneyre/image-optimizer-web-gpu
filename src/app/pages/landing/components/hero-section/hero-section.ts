import { Component, inject } from '@angular/core';
import { LucideAngularModule, Sparkles, Lock, Zap } from 'lucide-angular';
import { ThemeService } from '../../../../services/theme.service';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './hero-section.html',
  styleUrl: './hero-section.css',
})
export class HeroSectionComponent {
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;

  readonly icons = { Sparkles, Lock, Zap };
}
