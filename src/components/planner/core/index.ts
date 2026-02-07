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
    ProductionFlowParams,
    ProductionFlowResult,
    CorporationLevelInfo,
    RawMaterialDeficit,
} from './types';

export {
    buildProductionFlow,
} from './productionFlowBuilder';
