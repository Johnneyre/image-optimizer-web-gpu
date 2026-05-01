import { Component } from '@angular/core';
import { LucideAngularModule, ImageUp, Cpu, Download, LucideIconData } from 'lucide-angular';

interface Step {
  n: string;
  icon: LucideIconData;
  title: string;
  description: string;
}

@Component({
  selector: 'app-how-it-works',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './how-it-works.html',
  styleUrl: './how-it-works.css',
})
export class HowItWorksComponent {
  readonly steps: Step[] = [
    {
      n: '01',
      icon: ImageUp,
      title: 'Sube tu imagen',
      description: 'Arrastra o selecciona cualquier imagen. Soportamos PNG, JPEG, WebP, AVIF y GIF.',
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
}
