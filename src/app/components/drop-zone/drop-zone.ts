import { Component, input, output, viewChild, ElementRef } from '@angular/core';
import { LucideAngularModule, Upload, AlertCircle } from 'lucide-angular';

type Theme = 'dark' | 'light';

@Component({
  selector: 'app-drop-zone',
  imports: [LucideAngularModule],
  templateUrl: './drop-zone.html',
  styleUrl: './drop-zone.css',
})
export class DropZoneComponent {
  readonly theme = input.required<Theme>();
  readonly isSupported = input<boolean | null>(null);

  readonly fileSelected = output<File>();

  readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  isDragging = false;

  readonly icons = { Upload, AlertCircle };

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.fileSelected.emit(files[0]);
    }
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.fileSelected.emit(input.files[0]);
    }
  }

  triggerFileInput(): void {
    this.fileInput()?.nativeElement.click();
  }
}
