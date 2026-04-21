import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule, AlertCircle } from 'lucide-angular';
import { ImageProcessingService } from './services/image-processing.service';
import { ThemeService } from './services/theme.service';
import { HeaderComponent } from './components/header/header';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LucideAngularModule, HeaderComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly imageService = inject(ImageProcessingService);
  readonly themeService = inject(ThemeService);

  readonly icons = { AlertCircle };

  readonly theme = this.themeService.theme;

  readonly isSupported = this.imageService.isSupported;
  readonly isInitializing = this.imageService.isInitializing;
  readonly adapterInfo = this.imageService.adapterInfo;
  readonly lastError = this.imageService.lastError;

  toggleTheme(): void {
    this.themeService.toggle();
  }
}
