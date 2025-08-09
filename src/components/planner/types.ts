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
    /** X coordinate for layout (set by dagre) */
    x: number;
    /** Y coordinate for layout (set by dagre) */
    y: number;
}

/**
 * Represents the Orbital Cargo Launcher node that sends items for rewards
 */
export interface OrbitalCargoLauncherNode extends Omit<FlowNode, 'buildingId' | 'buildingName' | 'recipeIndex'> {
    /** Always 'orbital_cargo_launcher' for this node type */
    buildingId: 'orbital_cargo_launcher';
    /** Always 'Orbital Cargo Launcher' */
    buildingName: 'Orbital Cargo Launcher';
    /** Always -1 for launcher nodes (no recipe) */
    recipeIndex: -1;
    /** Points per item for this component */
    pointsPerItem: number;
    /** Time in minutes to send all items at 10 items/min */
    launchTime: number;
    /** Total points that will be earned */
    totalPoints: number;
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
 * Parameters for building a production flow
 */
export interface ProductionFlowParams {
    /** ID of the target item to produce */
    targetItemId: string;
    /** Desired production rate in units per minute */
    targetAmount?: number;
}

/**
 * Union type for all possible node types in the production flow
 */
export type ProductionNode = FlowNode | OrbitalCargoLauncherNode;

/**
 * Result of building a production flow
 */
export interface ProductionFlowResult {
    /** List of building nodes in the production chain */
    nodes: ProductionNode[];
    /** List of material flow edges between buildings */
    edges: FlowEdge[];
}