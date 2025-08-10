import { useCallback, useMemo } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../state/sub-ids';
import type { Item, Building } from './types';

/**
 * Custom hook for managing planner color systems
 */
export const usePlannerColors = () => {
    const items = useSubscription<Item[]>([SUB_IDS.ITEMS]);

    // Color system for items (matching ItemsPage badge colors)
    const getItemColor = useCallback((itemId: string): string => {
        const item = items.find(i => i.id === itemId);
        if (!item) return '#6b7280'; // neutral gray

        const colorMap = {
            raw: '#3b82f6',      // blue (primary)
            processed: '#8b5cf6', // purple (secondary)
            component: '#06d6a0', // teal (accent)
            ammo: '#f59e0b',     // amber (warning)
            final: '#10b981',    // green (success)
        };

        return colorMap[item.type as keyof typeof colorMap] || '#6b7280';
    }, [items]);

    // Color system for buildings
    const getBuildingColor = useCallback((buildingId: string): string => {
        const colorMap = {
            ore_excavator: '#3b82f6',    // red - extraction
            helium_extractor: '#06b6d4', // cyan - gas extraction  
            smelter: '#f97316',          // orange - basic processing
            furnace: '#dc2626',          // red - high heat processing
            fabricator: '#8b5cf6',       // purple - manufacturing
        };

        return colorMap[buildingId as keyof typeof colorMap] || '#6b7280';
    }, []);

    return {
        getItemColor,
        getBuildingColor
    };
};

/**
 * Custom hook for getting selectable items for planner
 */
export const usePlannerSelectableItems = () => {
    const items = useSubscription<Item[]>([SUB_IDS.ITEMS]);

    // Memoized list of selectable items (excludes raw materials, sorted alphabetically)
    const selectableItems = useMemo(() => {
        return items.filter(item => item.type !== 'raw').sort((a, b) => a.name.localeCompare(b.name));
    }, [items]);

    return selectableItems;
};

/**
 * Custom hook for getting default output rate for an item
 */
export const usePlannerDefaultOutput = () => {
    const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);

    // Helper function to find the default output rate for an item
    const getDefaultOutputRate = useCallback((itemId: string): number => {
        for (const building of buildings) {
            for (const recipe of building.recipes) {
                if (recipe.output.id === itemId) {
                    return recipe.output.amount_per_minute;
                }
            }
        }
        return 60; // fallback if not found
    }, [buildings]);

    return getDefaultOutputRate;
};
