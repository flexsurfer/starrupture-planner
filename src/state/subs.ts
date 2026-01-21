import { regSub } from '@flexsurfer/reflex';
import { SUB_IDS } from './sub-ids';
import type { Item, Corporation } from './db';

// Root subscriptions
regSub(SUB_IDS.DATA_VERSION);
regSub(SUB_IDS.DATA_VERSIONS);
regSub(SUB_IDS.ITEMS);
regSub(SUB_IDS.ITEMS_MAP);
regSub(SUB_IDS.SELECTED_CATEGORY);
regSub(SUB_IDS.SEARCH_TERM);
regSub(SUB_IDS.CATEGORIES);
regSub(SUB_IDS.BUILDINGS);
regSub(SUB_IDS.CORPORATIONS);
regSub(SUB_IDS.THEME);
regSub(SUB_IDS.ACTIVE_TAB);
regSub(SUB_IDS.SELECTED_PLANNER_ITEM);
regSub(SUB_IDS.SELECTED_PLANNER_CORPORATION_LEVEL);

// Computed subscriptions
regSub(SUB_IDS.FILTERED_ITEMS,
    (category, searchTerm, items) => {
        let filtered = category === 'all'
            ? items
            : items.filter((item: Item) => item.type === category);

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter((item: Item) =>
                item.name.toLowerCase().includes(searchLower) ||
                item.id.toLowerCase().includes(searchLower)
            );
        }

        // Sort items alphabetically by name
        return [...filtered].sort((a: Item, b: Item) => a.name.localeCompare(b.name));
    },
    () => [[SUB_IDS.SELECTED_CATEGORY], [SUB_IDS.SEARCH_TERM], [SUB_IDS.ITEMS]]);

// Corporation with computed stats
regSub(SUB_IDS.CORPORATIONS_WITH_STATS,
    (corporations: Corporation[]) => {
        return corporations.map(corporation => ({
            ...corporation,
            stats: {
                totalLevels: corporation.levels.length,
                totalComponents: corporation.levels.reduce((sum, level) => sum + level.components.length, 0),
                totalCost: corporation.levels.reduce((sum, level) => sum + (level.xp ?? 0), 0)
            }
        }));
    },
    () => [[SUB_IDS.CORPORATIONS]]);

// Overall corporations statistics
regSub(SUB_IDS.CORPORATIONS_STATS,
    (corporationsWithStats: (Corporation & { stats: { totalLevels: number; totalComponents: number; totalCost: number } })[]) => {
        return {
            totalCorporations: corporationsWithStats.length,
            totalLevels: corporationsWithStats.reduce((total: number, corp) => total + corp.stats.totalLevels, 0),
            totalCost: corporationsWithStats.reduce((total: number, corp) => total + corp.stats.totalCost, 0)
        };
    },
    () => [[SUB_IDS.CORPORATIONS_WITH_STATS]]);

// Available corporation levels for selected planner item
interface CorporationLevelInfo {
    corporationName: string;
    corporationId: string;
    level: number;
    points: number;
    cost?: number | null;
}

regSub(SUB_IDS.PLANNER_AVAILABLE_CORPORATION_LEVELS,
    (selectedItem: string | null, corporations: Corporation[]): CorporationLevelInfo[] => {
        if (!selectedItem) return [];
        
        const levels: CorporationLevelInfo[] = [];
        for (const corporation of corporations) {
            for (const level of corporation.levels) {
                for (const component of level.components) {
                    if (component.id === selectedItem) {
                        levels.push({
                            corporationName: corporation.name,
                            corporationId: corporation.id,
                            level: level.level,
                            points: component.points,
                            cost: component.cost
                        });
                    }
                }
            }
        }
        return levels;
    },
    () => [[SUB_IDS.SELECTED_PLANNER_ITEM], [SUB_IDS.CORPORATIONS]]);
