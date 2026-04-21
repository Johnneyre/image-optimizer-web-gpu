import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.LandingPage),
  },
  {
    path: 'workspace',
    loadComponent: () => import('./pages/workspace/workspace').then((m) => m.WorkspacePage),
  },
  { path: '**', redirectTo: '' },
];
