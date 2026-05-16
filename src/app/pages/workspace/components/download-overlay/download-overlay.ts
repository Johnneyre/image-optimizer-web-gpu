import { Component, input } from '@angular/core';
import { LucideAngularModule, Loader2, Download } from 'lucide-angular';
import type { Theme } from '@types';

@Component({
  selector: 'app-download-overlay',
  imports: [LucideAngularModule],
  templateUrl: './download-overlay.html',
  styleUrl: './download-overlay.css',
})
export class DownloadOverlayComponent {
  readonly theme = input.required<Theme>();
  readonly isVisible = input(false);

  readonly icons = { Loader2, Download };
}
