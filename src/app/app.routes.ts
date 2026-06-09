import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';

const workspaceReloadGuard: CanActivateFn = () => {
  const router = inject(Router);
  const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  const isReload = navEntries.length > 0 && navEntries[0].type === 'reload';
  if (isReload) {
    router.navigateByUrl('/', { replaceUrl: true });
    return false;
  }
  return true;
};

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.LandingPage),
  },
  {
    path: 'workspace',
    canActivate: [workspaceReloadGuard],
    loadComponent: () => import('./pages/workspace/workspace').then((m) => m.WorkspacePage),
  },
  { path: '**', redirectTo: '' },
];
