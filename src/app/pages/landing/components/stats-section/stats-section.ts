import { Component } from '@angular/core';

interface Stat {
  label: string;
  value: string;
}

@Component({
  selector: 'app-stats-section',
  standalone: true,
  imports: [],
  templateUrl: './stats-section.html',
  styleUrl: './stats-section.css',
})
export class StatsSectionComponent {
  readonly stats: Stat[] = [
    { label: 'Reducción promedio', value: '~65%' },
    { label: 'Tiempo de proceso', value: '<50ms' },
    { label: 'Datos enviados', value: '0 bytes' },
  ];
}
