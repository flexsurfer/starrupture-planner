import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { buildProductionFlow } from '@/components/planner/core/productionFlowBuilder';
import type {
    CorporationLevelInfo,
    PlannerBuildingStats,
    PlannerDetailedStatsItem,
} from '@/components/planner/core/types';
import { buildPlannerFlowGraph } from './flow-graph';
import { buildRecipeOptionsForOutputItems } from './recipe-options';
import { getItemName } from '@/utils/itemUtils';

export const registerPlannerSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.PLANNER_SELECTED_ITEM_ID, stateKeys.plannerSelectedItemId);
    registrar.regRootSub(appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL, stateKeys.plannerSelectedCorporationLevel);
    registrar.regRootSub(appIds.subscriptions.PLANNER_RECIPE_SELECTIONS, stateKeys.plannerRecipeSelections);
    registrar.regRootSub(appIds.subscriptions.PINNED_RECIPE_SELECTIONS, stateKeys.pinnedRecipeSelections);
    registrar.regRootSub(appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS, stateKeys.recipeAlternativePresets);
    registrar.regRootSub(appIds.subscriptions.PLANNER_TARGET_AMOUNT, stateKeys.plannerTargetAmount);

    registrar.regSub(
        appIds.subscriptions.PLANNER_AVAILABLE_CORPORATION_LEVELS,
        () => [[appIds.subscriptions.PLANNER_SELECTED_ITEM_ID], [appIds.subscriptions.CORPORATIONS_LIST]],
        ([selectedItem, corporations], ..._params) => {
            void _params;
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
                                cost: component.cost,
                            });
                        }
                    }
                }
            }
            return levels;
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_PRODUCTION_FLOW,
        () => [
            [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            [appIds.subscriptions.BUILDINGS_LIST],
            [appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL],
            [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
        ],
        ([selectedItem, targetAmount, buildings, selectedCorporationLevel, recipeSelections], ..._params) => {
            void _params;
            if (!selectedItem) return { nodes: [], edges: [] };
            return buildProductionFlow(
                {
                    targetItemId: selectedItem,
                    targetAmount: targetAmount > 0 ? targetAmount : 1,
                    includeLauncher: selectedCorporationLevel !== null,
                    recipeSelections,
                },
                buildings,
            );
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_RECIPE_OPTIONS,
        () => [
            [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            [appIds.subscriptions.BUILDINGS_LIST],
            [appIds.subscriptions.ITEMS_BY_ID_MAP],
            [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
        ],
        ([selectedItem, productionFlow, buildings, itemsById, recipeSelections], ..._params) => {
            void _params;
            if (!selectedItem || productionFlow.nodes.length === 0) return [];

            const outputItems = new Set<string>();
            for (const node of productionFlow.nodes) {
                if (node.nodeType === 'production') outputItems.add(node.outputItem);
            }
            return buildRecipeOptionsForOutputItems(outputItems, buildings, itemsById, recipeSelections);
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_FLOW_GRAPH,
        () => [[appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.ITEMS_LIST]],
        ([productionFlow, items], ..._params) => {
            void _params;
            return productionFlow.nodes.length === 0
                ? { nodes: [], edges: [] }
                : buildPlannerFlowGraph(productionFlow.nodes, productionFlow.edges, items);
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_STATS_SUMMARY,
        () => [[appIds.subscriptions.PLANNER_SELECTED_ITEM_ID], [appIds.subscriptions.PLANNER_PRODUCTION_FLOW]],
        ([selectedItem, productionFlow], ..._params) => {
            void _params;
            if (!selectedItem || productionFlow.nodes.length === 0) {
                return { totalBuildings: 0, totalEnergy: 0, totalHotness: 0 };
            }
            return {
                totalBuildings: productionFlow.nodes.reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0),
                totalEnergy: productionFlow.nodes.reduce((sum, node) => sum + node.totalPower, 0),
                totalHotness: productionFlow.nodes.reduce((sum, node) => sum + node.totalHeat, 0),
            };
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_STATS_DETAILED,
        () => [[appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.ITEMS_LIST]],
        ([productionFlow, items], ..._params) => {
            void _params;
            if (productionFlow.nodes.length === 0) {
                return {
                    buildingStats: [],
                    totalEnergy: 0,
                    totalHotness: 0,
                    totalBuildings: 0,
                    itemsByType: new Map(),
                    sortedTypes: [],
                };
            }

            const buildingMap = new Map<string, PlannerBuildingStats>();
            for (const node of productionFlow.nodes) {
                const existing = buildingMap.get(node.buildingId);
                if (existing) {
                    existing.count += Math.ceil(node.buildingCount);
                    existing.totalPower += node.totalPower;
                    existing.totalHeat += node.totalHeat;
                } else {
                    buildingMap.set(node.buildingId, {
                        buildingId: node.buildingId,
                        buildingName: node.buildingName,
                        count: Math.ceil(node.buildingCount),
                        totalPower: node.totalPower,
                        totalHeat: node.totalHeat,
                    });
                }
            }

            const itemsByType = new Map<string, PlannerDetailedStatsItem[]>();
            const itemIds = new Set<string>();
            productionFlow.nodes.forEach((node) => itemIds.add(node.outputItem));
            productionFlow.edges.forEach((edge) => itemIds.add(edge.itemId));
            for (const itemId of itemIds) {
                const item = items.find((entry) => entry.id === itemId);
                const type = item?.type || 'unknown';
                if (!itemsByType.has(type)) itemsByType.set(type, []);
                itemsByType.get(type)!.push({ id: itemId, name: getItemName(itemId, items), type });
            }
            itemsByType.forEach((entries) => entries.sort((a, b) => a.name.localeCompare(b.name)));

            const typeOrder = ['raw', 'processed', 'component', 'ammo', 'final'];
            const sortedTypes = Array.from(itemsByType.keys()).sort((a, b) => {
                const indexA = typeOrder.indexOf(a);
                const indexB = typeOrder.indexOf(b);
                if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });

            return {
                buildingStats: Array.from(buildingMap.values()).sort((a, b) => b.count - a.count),
                totalEnergy: productionFlow.nodes.reduce((sum, node) => sum + node.totalPower, 0),
                totalHotness: productionFlow.nodes.reduce((sum, node) => sum + node.totalHeat, 0),
                totalBuildings: productionFlow.nodes.reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0),
                itemsByType,
                sortedTypes,
            };
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_SELECTABLE_ITEMS,
        () => [[appIds.subscriptions.ITEMS_LIST]],
        ([items], ..._params) => {
            void _params;
            return items.filter((item) => item.type !== 'raw').sort((a, b) => a.name.localeCompare(b.name));
        },
    );
};
