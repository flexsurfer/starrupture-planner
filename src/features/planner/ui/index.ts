/**
 * Planner Package Exports
 * 
 * React views for the planner feature.
 * 
 * The planner package is organized into subpackages:
 * - visualization: React Flow utilities and diagram component
 * - controls: Form components (selectors, inputs)
 * - stats: Statistics display components
 * - hooks: Shared React hooks
 */

export { default as PlannerPage } from './PlannerPage';

export {
    generateReactFlowData,
    type FlowDataGenerationParams,
    type FlowData,
    PlannerFlowDiagram,
} from './visualization';

export {
    PlannerItemSelector,
    PlannerTargetInput,
    PlannerCorporationLevelSelector,
    PlannerRecipeSelector,
} from './controls';

export {
    PlannerStatsModal,
    PlannerStatsDisplay,
} from './stats';

export {
    usePlannerDefaultOutput,
    useTargetAmount,
} from './hooks';
