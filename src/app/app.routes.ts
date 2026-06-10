import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { ImageProcessingService } from '@services/image-processing.service';

const workspaceImageGuard: CanActivateFn = () => {
  const router = inject(Router);
  const imageService = inject(ImageProcessingService);
  return imageService.hasImage() ? true : router.createUrlTree(['/']);
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.LandingPage),
  },
  {
    path: 'workspace',
    canActivate: [workspaceImageGuard],
    loadComponent: () => import('./pages/workspace/workspace').then((m) => m.WorkspacePage),
  },
  { path: '**', redirectTo: '' },
];
