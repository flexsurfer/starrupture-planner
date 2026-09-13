import { getActivePlannerTab } from './state';
import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { buildProductionFlow, buildMultiTargetProductionFlow } from '@/features/planner/production-flow';
import type {
    CorporationLevelInfo,
    PlannerBuildingStats,
    PlannerDetailedStatsItem,
} from '@/features/planner/types';
import { buildPlannerFlowGraph } from './flow-graph';
import { buildRecipeOptionsForOutputItems, collectRecipeOutputItems } from './recipe-options';
import { getMultiTargetWarning } from './target-conflicts';
import { getItemName } from '@/utils/itemUtils';

export const registerPlannerSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.PLANNER_TABS, stateKeys.plannerTabs);
    registrar.regRootSub(appIds.subscriptions.PLANNER_ACTIVE_TAB_ID, stateKeys.plannerActiveTabId);
    registrar.regRootSub(appIds.subscriptions.PLANNER_TAB_CREATION, stateKeys.plannerTabCreation);
    registrar.regSub(
        appIds.subscriptions.PLANNER_ACTIVE_TAB,
        () => [[appIds.subscriptions.PLANNER_TABS], [appIds.subscriptions.PLANNER_ACTIVE_TAB_ID]],
        ([plannerTabs, plannerActiveTabId]) => getActivePlannerTab({ plannerTabs, plannerActiveTabId }),
    );
    registrar.regSub(appIds.subscriptions.PLANNER_ACTIVE_VIEW,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.activeView ?? 'graph');
    registrar.regSub(appIds.subscriptions.PLANNER_GROUP_BY_STAGE,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.groupByStage ?? false);
    registrar.regSub(appIds.subscriptions.PLANNER_FLOW_DIRECTION,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.flowDirection ?? 'LR');
    registrar.regSub(appIds.subscriptions.PLANNER_MODE,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.mode ?? 'single');
    registrar.regSub(appIds.subscriptions.PLANNER_MULTI_TARGETS,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.multiTargets ?? []);
    registrar.regRootSub(appIds.subscriptions.PLANNER_TARGET_WARNING, stateKeys.plannerTargetWarning);
    registrar.regSub(
        appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING,
        () => [
            [appIds.subscriptions.PLANNER_MULTI_TARGETS],
            [appIds.subscriptions.BUILDINGS_LIST],
            [appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS],
            [appIds.subscriptions.ITEMS_LIST],
        ],
        ([targets, buildings, selections, items]) =>
            getMultiTargetWarning(targets.map(target => target.itemId), buildings, selections, items),
    );
    registrar.regSub(
        appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS,
        () => [[appIds.subscriptions.PLANNER_MODE], [appIds.subscriptions.PLANNER_MULTI_TARGETS], [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID]],
        ([mode, targets, selectedItem]) => mode === 'multi' ? targets.map(t => t.itemId) : selectedItem ? [selectedItem] : [],
    );
    registrar.regSub(appIds.subscriptions.PLANNER_SELECTED_ITEM_ID,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.selectedItemId ?? null);
    registrar.regSub(appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.selectedCorporationLevel ?? null);
    registrar.regSub(appIds.subscriptions.PLANNER_SINGLE_RECIPE_SELECTIONS,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.mode === 'single' ? tab.recipeSelections : {});
    registrar.regSub(appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.mode === 'multi' ? tab.recipeSelections : {});
    registrar.regSub(
        appIds.subscriptions.PLANNER_RECIPE_SELECTIONS,
        () => [[appIds.subscriptions.PLANNER_MODE], [appIds.subscriptions.PLANNER_SINGLE_RECIPE_SELECTIONS], [appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS]],
        ([mode, single, multi]) => mode === 'multi' ? multi : single,
    );
    registrar.regRootSub(appIds.subscriptions.PINNED_RECIPE_SELECTIONS, stateKeys.pinnedRecipeSelections);
    registrar.regRootSub(appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS, stateKeys.recipeAlternativePresets);
    registrar.regSub(appIds.subscriptions.PLANNER_TARGET_AMOUNT,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TAB]], ([tab]) => tab?.targetAmount ?? 60);

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
            [appIds.subscriptions.PLANNER_MODE],
            [appIds.subscriptions.PLANNER_MULTI_TARGETS],
            [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            [appIds.subscriptions.BUILDINGS_LIST],
            [appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL],
            [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
            [appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING],
        ],
        ([mode, targets, selectedItem, targetAmount, buildings, selectedCorporationLevel, recipeSelections, multiTargetWarning], ..._params) => {
            void _params;
            if (mode === 'multi') {
                // Depend on recipe data itself, so same-version updates are validated too.
                return multiTargetWarning
                    ? { nodes: [], edges: [], rawMaterialDeficits: [] }
                    : buildMultiTargetProductionFlow(targets, buildings, recipeSelections);
            }
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
            [appIds.subscriptions.PLANNER_MODE],
            [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS],
            [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            [appIds.subscriptions.BUILDINGS_LIST],
            [appIds.subscriptions.ITEMS_BY_ID_MAP],
            [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
        ],
        ([mode, selectedItem, productionFlow, buildings, itemsById, recipeSelections], ..._params) => {
            void _params;
            if (!selectedItem.length) return [];

            const outputItems = mode === 'multi' && productionFlow.nodes.length === 0
                ? collectRecipeOutputItems(selectedItem, buildings, recipeSelections)
                : new Set<string>();
            for (const node of productionFlow.nodes) {
                if (node.nodeType === 'production') outputItems.add(node.outputItem);
            }
            return buildRecipeOptionsForOutputItems(outputItems, buildings, itemsById, recipeSelections);
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_FLOW_GRAPH,
        () => [[appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.ITEMS_LIST], [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS], [appIds.subscriptions.PLANNER_FLOW_DIRECTION], [appIds.subscriptions.PLANNER_GROUP_BY_STAGE]],
        ([productionFlow, items, targetIds, direction, groupByStage], ..._params) => {
            void _params;
            return productionFlow.nodes.length === 0
                ? { nodes: [], edges: [] }
                : buildPlannerFlowGraph(productionFlow.nodes, productionFlow.edges, items, targetIds, direction, groupByStage);
        },
    );

    registrar.regSub(
        appIds.subscriptions.PLANNER_STATS_SUMMARY,
        () => [[appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS], [appIds.subscriptions.PLANNER_PRODUCTION_FLOW]],
        ([selectedItem, productionFlow], ..._params) => {
            void _params;
            if (!selectedItem.length || productionFlow.nodes.length === 0) {
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
        () => [[appIds.subscriptions.PLANNER_PRODUCTION_FLOW], [appIds.subscriptions.ITEMS_LIST], [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS]],
        ([productionFlow, items, selectedItemId], ..._params) => {
            void _params;
            if (productionFlow.nodes.length === 0) {
                return {
                    buildingStats: [],
                    productionGroups: [],
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
            // Sum all consumers of shared ingredients. Terminal outputs have no
            // outgoing edge, so use their production rate as a fallback.
            const requiredRates = new Map<string, number>();
            for (const edge of productionFlow.edges) {
                requiredRates.set(edge.itemId, (requiredRates.get(edge.itemId) ?? 0) + edge.amount);
            }
            const outputRates = new Map<string, number>();
            for (const node of productionFlow.nodes) {
                if (node.nodeType === 'launcher') continue;
                outputRates.set(node.outputItem, (outputRates.get(node.outputItem) ?? 0)
                    + node.outputAmount * node.buildingCount);
            }
            const itemIds = new Set<string>();
            productionFlow.nodes.forEach((node) => itemIds.add(node.outputItem));
            productionFlow.edges.forEach((edge) => itemIds.add(edge.itemId));
            for (const itemId of itemIds) {
                const item = items.find((entry) => entry.id === itemId);
                const type = item?.type || 'unknown';
                if (!itemsByType.has(type)) itemsByType.set(type, []);
                itemsByType.get(type)!.push({
                    id: itemId,
                    name: getItemName(itemId, items),
                    type,
                    requiredRate: requiredRates.get(itemId) ?? outputRates.get(itemId) ?? 0,
                });
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
                productionGroups: ['launcher', 'target', ...[...sortedTypes].reverse()].map(type => ({
                    type,
                    nodes: productionFlow.nodes.filter(node => {
                        if (node.nodeType === 'launcher') return type === 'launcher';
                        if (selectedItemId.includes(node.outputItem)) return type === 'target';
                        return type === (items.find(item => item.id === node.outputItem)?.type || 'unknown');
                    }).sort((a, b) => getItemName(a.outputItem, items).localeCompare(getItemName(b.outputItem, items))
                        || a.buildingName.localeCompare(b.buildingName) || a.recipeIndex - b.recipeIndex),
                })).filter(group => group.nodes.length > 0),
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
