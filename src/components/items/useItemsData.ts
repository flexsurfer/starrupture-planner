import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../state/sub-ids";
import type { Item } from "../../state/db";
import buildingsData from "../../data/buildings_and_recipes.json";
import corporationsData from "../../data/corporations_components.json";
import type { CorporationsData, CorporationUsage } from "./types";

/**
 * Custom hook for items data and utilities
 */
export const useItemsData = () => {
  const filteredItems = useSubscription<Item[]>([SUB_IDS.FILTERED_ITEMS]);
  const selectedCategory = useSubscription<string>([SUB_IDS.SELECTED_CATEGORY]);
  const categories = useSubscription<string[]>([SUB_IDS.CATEGORIES]);

  // Helper function to find which building produces an item
  const findProducingBuilding = (itemId: string) => {
    for (const building of buildingsData) {
      for (const recipe of building.recipes) {
        if (recipe.output.id === itemId) {
          return building.name;
        }
      }
    }
    return "Raw Material"; // For items not produced by any building (raw materials)
  };

  // Helper function to find which corporations use an item
  const findCorporationUsage = (itemId: string): CorporationUsage[] => {
    const usage: CorporationUsage[] = [];
    
    Object.entries(corporationsData as CorporationsData).forEach(([corporationName, corporationData]) => {
      corporationData.levels.forEach((level) => {
        level.components.forEach((component) => {
          if (component.id === itemId) {
            usage.push({
              corporation: corporationName,
              level: level.level
            });
          }
        });
      });
    });
    
    return usage;
  };

  // Helper function to get corporation ID from corporation name
  const getCorporationId = (corporationName: string): string => {
    const corporationData = corporationsData as CorporationsData;
    return corporationData[corporationName]?.id || '';
  };

  return {
    filteredItems,
    selectedCategory,
    categories,
    findProducingBuilding,
    findCorporationUsage,
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
    ammo: 'badge-warning',
    final: 'badge-success',
  };
  return badgeClasses[type as keyof typeof badgeClasses] || 'badge-neutral';
};
