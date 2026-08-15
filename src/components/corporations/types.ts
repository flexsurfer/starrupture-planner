import type { Corporation } from '@/app/uklad/model';

export interface CorporationStats {
  totalLevels: number;
  totalComponents: number;
  totalCost: number;
}

export type CorporationWithStats = Corporation & {
  stats: CorporationStats;
};
