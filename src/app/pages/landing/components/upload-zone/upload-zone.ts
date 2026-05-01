import { Component, signal, inject, viewChild, ElementRef, output } from '@angular/core';
import { LucideAngularModule, Upload, ImageIcon, FileImage, AlertCircle } from 'lucide-angular';
import { ImageProcessingService } from '../../../../services/image-processing.service';

@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [LucideAngularModule],
  templateUrl: './upload-zone.html',
  styleUrl: './upload-zone.css',
})
export class UploadZoneComponent {
  private readonly imageService = inject(ImageProcessingService);

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  readonly fileSelected = output<File>();

  readonly icons = { Upload, ImageIcon, FileImage, AlertCircle };

  readonly isDragging = signal(false);
  readonly isSupported = this.imageService.isSupported;

  readonly formats = ['PNG', 'JPG', 'WebP', 'AVIF', 'GIF'];

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

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFile(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  triggerFileInput(): void {
    this.fileInput()?.nativeElement.click();
  }

  private handleFile(file: File): void {
    if (!file.type.startsWith('image/')) return;
    this.fileSelected.emit(file);
  }
}
