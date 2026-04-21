import { Component, signal, inject, viewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule, ArrowRight, Upload, AlertCircle } from 'lucide-angular';
import { ImageProcessingService } from '../../services/image-processing.service';
import { ThemeService } from '../../services/theme.service';
import { FeaturesSectionComponent } from '../../components/features-section/features-section';

@Component({
  selector: 'app-landing',
  imports: [LucideAngularModule, FeaturesSectionComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class LandingPage {
  private readonly imageService = inject(ImageProcessingService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly icons = { ArrowRight, Upload, AlertCircle };

  readonly theme = this.themeService.theme;
  readonly isDragging = signal(false);
  readonly isSupported = this.imageService.isSupported;

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await this.handleFile(files[0]);
    }
  }

  async onFileSelect(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      await this.handleFile(input.files[0]);
    }
  }

  triggerFileInput(): void {
    this.fileInput()?.nativeElement.click();
  }

  scrollToDropZone(): void {
    const el = document.getElementById('drop-zone-section');
    el?.scrollIntoView({ behavior: 'smooth' });
  }

  private async handleFile(file: File): Promise<void> {
    await this.imageService.setFile(file);
    this.router.navigate(['/workspace']);
  }
}
