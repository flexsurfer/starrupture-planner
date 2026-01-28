/**
 * MyBases Type Definitions
 *
 * Central location for all shared types used across mybases components and subscriptions.
 */

import type { Building, Item } from '../../state/db';

/**
 * Section types for categorizing buildings in a base.
 */
export type BuildingSectionType = 'inputs' | 'energy' | 'production' | 'outputs' | 'infrastructure';

/**
 * Stats for a base's core information display.
 * Used in both the detail view (BaseCoreInfo) and the card view (BaseCard).
 */
export interface BaseDetailStats {
  buildingCount: number;
  totalHeat: number;
  energyGeneration: number;
  energyConsumption: number;
  baseCoreHeatCapacity: number;
  heatPercentage: number;
  energyPercentage: number;
  isHeatOverCapacity: boolean;
  isEnergyInsufficient: boolean;
}

/**
 * Stats for a building section within a base.
 */
export interface BuildingSectionStats {
  buildingCount: number;
  totalHeat: number;
  totalPowerGeneration: number;
  totalPowerConsumption: number;
  hasGenerators: boolean;
}

/**
 * Represents an input item configured on a base building.
 */
export interface BaseInputItem {
  item: Item;
  ratePerMinute: number;
  building: Building;
}

/**
 * Represents an output item configured on a base building.
 */
export interface BaseOutputItem {
  item: Item;
  ratePerMinute: number;
  building: Building;
}

/**
 * Represents a defense building in a base, with count for duplicates.
 */
export interface BaseDefenseBuilding {
  building: Building;
  count: number;
}

/**
 * Aggregated stats for all bases.
 * Used in the MyBasesStats component and MY_BASES_STATS subscription.
 */
export interface MyBasesStats {
  totalBases: number;
  totalBuildings: number;
  totalHeat: number;
  totalEnergyUsed: number;
}

/**
 * Stats for a production plan section.
 * Calculated from the production flow for the selected item.
 */
export interface ProductionPlanSectionStats {
  buildingCount: number;
  totalHeat: number;
  totalPowerConsumption: number;
}

/**
 * Represents a building requirement for a production plan section.
 * Used to track which buildings are needed and whether they're available in the base.
 */
export interface BuildingRequirement {
  buildingId: string;
  buildingName: string;
  required: number;
  available: number;
  isSatisfied: boolean;
}
