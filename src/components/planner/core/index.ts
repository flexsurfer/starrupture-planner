/**
 * Core Planner Package
 * 
 * Contains the core business logic for building production flows:
 * - Type definitions
 * - Flow building algorithm
 */

export type {
    Item,
    Recipe,
    Building,
    FlowNodeType,
    FlowNode,
    FlowEdge,
    PlannerBuildingStats,
    PlannerDetailedStatsItem,
    PlannerDetailedStats,
    PlannerRecipeOption,
    PlannerRecipeOptionsItem,
    ProductionFlowParams,
    ProductionFlowResult,
    CorporationLevelInfo,
    RawMaterialDeficit,
    RawMaterialDeficitWithName,
    CorporationLevelSelection,
} from './types';

export {
    buildProductionFlow,
} from './productionFlowBuilder';
