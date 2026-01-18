import { useCallback } from "react";
import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../state/sub-ids";
import type { Item, Building, Corporation } from "../../state/db";
import type { CorporationUsage } from "./types";

/**
 * Custom hook for items data and utilities
 */
export const useItemsData = () => {
  const filteredItems = useSubscription<Item[]>([SUB_IDS.FILTERED_ITEMS]);
  const selectedCategory = useSubscription<string>([SUB_IDS.SELECTED_CATEGORY]);
  const categories = useSubscription<string[]>([SUB_IDS.CATEGORIES]);
  const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);
  const corporations = useSubscription<Corporation[]>([SUB_IDS.CORPORATIONS]);

  // Helper function to find which building produces an item
  const findProducingBuilding = useCallback((itemId: string) => {
    for (const building of buildings) {
      for (const recipe of building.recipes) {
        if (recipe.output.id === itemId) {
          return building.name;
        }
      }
    }
    return "Raw Material"; // For items not produced by any building (raw materials)
  }, [buildings]);

  // Helper function to find which corporations use an item
  const findCorporationUsage = useCallback((itemId: string): CorporationUsage[] => {
    const usage: CorporationUsage[] = [];
    
    for (const corporation of corporations) {
      for (const level of corporation.levels) {
        for (const component of level.components) {
          if (component.id === itemId) {
            usage.push({
              corporation: corporation.name,
              level: level.level
            });
          }
        }
      }
    }
    
    return usage;
  }, [corporations]);

  // Helper function to get corporation ID from corporation name
  const getCorporationId = useCallback((corporationName: string): string => {
    const corporation = corporations.find(c => c.name === corporationName);
    return corporation?.id || '';
  }, [corporations]);

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
