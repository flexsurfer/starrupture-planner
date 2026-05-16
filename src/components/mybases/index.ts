/**
 * MyBases Package Exports
 *
 * This module provides clean exports for all mybases-related functionality.
 * It allows importing from '@/components/mybases' instead of individual files.
 *
 * The mybases package is organized into subpackages:
 * - types: Shared type definitions
 * - components: UI components (cards, lists, sections)
 * - modals: Modal components for base and building management
 * - utils: Utility functions for building section management
 */

// Types
export type {
  BuildingSectionType,
  BaseDetailStats,
  BuildingSectionStats,
  BaseInputItem,
  BaseOutputItem,
  LinkableOutputItem,
  BaseDefenseBuilding,
  ProductionPlanSectionStats,
  BuildingRequirement,
  InputRequirement,
  SharedInputShortage,
  ProductionPlanSectionViewModel,
  ProductionPlanRequirementsStatus,
  PlanSummaryRow,
  MaterialBalanceRow,
  BuildingCoverageRow,
} from './types';

// Main view components
export { BaseDetailView } from './BaseDetailView';
export { BaseOverviewView } from './BaseOverviewView';
export { BaseBuildingsView } from './BaseBuildingsView';
export { BasePlansView } from './BasePlansView';

// Components
export {
  EmptyState,
  BaseCard,
  BasesList,
  BaseCoreInfo,
  BuildingSection,
  BuildingSectionCard,
  MyBasesStats,
  EmbeddedFlowDiagram,
  ProductionPlanSection,
} from './components';

// Modals
export {
  AddBuildingCardModal,
  LinkOutputModal,
  CreateBaseModal,
  RenameBaseModal,
  CreateProductionPlanModal,
  BuildingRequirementsModal,
  ManageEnergyGroupsModal,
} from './modals';

// Utils
export * from './utils';
