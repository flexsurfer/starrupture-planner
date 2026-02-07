/**
 * Type definitions for the Production Planner system
 * 
 * This module contains all the interfaces and types used throughout the planner,
 * including game data structures and internal flow representation.
 */

/**
 * Represents a game item from the catalog
 */
export interface Item {
    /** Unique identifier for the item */
    id: string;
    /** Human-readable name of the item */
    name: string;
    /** Category of the item: 'raw', 'processed', 'component', or 'ammo' */
    type: string;
}

/**
 * Represents a recipe that describes how to produce an item
 */
export interface Recipe {
    /** The output item and production rate */
    output: {
        /** ID of the item being produced */
        id: string;
        /** Production rate in units per minute */
        amount_per_minute: number;
    };
    /** List of input materials required for production */
    inputs: {
        /** ID of the required input item */
        id: string;
        /** Consumption rate in units per minute */
        amount_per_minute: number;
    }[];
}

/**
 * Represents a building that can execute recipes
 */
export interface Building {
    /** Unique identifier for the building */
    id: string;
    /** Human-readable name of the building */
    name: string;
    /** Power consumption per building */
    power: number;
    /** Heat generation per building */
    heat: number;
    /** List of recipes this building can execute */
    recipes: Recipe[];
}

/**
 * Internal representation of a building node in the production flow
 * This is used by the flow builder to create the dependency graph
 */
export interface FlowNode {
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
    /** X coordinate for layout (set by dagre) */
    x: number;
    /** Y coordinate for layout (set by dagre) */
    y: number;
    /** Whether this node represents a custom input (external source) */
    isCustomInput?: boolean;
    /** Unique ID of the base building instance (for custom inputs) */
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

/**
 * Snapshot of a base input building used as an external material source.
 * This mirrors the fields needed from BaseBuilding without coupling planner core
 * to the state layer types.
 */
export interface InputBuildingSnapshot {
    /** Unique ID of the base building instance */
    id: string;
    /** Building type ID from game data */
    buildingTypeId: string;
    /** Building section type, must be 'inputs' to be considered as external supply */
    sectionType: string;
    /** Selected item produced by this input building */
    selectedItemId?: string;
    /** Production rate in units per minute */
    ratePerMinute?: number;
}

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
}

/**
 * Union type for all possible node types in the production flow
 */
export type ProductionNode = FlowNode;

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

/**
 * Result of building a production flow
 */
export interface ProductionFlowResult {
    /** List of building nodes in the production chain */
    nodes: ProductionNode[];
    /** List of material flow edges between buildings */
    edges: FlowEdge[];
    /** List of raw material deficits (when custom inputs don't fully satisfy demand) */
    rawMaterialDeficits?: RawMaterialDeficit[];
}

/**
 * Represents a single allocation of custom input to a consumer
 */
export interface CustomInputAllocation {
    /** ID of the base building providing the input */
    baseBuildingId: string;
    /** Building ID of the source */
    buildingId: string;
    /** Building name of the source */
    buildingName: string;
    /** ID of the consumer node (empty for raw material allocation pool) */
    consumerNodeId: string;
    /** ID of the item being transferred */
    itemId: string;
    /** Amount allocated */
    amount: number;
}

/**
 * Result of the allocation pass
 */
export interface AllocationPlan {
    /** All allocations from custom inputs to consumers */
    allocations: CustomInputAllocation[];
    /** Total amount allocated per item */
    totalAllocatedByItem: Map<string, number>;
    /** Amount used per custom input tracker (keyed by baseBuildingId) */
    usedByTracker: Map<string, number>;
}
