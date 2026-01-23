/**
 * Items Package Exports
 * 
 * This module provides clean exports for all items-related functionality.
 * It allows importing from '@/components/items' instead of individual files.
 */
// UI Components
export { ItemIcon } from "./components/ItemIcon";
export { ItemsFilter } from "./components/ItemsFilter";
export { BuildingSelector } from "./components/BuildingSelector";
export { ItemsSearch } from "./components/ItemsSearch";
export { ItemsStats } from "./components/ItemsStats";
export { ItemsTable } from "./components/ItemsTable";
export { ItemRow } from "./components/ItemRow";
export { CorporationUsageBadge } from "./components/CorporationUsageBadge";

// Hooks and utilities
export { useItemsData, getCategoryDisplayName, getCategoryBadgeClass, type ItemTableData } from "./hooks/useItemsData";
export { findItemRecipe, hasRecipe } from "./utils/recipeUtils";
export type { ItemRecipe } from "./utils/recipeUtils";

// Types
export type {
  CorporationComponent,
  CorporationLevel,
  CorporationData,
  CorporationsData,
  CorporationUsage,
  Item,
} from "./types";
