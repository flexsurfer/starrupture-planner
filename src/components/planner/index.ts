/**
 * Planner Package Exports
 * 
 * This module provides clean exports for all planner-related functionality.
 * It allows importing from '@/components/planner' instead of individual files.
 */

// Types
export type {
    Item,
    Recipe,
    Building,
    FlowNode,
    FlowEdge,
    ProductionFlowParams,
    ProductionFlowResult,
} from './types';

// Flow builder functions
export {
    buildProductionFlow,
    getItemName,
} from './productionFlowBuilder';

// Flow utilities
export {
    generateReactFlowData,
    type FlowDataGenerationParams,
    type FlowData,
} from './plannerFlowUtils';

// Hooks
export {
    usePlannerColors,
    usePlannerSelectableItems,
    usePlannerDefaultOutput,
} from './hooks';

// Components
export { PlannerItemSelector } from './PlannerItemSelector';
export { PlannerTargetInput } from './PlannerTargetInput';
export { PlannerFlowDiagram } from './PlannerFlowDiagram';