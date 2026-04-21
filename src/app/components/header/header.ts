import { Component, input, output } from '@angular/core';
import { LucideAngularModule, Zap, Sun, Moon, Loader2, AlertCircle, Gpu } from 'lucide-angular';

type Theme = 'dark' | 'light';

@Component({
  selector: 'app-header',
  imports: [LucideAngularModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class HeaderComponent {
  // Inputs
  readonly theme = input.required<Theme>();
  readonly isInitializing = input(false);
  readonly isSupported = input<boolean | null>(null);
  readonly adapterInfo = input<string | null>(null);

  // Outputs
  readonly themeToggle = output<void>();

  // Icons
  readonly icons = { Zap, Sun, Moon, Loader2, AlertCircle, Gpu };

  onToggleTheme(): void {
    this.themeToggle.emit();
  }
}
