/**
 * Planner Package Exports
 * 
 * This module provides clean exports for all planner-related functionality.
 * It allows importing from '@/components/planner' instead of individual files.
 * 
 * The planner package is organized into subpackages:
 * - core: Types and flow building logic
 * - visualization: React Flow utilities and diagram component
 * - ui: Form components (selectors, inputs)
 * - stats: Statistics display components
 * - hooks: Shared React hooks
 */

// Core exports (types and flow builder)
export type {
    Item,
    Recipe,
    Building,
    FlowNode,
    FlowEdge,
    ProductionFlowParams,
    ProductionFlowResult,
    CorporationLevelInfo,
} from './core';

export {
    buildProductionFlow,
    getItemName,
} from './core';

// Visualization exports
export {
    generateReactFlowData,
    type FlowDataGenerationParams,
    type FlowData,
    PlannerFlowDiagram,
} from './visualization';

// UI component exports
export {
    PlannerItemSelector,
    PlannerTargetInput,
    CorporationLevelSelector,
} from './ui';

// Stats component exports
export {
    PlannerStatsModal,
    PlannerStatsDisplay,
} from './stats';

// Hooks exports
export {
    usePlannerDefaultOutput,
    useTargetAmount,
} from './hooks';
