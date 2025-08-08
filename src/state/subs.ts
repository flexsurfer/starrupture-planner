import { regSub } from '@flexsurfer/reflex';
import { SUB_IDS } from './sub-ids';
import type { Item, Corporation, Level } from './db';

// Root subscriptions
regSub(SUB_IDS.ITEMS);
regSub(SUB_IDS.ITEMS_MAP);
regSub(SUB_IDS.SELECTED_CATEGORY);
regSub(SUB_IDS.CATEGORIES);
regSub(SUB_IDS.BUILDINGS);
regSub(SUB_IDS.CORPORATIONS);
regSub(SUB_IDS.LEVELS);
regSub(SUB_IDS.LEVELS_MAP);
regSub(SUB_IDS.THEME);
regSub(SUB_IDS.ACTIVE_TAB);
regSub(SUB_IDS.SELECTED_PLANNER_ITEM);

// Computed subscriptions
regSub(SUB_IDS.FILTERED_ITEMS,
    (category, items) => {
        return category === 'all'
            ? items
            : items.filter((item: Item) => item.type === category);
    },
    () => [[SUB_IDS.SELECTED_CATEGORY], [SUB_IDS.ITEMS]]);

// Corporation with computed stats
regSub(SUB_IDS.CORPORATIONS_WITH_STATS,
    (corporations: Corporation[], levelsMap: Record<number, Level>) => {
        return corporations.map(corporation => ({
            ...corporation,
            stats: {
                totalLevels: corporation.levels.length,
                totalComponents: corporation.levels.reduce((sum, level) => sum + level.components.length, 0),
                totalCost: corporation.levels.reduce((sum, level) => {
                    const levelInfo = levelsMap[level.level];
                    return sum + (levelInfo ? levelInfo.cost : 0);
                }, 0)
            }
        }));
    },
    () => [[SUB_IDS.CORPORATIONS], [SUB_IDS.LEVELS_MAP]]);

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
