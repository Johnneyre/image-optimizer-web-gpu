import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ImageProcessingService } from '../../services/image-processing.service';
import { ThemeService } from '../../services/theme.service';
import { FeaturesSectionComponent } from '../../components/features-section/features-section';
import { HeroSectionComponent } from './components/hero-section/hero-section';
import { UploadZoneComponent } from './components/upload-zone/upload-zone';
import { StatsSectionComponent } from './components/stats-section/stats-section';
import { HowItWorksComponent } from './components/how-it-works/how-it-works';
import { SiteFooterComponent } from './components/site-footer/site-footer';

@Component({
  selector: 'app-landing',
  imports: [
    FeaturesSectionComponent,
    HeroSectionComponent,
    UploadZoneComponent,
    StatsSectionComponent,
    HowItWorksComponent,
    SiteFooterComponent,
  ],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingPage {
  private readonly imageService = inject(ImageProcessingService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly theme = this.themeService.theme;

  async onFileSelected(file: File): Promise<void> {
    await this.imageService.setFile(file);
    this.router.navigate(['/workspace']);
  }
}
