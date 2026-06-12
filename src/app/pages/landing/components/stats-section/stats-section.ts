import { Component } from '@angular/core';
import type { Stat } from '@types';

@Component({
  selector: 'app-stats-section',
  standalone: true,
  imports: [],
  templateUrl: './stats-section.html',
})
export class StatsSectionComponent {
  readonly stats: Stat[] = [
    { label: 'Reducción promedio', value: '~80%' },
    { label: 'Tiempo de proceso', value: '<250ms' },
    { label: 'Datos enviados', value: '0 bytes' },
  ];
}
