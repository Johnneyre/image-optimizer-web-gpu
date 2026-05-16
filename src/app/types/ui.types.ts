import type { LucideIconData } from 'lucide-angular';

export interface Step {
  n: string;
  icon: LucideIconData;
  title: string;
  description: string;
}

export type LayoutPhase = 'demo' | 'transitioning' | 'cards';

export interface Stat {
  label: string;
  value: string;
}
