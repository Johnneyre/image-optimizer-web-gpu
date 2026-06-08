import { Component, input } from '@angular/core';
import { LucideAngularModule, Download } from 'lucide-angular';
import type { Theme } from '@types';

@Component({
  selector: 'app-download-overlay',
  imports: [LucideAngularModule],
  templateUrl: './download-overlay.html',
  host: {
    class: 'contents',
  },
})
export class DownloadOverlayComponent {
  readonly theme = input.required<Theme>();
  readonly isVisible = input(false);

  readonly icons = { Download };
}
