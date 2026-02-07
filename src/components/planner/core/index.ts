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
    FlowNode,
    FlowEdge,
    PlannerBuildingStats,
    PlannerDetailedStatsItem,
    PlannerDetailedStats,
    ProductionFlowParams,
    ProductionFlowResult,
    CorporationLevelInfo,
    RawMaterialDeficit,
    RawMaterialDeficitWithName,
    CorporationLevelSelection,
    CustomInputAllocation,
    AllocationPlan,
} from './types';

export {
    buildProductionFlow,
} from './productionFlowBuilder';
