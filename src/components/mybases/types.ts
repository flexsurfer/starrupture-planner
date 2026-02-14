/**
 * MyBases Type Definitions
 *
 * Central location for all shared types used across mybases components and subscriptions.
 */

import type { BaseBuilding, Building, Item, Production } from '../../state/db';

/**
 * Section types for categorizing buildings in a base.
 */
export type BuildingSectionType = 'inputs' | 'energy' | 'production' | 'outputs' | 'infrastructure';

/**
 * Stats for a base's core information display.
 * Used in both the detail view (BaseCoreInfo) and the card view (BaseCard).
 */
export interface BaseDetailStats {
  baseName: string;
  coreLevel: number;
  buildingCount: number;
  totalHeat: number;
  energyGeneration: number;
  energyConsumption: number;
  energyGridConsumption: number;
  baseCoreHeatCapacity: number;
  heatPercentage: number;
  energyPercentage: number;
  isHeatOverCapacity: boolean;
  isEnergyInsufficient: boolean;
  energyGroupId?: string;
  energyGroupName?: string;
}

/**
 * Enriched building entry for a building section.
 * Combines the base building instance, building type info, and active plan names.
 */
export interface BuildingSectionBuilding {
  baseBuilding: BaseBuilding;
  building: Building;
  activePlanNames: string[];
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
  /** Unique ID of this building instance in the base */
  baseBuildingId: string;
  item: Item;
  ratePerMinute: number;
  building: Building;
  name: string;
  description: string;
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
 * Top produced item for stats display and sharing.
 */
export interface TopProducedItem {
  itemId: string;
  itemName: string;
  totalRatePerMinute: number;
  corporationPoints: number;
}

/**
 * Aggregated stats for all bases.
 * Used in the MyBasesStats component and MY_BASES_STATS subscription.
 */
export interface MyBasesStats {
  totalBases: number;
  totalBuildings: number;
  totalPlans: number;
  totalHeat: number;
  totalHeatCapacity: number;
  totalEnergyUsed: number;
  totalEnergyProduced: number;
  heatPercentage: number;
  energyPercentage: number;
  isHeatOverCapacity: boolean;
  isEnergyInsufficient: boolean;
  topProducedItems: TopProducedItem[];
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

/**
 * Represents an input requirement for a production plan section.
 * Used to track which input buildings are needed and whether they exist in the base.
 */
export interface InputRequirement {
  baseBuildingId: string;
  buildingId: string;
  buildingName: string;
  itemId: string;
  itemName: string;
  ratePerMinute: number;
  isSatisfied: boolean;
}

/**
 * Shared input shortage for a plan when evaluated alongside active plans.
 */
export interface SharedInputShortage {
  baseBuildingId: string;
  inputName: string;
  itemId: string;
  itemName: string;
  requiredPerMinute: number;
  availablePerMinute: number;
  missingPerMinute: number;
}

/** Combined data model used by the ProductionPlanSection component subscription. */
export interface ProductionPlanSectionViewModel {
  selectedBaseId: string;
  section: Production;
  itemName: string;
  corporationName: string | null;
  stats: ProductionPlanSectionStats;
  buildingRequirements: BuildingRequirement[];
  inputRequirements: InputRequirement[];
  sharedInputShortages: SharedInputShortage[];
  allRequirementsSatisfied: boolean;
  planStatus: string;
  hasError: boolean;
  showManageButton: boolean;
}

/** Lightweight requirements status payload used by plan badges/previews. */
export interface ProductionPlanRequirementsStatus {
  allRequirementsSatisfied: boolean;
  planStatus: string;
  hasError: boolean;
  itemName: string;
  corporationName: string | null;
}
