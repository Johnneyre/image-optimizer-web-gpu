import { Component } from '@angular/core';
import { LucideAngularModule, Sparkles, Lock, Zap } from 'lucide-angular';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './hero-section.html',
})
export class HeroSectionComponent {
  readonly icons = { Sparkles, Lock, Zap };
}
