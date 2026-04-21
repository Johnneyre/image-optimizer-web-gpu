import { Injectable, signal, effect, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly theme = signal<Theme>('dark');

  constructor() {
    if (this.isBrowser) {
      // Load saved theme or detect system preference
      const savedTheme = localStorage.getItem('theme') as Theme | null;
      if (savedTheme) {
        this.theme.set(savedTheme);
      } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        this.theme.set('light');
      }

      // Listen for system theme changes
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
          this.theme.set(e.matches ? 'dark' : 'light');
        }
      });
    }

    // Persist theme changes
    effect(() => {
      if (this.isBrowser) {
        localStorage.setItem('theme', this.theme());
      }
    });
  }

  toggle(): void {
    this.theme.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  isDark(): boolean {
    return this.theme() === 'dark';
  }

  isLight(): boolean {
    return this.theme() === 'light';
  }
}
