import { Component, inject } from '@angular/core';
import { LucideAngularModule, Zap, Shield, Sparkles, LucideIconData } from 'lucide-angular';
import { ThemeService } from '../../services/theme.service';

interface Feature {
  icon: LucideIconData;
  iconClass: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-features-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './features-section.html',
  styleUrl: './features-section.css',
})
export class FeaturesSectionComponent {
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;

  readonly icons = { Zap, Shield, Sparkles };

  readonly features: Feature[] = [
    {
      icon: Zap,
      iconClass: 'feature-icon-cyan',
      title: 'Lightning Fast Processing',
      description: 'Experience 10x faster optimization without compromising quality.',
    },
    {
      icon: Sparkles,
      iconClass: 'feature-icon-violet',
      title: 'Lossless Quality',
      description: 'Maintain the highest quality with advanced WebGPU compression.',
    },
    {
      icon: Shield,
      iconClass: 'feature-icon-emerald',
      title: 'Secure & Private',
      description: 'All processing happens locally. Your images never leave your device.',
    },
  ];
}
