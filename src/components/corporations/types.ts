import type { Corporation } from '../../state/db';

export interface CorporationStats {
  totalLevels: number;
  totalComponents: number;
  totalCost: number;
}

export type CorporationWithStats = Corporation & {
  stats: CorporationStats;
};
