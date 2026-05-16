import { Component, signal } from '@angular/core';
import { LucideAngularModule, ImageUp, Cpu, Download } from 'lucide-angular';
import { HeroDemoComponent } from '../hero-demo/hero-demo';
import type { Step, LayoutPhase } from '@types';

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [LucideAngularModule, HeroDemoComponent],
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.css',
})
export class HowItWorksComponent {
  readonly steps: Step[] = [
    {
      n: '01',
      icon: ImageUp,
      title: 'Sube tu imagen',
      description:
        'Arrastra o selecciona cualquier imagen. Soportamos PNG, JPEG, WebP, AVIF y GIF.',
    },
    {
      n: '02',
      icon: Cpu,
      title: 'Procesamiento GPU',
      description: 'Tu GPU comprime la imagen usando shaders optimizados. Todo ocurre localmente.',
    },
    {
      n: '03',
      icon: Download,
      title: 'Descarga el resultado',
      description: 'Obtén tu imagen optimizada al instante. Sin colas, sin límites, sin costos.',
    },
  ];

  /** Current layout phase: demo -> transitioning -> cards */
  readonly phase = signal<LayoutPhase>('demo');

  /** Current step shown during the demo (1, 2, or 3) */
  readonly currentStep = signal(1);

  onStepChange(step: number): void {
    this.currentStep.set(step);
  }

  onDemoCompleted(): void {
    // Start transition phase - demo fades out
    this.phase.set('transitioning');

    // After demo fade out completes, show cards
    setTimeout(() => {
      this.phase.set('cards');
    }, 150);
  }

  /** Returns the current step data for the step indicator */
  get activeStepData(): Step {
    return this.steps[this.currentStep() - 1];
  }
}
