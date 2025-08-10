/**
 * Items Package Exports
 * 
 * This module provides clean exports for all items-related functionality.
 * It allows importing from '@/components/items' instead of individual files.
 */
// UI Components
export { ItemIcon } from "./ItemIcon";
export { ItemsFilter } from "./ItemsFilter";
export { ItemsSearch } from "./ItemsSearch";
export { ItemsStats } from "./ItemsStats";
export { ItemsTable } from "./ItemsTable";
export { ItemRow } from "./ItemRow";
export { CorporationUsageBadge } from "./CorporationUsageBadge";

// Hooks and utilities
export { useItemsData, getCategoryDisplayName, getCategoryBadgeClass } from "./useItemsData";

// Types
export type {
  CorporationComponent,
  CorporationLevel,
  CorporationData,
  CorporationsData,
  CorporationUsage,
  Item,
} from "./types";
