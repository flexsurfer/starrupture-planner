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
  BaseDefenseBuilding,
  ProductionPlanSectionStats,
  BuildingRequirement,
} from './types';

// Main view components
export { BaseDetailView } from './BaseDetailView';
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
  CreateBaseModal,
  RenameBaseModal,
  CreateProductionPlanModal,
  ActivatePlanDialog,
  BuildingRequirementsModal,
} from './modals';

// Utils
export * from './utils';
