import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../../state/sub-ids";
import type { CorporationUsage } from "../types";

/**
 * Item table data with computed properties
 */
export interface ItemTableData {
  item: import("../../../state/db").Item;
  producingBuilding: string;
  corporationUsage: CorporationUsage[];
}

/**
 * Custom hook for items data and utilities
 * All computations are done in subscriptions, this hook just returns ready-to-use data
 */
export const useItemsData = () => {
  const itemsTableData = useSubscription<ItemTableData[]>([SUB_IDS.ITEMS_TABLE_DATA]);
  const selectedCategory = useSubscription<string>([SUB_IDS.SELECTED_CATEGORY]);
  const categories = useSubscription<string[]>([SUB_IDS.CATEGORIES]);
  const helperMaps = useSubscription<{
    corporationNameToId: Map<string, string>;
    buildingCorporationUsage: Map<string, CorporationUsage[]>;
  }>([SUB_IDS.ITEMS_HELPER_MAPS]);

  // Helper function to get corporation ID from corporation name
  const getCorporationId = (corporationName: string): string => {
    return helperMaps.corporationNameToId.get(corporationName) || '';
  };

  // Helper function to find which corporations reward a building
  const findBuildingCorporationUsage = (buildingName: string): CorporationUsage[] => {
    return helperMaps.buildingCorporationUsage.get(buildingName) || [];
  };

  return {
    itemsTableData,
    selectedCategory,
    categories,
    findBuildingCorporationUsage,
    getCorporationId,
  };
};

// Utility functions that don't need hooks
export const getCategoryDisplayName = (category: string) => {
  if (category === 'all') return 'All Items';
  return category.charAt(0).toUpperCase() + category.slice(1);
};

export const getCategoryBadgeClass = (type: string) => {
  const badgeClasses = {
    raw: 'badge-primary',
    processed: 'badge-secondary',
    component: 'badge-accent',
    material: 'badge-info',
    ammo: 'badge-warning',
    final: 'badge-success',
  };
  return badgeClasses[type as keyof typeof badgeClasses] || 'badge-neutral';
};
