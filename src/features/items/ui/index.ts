/**
 * Items Package Exports
 * 
 * This module provides clean exports for all items-related functionality.
 * It exposes the items feature's React views and view helpers.
 */
// UI Components
export { ItemIcon } from "./components/ItemIcon";
export { ItemsFilter } from "./components/ItemsFilter";
export { BuildingSelector } from "./components/BuildingSelector";
export { ItemsSearch } from "./components/ItemsSearch";
export { ItemsStats } from "./components/ItemsStats";
export { ItemsTable } from "./components/ItemsTable";
export { ItemRow } from "./components/ItemRow";

// Hooks and utilities
export { useItemsData, getCategoryDisplayName, getCategoryBadgeClass } from "./hooks/useItemsData";
export { default as ItemsPage } from './ItemsPage';

// Types
export type {
  CorporationComponent,
  CorporationLevel,
  CorporationData,
  CorporationsData,
  CorporationUsage,
  ItemTableData,
  ItemsHelperLookups,
  Item,
} from '@/features/items/types';
