import { Component, inject } from '@angular/core';
import {
  LucideAngularModule,
  Cpu,
  ShieldCheck,
  Gauge,
  SlidersHorizontal,
  FileImage,
  Wand2,
  LucideIconData,
} from 'lucide-angular';
import { ThemeService } from '../../services/theme.service';

interface Feature {
  icon: LucideIconData;
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

  readonly features: Feature[] = [
    {
      icon: Cpu,
      title: 'Aceleración WebGPU',
      description:
        'Usa shaders nativos que corren directo en tu GPU. Procesa imágenes de varios MB en milisegundos, no segundos.',
    },
    {
      icon: ShieldCheck,
      title: '100% privado y local',
      description:
        'Tus imágenes nunca salen de tu navegador. Sin uploads, sin tracking, sin servidores intermediarios.',
    },
    {
      icon: Gauge,
      title: 'Compresión inteligente',
      description:
        'Algoritmos optimizados que reducen hasta un 80% el tamaño manteniendo la calidad visual de la imagen.',
    },
    {
      icon: SlidersHorizontal,
      title: 'Controles en tiempo real',
      description:
        'Ajusta brillo, contraste y calidad con previsualización instantánea mediante un slider de antes/después.',
    },
    {
      icon: FileImage,
      title: 'Múltiples formatos',
      description: 'Exporta a WebP, JPEG o PNG. Convierte entre formatos modernos sin herramientas externas.',
    },
    {
      icon: Wand2,
      title: 'Presets inteligentes',
      description: 'Calidad Original, Alta, Media o Baja en un clic. O ajusta manualmente con control milimétrico.',
    },
  ];
}
