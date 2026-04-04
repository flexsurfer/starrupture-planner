/**
 * Type definitions for the Production Planner system
 * 
 * This module contains all the interfaces and types used throughout the planner,
 * including game data structures and internal flow representation.
 */

import type {
    Item as DbItem,
    Recipe as DbRecipe,
    Building as DbBuilding,
    BaseBuilding,
    CorporationLevelSelection,
} from '../../../state/db';

/** Canonical item model from the app state layer. */
export type Item = DbItem;
/** Canonical recipe model from the app state layer. */
export type Recipe = DbRecipe;
/** Canonical building model from the app state layer. */
export type Building = DbBuilding;

/** Discriminant for the three kinds of flow node. */
export type FlowNodeType = 'production' | 'input' | 'launcher';

/**
 * Internal representation of a building node in the production flow.
 * This is used by the flow builder to create the dependency graph.
 */
export interface FlowNode {
    /** Discriminant: 'production' | 'input' | 'launcher' */
    nodeType: FlowNodeType;
    /** ID of the building type */
    buildingId: string;
    /** Human-readable name of the building */
    buildingName: string;
    /** Index of the recipe being used (buildings can have multiple recipes) */
    recipeIndex: number;
    /** ID of the item this building instance is producing */
    outputItem: string;
    /** Production rate per building in units per minute */
    outputAmount: number;
    /** Number of buildings needed to meet demand */
    buildingCount: number;
    /** Power consumption per building */
    powerPerBuilding: number;
    /** Heat generation per building */
    heatPerBuilding: number;
    /** Total power consumption (buildingCount * powerPerBuilding) */
    totalPower: number;
    /** Total heat generation (buildingCount * heatPerBuilding) */
    totalHeat: number;
    /** Unique ID of the base building instance (for input nodes) */
    baseBuildingId?: string;
}

/**
 * Internal representation of a material flow edge between buildings
 * This connects the output of one building to the input of another
 */
export interface FlowEdge {
    /** ID of the source building node */
    from: string;
    /** ID of the destination building node */
    to: string;
    /** ID of the item being transferred */
    itemId: string;
    /** Transfer rate in units per minute */
    amount: number;
}

/** Aggregated per-building row used in planner detailed stats. */
export interface PlannerBuildingStats {
    buildingId: string;
    buildingName: string;
    count: number;
    totalPower: number;
    totalHeat: number;
}

/** Item descriptor used in grouped planner detailed stats. */
export interface PlannerDetailedStatsItem {
    id: string;
    name: string;
    type: string;
}

/** Full planner detailed stats payload for the stats modal. */
export interface PlannerDetailedStats {
    buildingStats: PlannerBuildingStats[];
    totalEnergy: number;
    totalHotness: number;
    totalBuildings: number;
    itemsByType: Map<string, PlannerDetailedStatsItem[]>;
    sortedTypes: string[];
}

/** Selectable recipe option for a produced item in planner. */
export interface PlannerRecipeOption {
    key: string; // `${buildingId}:${recipeIndex}`
    buildingId: string;
    buildingName: string;
    recipeIndex: number;
    outputRate: number;
}

/** Planner recipe alternatives descriptor for one output item. */
export interface PlannerRecipeOptionsItem {
    itemId: string;
    itemName: string;
    options: PlannerRecipeOption[];
    selectedKey: string;
    defaultKey: string; // slow-rate default
}

/**
 * Information about corporation level that uses a specific item
 */
export interface CorporationLevelInfo {
    /** Corporation name */
    corporationName: string;
    /** Corporation ID */
    corporationId: string;
    /** Level number */
    level: number;
    /** Points earned per item */
    points: number;
    /** Cost per item in gold (optional) */
    cost?: number | null;
}

/** Subset of base-building data used by planner as external material source. */
export type InputBuildingSnapshot = Pick<
    BaseBuilding,
    'id' | 'buildingTypeId' | 'sectionType' | 'selectedItemId' | 'ratePerMinute'
>;

/**
 * Parameters for building a production flow
 */
export interface ProductionFlowParams {
    /** ID of the target item to produce */
    targetItemId: string;
    /** Desired production rate in units per minute */
    targetAmount?: number;
    /** Input building snapshots used as external material sources */
    inputBuildings?: InputBuildingSnapshot[];
    /** Disables internal production of raw materials and enables raw deficit reporting */
    rawProductionDisabled?: boolean;
    /** Adds a launcher node that consumes the target item */
    includeLauncher?: boolean;
    /** Optional per-output recipe override map: output item id -> `${buildingId}:${recipeIndex}` */
    recipeSelections?: Record<string, string>;
}

/**
 * Represents a deficit in raw material supply
 */
export interface RawMaterialDeficit {
    /** ID of the raw material item */
    itemId: string;
    /** Required amount per minute */
    required: number;
    /** Available amount from custom inputs */
    available: number;
    /** Missing amount (required - available) */
    missing: number;
}

/** Raw material deficit enriched with display name for UI usage. */
export interface RawMaterialDeficitWithName extends RawMaterialDeficit {
    itemName: string;
}

/**
 * Result of building a production flow
 */
export interface ProductionFlowResult {
    /** List of building nodes in the production chain */
    nodes: FlowNode[];
    /** List of material flow edges between buildings */
    edges: FlowEdge[];
    /** List of raw material deficits (when custom inputs don't fully satisfy demand) */
    rawMaterialDeficits?: RawMaterialDeficit[];
}

/** Re-export selection type used across planner and modal forms. */
export type { CorporationLevelSelection };
