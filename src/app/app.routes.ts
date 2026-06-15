import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { ImageProcessingService } from '@services/image-processing.service';
import type { SeoRouteData } from '@services/seo.service';

export const workspaceImageGuard: CanActivateFn = () => {
  const router = inject(Router);
  const imageService = inject(ImageProcessingService);
  return imageService.hasImage() ? true : router.createUrlTree(['/']);
};

export const routes: Routes = [
  {
    path: '',
    title: 'WebGPU Image Optimizer — Optimiza imágenes en tu navegador',
    data: {
      description:
        'Comprime y optimiza imágenes hasta un 80% directamente en tu navegador con WebGPU. Procesamiento en GPU, privado y sin subir archivos a la nube. Exporta a WebP y JPEG.',
      canonicalPath: '/',
    } satisfies SeoRouteData,
    loadComponent: () => import('./pages/landing/landing').then((m) => m.LandingPage),
  },
  {
    path: 'workspace',
    title: 'Editor de optimización — WebGPU Image Optimizer',
    data: {
      description:
        'Ajusta calidad, brillo y contraste y exporta tu imagen optimizada en WebP o JPEG, todo en local desde tu navegador.',
      canonicalPath: '/',
      noindex: true,
    } satisfies SeoRouteData,
    canActivate: [workspaceImageGuard],
    loadComponent: () => import('./pages/workspace/workspace').then((m) => m.WorkspacePage),
  },
  { path: '**', redirectTo: '' },
];
