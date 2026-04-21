import { regSub } from '@flexsurfer/reflex';
import { SUB_IDS } from './sub-ids';
import type {
    Item,
    Recipe,
    Corporation,
    Building as DbBuilding,
    BuildingsByIdMap,
    Base,
    BasesById,
    BaseBuilding,
    EnergyGroup,
    Production,
    CreateProductionPlanModalState,
    CorporationLevelSelection,
} from './db';
import type {
    CorporationLevelInfo,
    PlannerBuildingStats,
    PlannerDetailedStats,
    PlannerDetailedStatsItem,
    PlannerRecipeOptionsItem,
    ProductionFlowResult,
    RawMaterialDeficitWithName,
} from '../components/planner/core/types';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import { generateReactFlowData } from '../components/planner/visualization/plannerFlowUtils';
import { getItemName } from '../utils/itemUtils';
import type { Node, Edge } from '@xyflow/react';
import { calculateBaseCoreHeatCapacity, isAmplifierBuilding, getCoreLevels } from '../components/mybases/utils/baseCoreUtils';
import { getAvailableBuildingsForSection, isBuildingAvailableForSection } from '../components/mybases/utils/buildingSectionUtils';
import { buildActivePlanOccupancy } from '../components/mybases/utils/activePlanOccupancy';
import { calculateSharedInputShortages } from '../components/mybases/utils/sharedInputShortages';
import { getSelectedFlowInputBuildings, sanitizeRecipeSelectionsForInputItems } from '../utils/productionPlanInputs';
import type { CorporationWithStats } from '../components/corporations/types';
import type { CorporationUsage, ItemTableData, ItemsHelperLookups } from '../components/items/types';
import type {
    BaseDetailStats,
    BuildingSectionBuilding,
    BuildingSectionStats,
    BaseInputItem,
    BaseOutputItem,
    BaseDefenseBuilding,
    BuildingSectionType,
    MyBasesStats,
    ProductionPlanSectionStats,
    BuildingRequirement,
    InputRequirement,
    SharedInputShortage,
    ProductionPlanSectionViewModel,
    ProductionPlanRequirementsStatus,
    PlanSummaryRow,
    MaterialBalanceRow,
    BuildingCoverageRow,
} from '../components/mybases/types';
//============================================================
// Root subscriptions
//============================================================
regSub(SUB_IDS.APP_DATA_VERSION, "appDataVersion");
regSub(SUB_IDS.APP_DATA_VERSIONS, "appDataVersions");
regSub(SUB_IDS.ITEMS_LIST, "itemsList");
regSub(SUB_IDS.ITEMS_BY_ID_MAP, "itemsById");
regSub(SUB_IDS.ITEMS_SELECTED_CATEGORY, "itemsSelectedCategory");
regSub(SUB_IDS.ITEMS_SELECTED_BUILDING, "itemsSelectedBuilding");
regSub(SUB_IDS.ITEMS_SEARCH_TERM, "itemsSearchTerm");
regSub(SUB_IDS.ITEMS_CATEGORIES, "itemsCategories");
regSub(SUB_IDS.BUILDINGS_LIST, "buildingsList");
regSub(SUB_IDS.CORPORATIONS_LIST, "corporationsList");
regSub(SUB_IDS.UI_THEME, "uiTheme");
regSub(SUB_IDS.UI_GAME_DATA_LOAD_PENDING, "uiGameDataLoadPending");
regSub(SUB_IDS.UI_ACTIVE_TAB, "uiActiveTab");
regSub(SUB_IDS.PLANNER_SELECTED_ITEM_ID, "plannerSelectedItemId");
regSub(SUB_IDS.PLANNER_SELECTED_CORPORATION_LEVEL, "plannerSelectedCorporationLevel");
regSub(SUB_IDS.PLANNER_RECIPE_SELECTIONS, "plannerRecipeSelections");
regSub(SUB_IDS.PLANNER_TARGET_AMOUNT, "plannerTargetAmount");
regSub(SUB_IDS.BASES_LIST, "basesList");
regSub(SUB_IDS.BASES_SELECTED_BASE_ID, "basesSelectedBaseId");
regSub(SUB_IDS.UI_CONFIRMATION_DIALOG, "uiConfirmationDialog");
regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_STATE, "productionPlanModalState");
regSub(SUB_IDS.ENERGY_GROUPS_LIST, "energyGroups");

//============================================================
// Items, buildings, corporations subscriptions
//============================================================
regSub(SUB_IDS.BUILDINGS_BY_ID_MAP,
    (buildings: DbBuilding[]): BuildingsByIdMap => {
        const byId: BuildingsByIdMap = {};
        for (const building of buildings) {
            byId[building.id] = building;
        }
        return byId;
    },
    () => [[SUB_IDS.BUILDINGS_LIST]]);

regSub(SUB_IDS.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS,
    (buildings: DbBuilding[]) => {
        const buildingNames = new Set<string>();
        buildingNames.add('all'); // Add 'all' option
        buildings.forEach(building => {
            // Only include production type buildings
            if (building.type === 'production') {
                buildingNames.add(building.name);
            }
        });
        return Array.from(buildingNames).sort();
    },
    () => [[SUB_IDS.BUILDINGS_LIST]]);

regSub(SUB_IDS.ITEMS_FILTERED_LIST,
    (category, selectedBuilding, searchTerm, items, buildings) => {
        let filtered = category === 'all'
            ? items
            : items.filter((item: Item) => item.type === category);

        // Filter by building
        if (selectedBuilding !== 'all') {
            const itemsProducedByBuilding = new Set<string>();
            buildings.forEach((building: DbBuilding) => {
                if (building.name === selectedBuilding) {
                    building.recipes?.forEach(recipe => {
                        itemsProducedByBuilding.add(recipe.output.id);
                    });
                }
            });
            filtered = filtered.filter((item: Item) =>
                itemsProducedByBuilding.has(item.id)
            );
        }

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
    () => [[SUB_IDS.ITEMS_SELECTED_CATEGORY], [SUB_IDS.ITEMS_SELECTED_BUILDING], [SUB_IDS.ITEMS_SEARCH_TERM], [SUB_IDS.ITEMS_LIST], [SUB_IDS.BUILDINGS_LIST]]);

regSub(SUB_IDS.ITEMS_TABLE_ROWS,
    (filteredItems: Item[], buildings: DbBuilding[], corporations: Corporation[]): ItemTableData[] => {
        // Build producing buildings map
        const producingBuildingsMap = new Map<string, Map<string, number>>();
        for (const building of buildings) {
            for (const recipe of building.recipes || []) {
                if (!producingBuildingsMap.has(recipe.output.id)) {
                    producingBuildingsMap.set(recipe.output.id, new Map<string, number>());
                }
                const buildingRates = producingBuildingsMap.get(recipe.output.id)!;
                const existingRate = buildingRates.get(building.name);
                // Keep the slowest known rate per building for this output item.
                if (existingRate === undefined || recipe.output.amount_per_minute < existingRate) {
                    buildingRates.set(building.name, recipe.output.amount_per_minute);
                }
            }
        }

        // Build corporation usage map
        const corporationUsageMap = new Map<string, CorporationUsage[]>();
        for (const corporation of corporations) {
            for (const level of corporation.levels) {
                for (const component of level.components) {
                    if (!corporationUsageMap.has(component.id)) {
                        corporationUsageMap.set(component.id, []);
                    }
                    corporationUsageMap.get(component.id)!.push({
                        corporation: corporation.name,
                        level: level.level
                    });
                }
            }
        }

        // Map filtered items to table data
        return filteredItems.map(item => ({
            item,
            producingBuildings: Array.from((producingBuildingsMap.get(item.id) || new Map<string, number>()).entries())
                .sort((a, b) => {
                    if (a[1] !== b[1]) return a[1] - b[1];
                    return a[0].localeCompare(b[0]);
                })
                .map(([buildingName]) => buildingName),
            corporationUsage: corporationUsageMap.get(item.id) || []
        }));
    },
    () => [[SUB_IDS.ITEMS_FILTERED_LIST], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.CORPORATIONS_LIST]]);

regSub(SUB_IDS.ITEMS_HELPER_LOOKUPS,
    (corporations: Corporation[]): ItemsHelperLookups => {
        const corporationNameToId = new Map<string, string>();
        const buildingCorporationUsage = new Map<string, CorporationUsage[]>();

        for (const corporation of corporations) {
            corporationNameToId.set(corporation.name, corporation.id);

            for (const level of corporation.levels) {
                for (const reward of level.rewards) {
                    if (!buildingCorporationUsage.has(reward.name)) {
                        buildingCorporationUsage.set(reward.name, []);
                    }
                    buildingCorporationUsage.get(reward.name)!.push({
                        corporation: corporation.name,
                        level: level.level
                    });
                }
            }
        }

        return {
            corporationNameToId,
            buildingCorporationUsage
        };
    },
    () => [[SUB_IDS.CORPORATIONS_LIST]]);

regSub(SUB_IDS.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID,
    (items: Item[], buildings: DbBuilding[], buildingId: string): Item[] => {
        const building = buildings.find(b => b.id === buildingId);
        if (!building) return [];

        if (building.id === 'package_receiver' || building.id === 'package_dispatcher' || building.id === 'orbital_cargo_launcher' || building.type === 'storage' || building.id === 'drone_merger_3_to_1') {
            // For package_receiver, output buildings, and drone_merger_3_to_1, all items are available
            return [...items].sort((a, b) => a.name.localeCompare(b.name));
        } else {
            // For other input buildings, get items from recipe outputs
            const itemIds = new Set<string>();
            building.recipes?.forEach(recipe => {
                itemIds.add(recipe.output.id);
            });

            return [...items]
                .filter(item => itemIds.has(item.id))
                .sort((a, b) => a.name.localeCompare(b.name));
        }
    },
    () => [[SUB_IDS.ITEMS_LIST], [SUB_IDS.BUILDINGS_LIST]]);

regSub(SUB_IDS.ITEMS_RECIPES_BY_INPUT_ITEM_ID,
    (buildings: DbBuilding[], itemId: string): { recipe: Recipe; building: DbBuilding }[] => {
        if (!itemId) return [];

        const results: { recipe: Recipe; building: DbBuilding }[] = [];
        for (const building of buildings) {
            for (const recipe of building.recipes || []) {
                if (recipe.inputs.some(input => input.id === itemId)) {
                    results.push({ recipe, building });
                }
            }
        }
        return results;
    },
    () => [[SUB_IDS.BUILDINGS_LIST]]);

regSub(SUB_IDS.BUILDINGS_SORTED_PRODUCTION_LIST,
    (buildings: DbBuilding[], helperMaps: ItemsHelperLookups): DbBuilding[] => {
        const productionBuildings = buildings.filter(building => building.type === 'production');

        const sorted = [...productionBuildings].sort((a, b) => {
            const usageA = helperMaps.buildingCorporationUsage.get(a.name) || [];
            const usageB = helperMaps.buildingCorporationUsage.get(b.name) || [];

            const minLevelA = usageA.length > 0 ? Math.min(...usageA.map(u => u.level)) : Infinity;
            const minLevelB = usageB.length > 0 ? Math.min(...usageB.map(u => u.level)) : Infinity;

            // Buildings with corporation rewards come first
            if (minLevelA === Infinity && minLevelB !== Infinity) return 1;
            if (minLevelA !== Infinity && minLevelB === Infinity) return -1;

            // If both have rewards, sort by level, then by name
            if (minLevelA !== Infinity && minLevelB !== Infinity) {
                if (minLevelA !== minLevelB) return minLevelA - minLevelB;
                return a.name.localeCompare(b.name);
            }

            // If neither has rewards, sort by name
            return a.name.localeCompare(b.name);
        });

        // Keep upgraded variants directly after their base building using explicit JSON mapping.
        const buildingsById = new Map<string, DbBuilding>(sorted.map(building => [building.id, building]));
        const upgradeTargetIds = new Set<string>();
        for (const building of sorted) {
            if (building.upgrade) {
                upgradeTargetIds.add(building.upgrade);
            }
        }

        const result: DbBuilding[] = [];
        const emittedIds = new Set<string>();

        for (const building of sorted) {
            if (emittedIds.has(building.id)) continue;

            if (upgradeTargetIds.has(building.id)) {
                // Delay upgraded entries until their base building is emitted.
                continue;
            }

            result.push(building);
            emittedIds.add(building.id);

            const upgradedBuilding = building.upgrade ? buildingsById.get(building.upgrade) : undefined;
            if (upgradedBuilding && !emittedIds.has(upgradedBuilding.id)) {
                result.push(upgradedBuilding);
                emittedIds.add(upgradedBuilding.id);
            }
        }

        // Append any remaining entries (for example targets without a visible base counterpart).
        for (const building of sorted) {
            if (!emittedIds.has(building.id)) {
                result.push(building);
                emittedIds.add(building.id);
            }
        }

        return result;
    },
    () => [[SUB_IDS.BUILDINGS_LIST], [SUB_IDS.ITEMS_HELPER_LOOKUPS]]);

regSub(SUB_IDS.CORPORATIONS_LIST_WITH_STATS,
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
    () => [[SUB_IDS.CORPORATIONS_LIST]]);

regSub(SUB_IDS.CORPORATIONS_STATS_SUMMARY,
    (corporationsWithStats: CorporationWithStats[]) => {
        return {
            totalCorporations: corporationsWithStats.length,
            totalLevels: corporationsWithStats.reduce((total: number, corp) => total + corp.stats.totalLevels, 0),
            totalCost: corporationsWithStats.reduce((total: number, corp) => total + corp.stats.totalCost, 0)
        };
    },
    () => [[SUB_IDS.CORPORATIONS_LIST_WITH_STATS]]);

//============================================================
// Planner subscriptions
//============================================================
function buildRecipeOptionsForOutputItems(
    outputItems: Set<string>,
    buildings: DbBuilding[],
    itemsById: Record<string, Item>,
    recipeSelections: Record<string, string>
): PlannerRecipeOptionsItem[] {
    const optionsByItem = new Map<string, PlannerRecipeOptionsItem>();

    for (const building of buildings) {
        for (let recipeIndex = 0; recipeIndex < (building.recipes || []).length; recipeIndex++) {
            const recipe = building.recipes![recipeIndex];
            const itemId = recipe.output.id;
            if (!outputItems.has(itemId)) continue;

            if (!optionsByItem.has(itemId)) {
                optionsByItem.set(itemId, {
                    itemId,
                    itemName: itemsById[itemId]?.name || itemId,
                    options: [],
                    selectedKey: '',
                    defaultKey: ''
                });
            }

            optionsByItem.get(itemId)!.options.push({
                key: `${building.id}:${recipeIndex}`,
                buildingId: building.id,
                buildingName: building.name,
                recipeIndex,
                outputRate: recipe.output.amount_per_minute
            });
        }
    }

    const result: PlannerRecipeOptionsItem[] = [];
    optionsByItem.forEach((entry) => {
        if (entry.options.length <= 1) return;

        entry.options.sort((a, b) => {
            if (a.outputRate !== b.outputRate) return a.outputRate - b.outputRate;
            const nameDiff = a.buildingName.localeCompare(b.buildingName);
            if (nameDiff !== 0) return nameDiff;
            return a.recipeIndex - b.recipeIndex;
        });

        entry.defaultKey = entry.options[0].key;
        const selectedKey = recipeSelections[entry.itemId];
        const hasSelected = !!selectedKey && entry.options.some((option) => option.key === selectedKey);
        entry.selectedKey = hasSelected ? selectedKey! : entry.defaultKey;
        result.push(entry);
    });

    return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
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
    () => [[SUB_IDS.PLANNER_SELECTED_ITEM_ID], [SUB_IDS.CORPORATIONS_LIST]]);

regSub(SUB_IDS.PLANNER_PRODUCTION_FLOW,
    (
        selectedItem: string | null,
        targetAmount: number,
        buildings: DbBuilding[],
        selectedCorporationLevel: CorporationLevelSelection | null,
        recipeSelections: Record<string, string>
    ): ProductionFlowResult => {
        if (!selectedItem) {
            return { nodes: [], edges: [] };
        }

        const validAmount = targetAmount > 0 ? targetAmount : 1;
        // Only include launcher if a corporation level is selected
        const includeLauncher = selectedCorporationLevel !== null;
        return buildProductionFlow(
            { targetItemId: selectedItem, targetAmount: validAmount, includeLauncher, recipeSelections },
            buildings
        );
    },
    () => [[SUB_IDS.PLANNER_SELECTED_ITEM_ID], [SUB_IDS.PLANNER_TARGET_AMOUNT], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.PLANNER_SELECTED_CORPORATION_LEVEL], [SUB_IDS.PLANNER_RECIPE_SELECTIONS]]);

regSub(SUB_IDS.PLANNER_RECIPE_OPTIONS,
    (
        selectedItem: string | null,
        productionFlow: ProductionFlowResult,
        buildings: DbBuilding[],
        itemsById: Record<string, Item>,
        recipeSelections: Record<string, string>
    ): PlannerRecipeOptionsItem[] => {
        if (!selectedItem || !productionFlow?.nodes?.length) return [];

        const outputItems = new Set<string>();
        for (const node of productionFlow.nodes) {
            if (node.nodeType === 'production') {
                outputItems.add(node.outputItem);
            }
        }

        return buildRecipeOptionsForOutputItems(outputItems, buildings, itemsById, recipeSelections);
    },
    () => [[SUB_IDS.PLANNER_SELECTED_ITEM_ID], [SUB_IDS.PLANNER_PRODUCTION_FLOW], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.ITEMS_BY_ID_MAP], [SUB_IDS.PLANNER_RECIPE_SELECTIONS]]);

regSub(SUB_IDS.PLANNER_FLOW_GRAPH,
    (productionFlow: ProductionFlowResult, items: Item[]): { nodes: Node[]; edges: Edge[] } => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return { nodes: [], edges: [] };
        }

        return generateReactFlowData({
            flowNodes: productionFlow.nodes,
            flowEdges: productionFlow.edges,
            items
        });
    },
    () => [[SUB_IDS.PLANNER_PRODUCTION_FLOW], [SUB_IDS.ITEMS_LIST]]);

regSub(SUB_IDS.PLANNER_STATS_SUMMARY,
    (selectedItem: string | null, productionFlow: ProductionFlowResult): { totalBuildings: number; totalEnergy: number; totalHotness: number } => {
        if (!selectedItem || !productionFlow || productionFlow.nodes.length === 0) {
            return { totalBuildings: 0, totalEnergy: 0, totalHotness: 0 };
        }
        const totalBuildings = productionFlow.nodes.reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0);
        const totalEnergy = productionFlow.nodes.reduce((sum, node) => sum + node.totalPower, 0);
        const totalHotness = productionFlow.nodes.reduce((sum, node) => sum + node.totalHeat, 0);
        return { totalBuildings, totalEnergy, totalHotness };
    },
    () => [[SUB_IDS.PLANNER_SELECTED_ITEM_ID], [SUB_IDS.PLANNER_PRODUCTION_FLOW]]);

regSub(SUB_IDS.PLANNER_STATS_DETAILED,
    (productionFlow: ProductionFlowResult, items: Item[]): PlannerDetailedStats => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return {
                buildingStats: [],
                totalEnergy: 0,
                totalHotness: 0,
                totalBuildings: 0,
                itemsByType: new Map(),
                sortedTypes: []
            };
        }

        const { nodes, edges } = productionFlow;

        // Group buildings by type and sum counts
        const buildingMap = new Map<string, PlannerBuildingStats>();

        nodes.forEach(node => {
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
                    totalHeat: node.totalHeat
                });
            }
        });

        // Convert map to sorted array
        const buildingStats = Array.from(buildingMap.values())
            .sort((a, b) => b.count - a.count);

        // Calculate total energy (sum of all totalPower)
        const totalEnergy = nodes.reduce((sum, node) => sum + node.totalPower, 0);

        // Calculate total hotness (sum of all totalHeat)
        const totalHotness = nodes.reduce((sum, node) => sum + node.totalHeat, 0);

        // Calculate total buildings (sum of all buildingCount, rounded up)
        const totalBuildings = nodes.reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0);

        // Collect all unique items used
        const itemsUsed = new Set<string>();

        // Add items from nodes (output items)
        nodes.forEach(node => {
            itemsUsed.add(node.outputItem);
        });

        // Add items from edges (transferred items)
        edges.forEach(edge => {
            itemsUsed.add(edge.itemId);
        });

        // Convert to array with item data and group by type
        const itemsWithData = Array.from(itemsUsed)
            .map(itemId => {
                const item = items.find(i => i.id === itemId);
                return {
                    id: itemId,
                    name: getItemName(itemId, items),
                    type: item?.type || 'unknown'
                };
            });

        // Group items by type
        const itemsByType = new Map<string, PlannerDetailedStatsItem[]>();
        itemsWithData.forEach(item => {
            const type = item.type;
            if (!itemsByType.has(type)) {
                itemsByType.set(type, []);
            }
            itemsByType.get(type)!.push(item);
        });

        // Sort items within each type by name
        itemsByType.forEach((itemsList) => {
            itemsList.sort((a, b) => a.name.localeCompare(b.name));
        });

        // Sort types in a specific order
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
            buildingStats,
            totalEnergy,
            totalHotness,
            totalBuildings,
            itemsByType,
            sortedTypes
        };
    },
    () => [[SUB_IDS.PLANNER_PRODUCTION_FLOW], [SUB_IDS.ITEMS_LIST]]);

regSub(SUB_IDS.PLANNER_SELECTABLE_ITEMS,
    (items: Item[]): Item[] => {
        return items.filter(item => item.type !== 'raw').sort((a, b) => a.name.localeCompare(b.name));
    },
    () => [[SUB_IDS.ITEMS_LIST]]);

//============================================================
// Energy Groups subscriptions
//============================================================
regSub(SUB_IDS.ENERGY_GROUPS_BY_ID_MAP,
    (groups: EnergyGroup[]): Record<string, EnergyGroup> => {
        const byId: Record<string, EnergyGroup> = {};
        for (const group of groups) {
            byId[group.id] = group;
        }
        return byId;
    },
    () => [[SUB_IDS.ENERGY_GROUPS_LIST]]);

//============================================================
// Bases subscriptions
//============================================================
interface ConfiguredSectionItem {
    baseBuildingId: string;
    item: Item;
    ratePerMinute: number;
    building: DbBuilding;
    name: string;
    description: string;
}

function collectConfiguredSectionItems(
    base: Base,
    buildingsById: BuildingsByIdMap,
    itemsMap: Record<string, Item>,
    sectionType: 'inputs' | 'outputs'
): ConfiguredSectionItem[] {
    const items: ConfiguredSectionItem[] = [];

    for (const baseBuilding of base.buildings) {
        if (baseBuilding.sectionType !== sectionType) continue;
        if (!baseBuilding.selectedItemId || !baseBuilding.ratePerMinute) continue;

        const building = buildingsById[baseBuilding.buildingTypeId];
        if (!building) continue;

        const item = itemsMap[baseBuilding.selectedItemId];
        if (!item) continue;

        items.push({
            baseBuildingId: baseBuilding.id,
            item,
            ratePerMinute: baseBuilding.ratePerMinute,
            building,
            name: baseBuilding.name || '',
            description: baseBuilding.description || '',
        });
    }

    return items;
}

regSub(SUB_IDS.BASES_BY_ID_MAP,
    (bases: Base[]): BasesById => {
        const basesById: BasesById = {};
        bases.forEach((base) => {
            basesById[base.id] = base;
        });
        return basesById;
    },
    () => [[SUB_IDS.BASES_LIST]]);

regSub(SUB_IDS.BASES_SELECTED_BASE,
    (selectedBaseId: string | null, basesById: BasesById): Base | null => {
        if (!selectedBaseId) return null;
        return basesById[selectedBaseId] || null;
    },
    () => [[SUB_IDS.BASES_SELECTED_BASE_ID], [SUB_IDS.BASES_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_BASE_BY_ID,
    (basesById: BasesById, baseId: string): Base | null => {
        if (!baseId) return null;
        return basesById[baseId] || null;
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP]]);

/** Pooled energy context — aggregated generation/consumption across an energy group. */
interface PooledEnergyContext {
    pooledGeneration: number;
    pooledConsumption: number;
}

/**
 * Calculate pooled energy for all bases in the same energy group.
 * Returns null if the base doesn't belong to a group.
 */
function calculatePooledEnergy(
    base: Base,
    allBases: Base[],
    buildingsById: BuildingsByIdMap,
    energyGroupsById: Record<string, EnergyGroup>,
): PooledEnergyContext | null {
    if (!base.energyGroupId) return null;
    if (!energyGroupsById[base.energyGroupId]) return null;

    let pooledGeneration = 0;
    let pooledConsumption = 0;

    for (const b of allBases) {
        if (b.energyGroupId !== base.energyGroupId) continue;
        for (const bb of b.buildings) {
            const buildingType = buildingsById[bb.buildingTypeId];
            if (!buildingType) continue;
            if (buildingType.type === 'generator') {
                pooledGeneration += buildingType.power || 0;
            } else {
                pooledConsumption += buildingType.power || 0;
            }
        }
    }

    return { pooledGeneration, pooledConsumption };
}

// Helper function to calculate stats for a base
function calculateBaseDetailStats(
    base: Base,
    buildingsById: BuildingsByIdMap,
    energyGroupsById?: Record<string, EnergyGroup>,
    allBases?: Base[],
): BaseDetailStats {
    let totalHeat = 0;
    let energyGeneration = 0;
    let energyConsumption = 0;

    base.buildings.forEach((baseBuilding: BaseBuilding) => {
        const buildingType = buildingsById[baseBuilding.buildingTypeId];
        if (buildingType) {
            totalHeat += buildingType.heat || 0;

            // Generators produce energy, other buildings consume it
            if (buildingType.type === 'generator') {
                energyGeneration += buildingType.power || 0;
            } else {
                energyConsumption += buildingType.power || 0;
            }
        }
    });

    // If this base belongs to an energy group, use pooled energy values
    const pooled = allBases && energyGroupsById
        ? calculatePooledEnergy(base, allBases, buildingsById, energyGroupsById)
        : null;
    const effectiveGeneration = pooled ? pooled.pooledGeneration : energyGeneration;
    const effectiveConsumption = energyConsumption;
    const energyGridConsumption = pooled ? pooled.pooledConsumption : energyConsumption;

    const coreLevel = base.coreLevel ?? 0;
    const baseCoreHeatCapacity = calculateBaseCoreHeatCapacity(coreLevel, base.buildings, buildingsById);
    const heatPercentage = Math.min((totalHeat / baseCoreHeatCapacity) * 100, 100);
    // Calculate energy percentage: used / available (similar to heat)
    // If no generation, show full red bar (100%)
    const energyPercentage = effectiveGeneration > 0
        ? Math.min((effectiveConsumption / effectiveGeneration) * 100, 100)
        : effectiveConsumption > 0
            ? 100 // Full red bar when consuming but no generation
            : 0;

    const isHeatOverCapacity = totalHeat > baseCoreHeatCapacity;
    const hasEnergyLoad = effectiveConsumption > 0;
    const isEnergyInsufficient = hasEnergyLoad && (effectiveGeneration === 0 || effectiveConsumption > effectiveGeneration);

    // Energy group info
    const energyGroupId = base.energyGroupId;
    const energyGroupName = energyGroupId && energyGroupsById
        ? energyGroupsById[energyGroupId]?.name
        : undefined;

    return {
        baseName: base.name,
        coreLevel,
        buildingCount: base.buildings.length,
        totalHeat,
        energyGeneration: effectiveGeneration,
        energyConsumption: effectiveConsumption,
        energyGridConsumption,
        baseCoreHeatCapacity,
        heatPercentage,
        energyPercentage,
        isHeatOverCapacity,
        isEnergyInsufficient,
        energyGroupId,
        energyGroupName,
    };
}

regSub(SUB_IDS.BASES_SELECTED_BASE_DETAIL_STATS,
    (selectedBase: Base | null, buildingsById: BuildingsByIdMap, energyGroupsById: Record<string, EnergyGroup>, allBases: Base[]): BaseDetailStats | null => {
        if (!selectedBase) return null;
        return calculateBaseDetailStats(selectedBase, buildingsById, energyGroupsById, allBases);
    },
    () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ENERGY_GROUPS_BY_ID_MAP], [SUB_IDS.BASES_LIST]]);

regSub(SUB_IDS.BASES_CORE_LEVELS,
    (buildingsById: BuildingsByIdMap): { level: number; heatCapacity: number }[] => {
        return getCoreLevels(buildingsById);
    },
    () => [[SUB_IDS.BUILDINGS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_DETAIL_STATS_BY_BASE_ID,
    (basesById: BasesById, buildingsById: BuildingsByIdMap, energyGroupsById: Record<string, EnergyGroup>, allBases: Base[], baseId: string): BaseDetailStats | null => {
        const base = basesById[baseId];
        if (!base) return null;
        return calculateBaseDetailStats(base, buildingsById, energyGroupsById, allBases);
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ENERGY_GROUPS_BY_ID_MAP], [SUB_IDS.BASES_LIST]]);

regSub(SUB_IDS.BASES_INPUT_ITEMS_BY_BASE_ID,
    (basesById: BasesById, buildingsById: BuildingsByIdMap, itemsMap: Record<string, Item>, baseId: string): BaseInputItem[] => {
        const base = basesById[baseId];
        if (!base) return [];

        return collectConfiguredSectionItems(base, buildingsById, itemsMap, 'inputs').map((entry) => ({
            baseBuildingId: entry.baseBuildingId,
            item: entry.item,
            ratePerMinute: entry.ratePerMinute,
            building: entry.building,
            name: entry.name,
            description: entry.description,
        }));
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_OUTPUT_ITEMS_BY_BASE_ID,
    (basesById: BasesById, buildingsById: BuildingsByIdMap, itemsMap: Record<string, Item>, baseId: string): BaseOutputItem[] => {
        const base = basesById[baseId];
        if (!base) return [];

        return collectConfiguredSectionItems(base, buildingsById, itemsMap, 'outputs').map((entry) => ({
            item: entry.item,
            ratePerMinute: entry.ratePerMinute,
            building: entry.building,
        }));
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_DEFENSE_BUILDINGS_BY_BASE_ID,
    (basesById: BasesById, buildingsById: BuildingsByIdMap, baseId: string): BaseDefenseBuilding[] => {
        const base = basesById[baseId];
        if (!base) return [];

        const defenseMap = new Map<string, BaseDefenseBuilding>();

        base.buildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildingsById[baseBuilding.buildingTypeId];
            if (building && building.type === 'defense') {
                const existing = defenseMap.get(building.id);
                if (existing) {
                    existing.count += 1;
                } else {
                    defenseMap.set(building.id, { building, count: 1 });
                }
            }
        });

        return Array.from(defenseMap.values());
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_BUILDING_SECTION_BUILDINGS,
    (base: Base | null, buildingsById: BuildingsByIdMap, _baseId: string, sectionType: BuildingSectionType): BuildingSectionBuilding[] => {
        if (!base) return [];

        const sectionBuildings = base.buildings.filter(b => b.sectionType === sectionType);
        if (sectionBuildings.length === 0) return [];

        // Build active-plan highlight map for the entire base.
        // Production buildings overlap only when free buildings are exhausted.
        const activePlansById = new Map<string, Production>();
        (base.productions || [])
            .filter((plan) => plan.active)
            .forEach((plan) => {
                activePlansById.set(plan.id, plan);
            });

        const occupancy = buildActivePlanOccupancy(base);
        const planNamesByBuildingId = new Map<string, Set<string>>();
        const addPlanName = (buildingId: string, planName: string) => {
            if (!buildingId || !planName) return;
            let set = planNamesByBuildingId.get(buildingId);
            if (!set) {
                set = new Set<string>();
                planNamesByBuildingId.set(buildingId, set);
            }
            set.add(planName);
        };

        const baseBuildingIds = new Set(base.buildings.map((b) => b.id));
        occupancy.assignedPlanBuildingIds.forEach((buildingIds, planId) => {
            const planName = activePlansById.get(planId)?.name;
            if (!planName) return;
            buildingIds.forEach((buildingId) => {
                addPlanName(buildingId, planName);
            });
        });
        (base.productions || [])
            .filter((plan) => plan.active)
            .forEach((plan) => {
                for (const inputBuilding of plan.inputs || []) {
                    if (inputBuilding.id && baseBuildingIds.has(inputBuilding.id)) {
                        addPlanName(inputBuilding.id, plan.name);
                    }
                }
            });

        const entries = sectionBuildings
            .map((baseBuilding): BuildingSectionBuilding | null => {
                const building = buildingsById[baseBuilding.buildingTypeId];
                if (!building) return null;
                const planNames = Array.from(planNamesByBuildingId.get(baseBuilding.id) || []);
                return {
                    id: baseBuilding.id,
                    buildingTypeId: baseBuilding.buildingTypeId,
                    sectionType,
                    baseBuilding,
                    building,
                    count: 1,
                    isGrouped: false,
                    activePlanNames: planNames,
                };
            })
            .filter((b): b is BuildingSectionBuilding => b !== null);

        if (sectionType !== 'energy' && sectionType !== 'production') {
            return entries;
        }

        const groupedEntries = new Map<string, {
            id: string;
            buildingTypeId: string;
            sectionType: BuildingSectionType;
            building: DbBuilding;
            count: number;
            activePlanNames: Set<string>;
        }>();

        for (const entry of entries) {
            const existing = groupedEntries.get(entry.buildingTypeId);
            if (existing) {
                existing.count += 1;
                entry.activePlanNames.forEach((planName) => existing.activePlanNames.add(planName));
                continue;
            }

            groupedEntries.set(entry.buildingTypeId, {
                id: `${sectionType}:${entry.buildingTypeId}`,
                buildingTypeId: entry.buildingTypeId,
                sectionType,
                building: entry.building,
                count: 1,
                activePlanNames: new Set(entry.activePlanNames),
            });
        }

        return Array.from(groupedEntries.values()).map((entry) => ({
            id: entry.id,
            buildingTypeId: entry.buildingTypeId,
            sectionType: entry.sectionType,
            building: entry.building,
            count: entry.count,
            isGrouped: true,
            activePlanNames: Array.from(entry.activePlanNames),
        }));
    },
    (baseId: string) => [[SUB_IDS.BASES_BASE_BY_ID, baseId], [SUB_IDS.BUILDINGS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_BUILDING_SECTION_STATS,
    (basesById: BasesById, buildingsById: BuildingsByIdMap, baseId: string, sectionType: string): BuildingSectionStats => {
        const base = basesById[baseId];
        if (!base) {
            return {
                buildingCount: 0,
                totalHeat: 0,
                totalPowerGeneration: 0,
                totalPowerConsumption: 0,
                hasGenerators: false,
            };
        }

        // Filter base buildings by the section type they were added to
        const baseBuildings = base.buildings.filter((baseBuilding: BaseBuilding) => {
            return baseBuilding.sectionType === sectionType;
        });

        let totalHeat = 0;
        let totalPowerGeneration = 0;
        let totalPowerConsumption = 0;
        let hasGenerators = false;

        baseBuildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildingsById[baseBuilding.buildingTypeId];
            if (building) {
                // Exclude amplifiers from heat calculation (they increase capacity but don't generate heat)
                if (!isAmplifierBuilding(building.id)) {
                    totalHeat += building.heat || 0;
                }
                // Generators produce power, other buildings consume it
                if (building.type === 'generator') {
                    hasGenerators = true;
                    totalPowerGeneration += building.power || 0;
                } else {
                    totalPowerConsumption += building.power || 0;
                }
            }
        });

        return {
            buildingCount: baseBuildings.length,
            totalHeat,
            totalPowerGeneration,
            totalPowerConsumption,
            hasGenerators,
        };
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_AVAILABLE_BUILDINGS_FOR_SECTION,
    (buildings: DbBuilding[], sectionType: BuildingSectionType): DbBuilding[] => {
        return getAvailableBuildingsForSection(buildings, sectionType);
    },
    () => [[SUB_IDS.BUILDINGS_LIST]]);

regSub(SUB_IDS.BASES_STATS_SUMMARY,
    (bases: Base[], buildingsById: BuildingsByIdMap): MyBasesStats => {
        let totalBuildings = 0;
        let totalHeat = 0;
        let totalHeatCapacity = 0;
        let totalEnergyUsed = 0;
        let totalEnergyProduced = 0;

        bases.forEach((base: Base) => {
            totalBuildings += base.buildings.length;

            // Calculate heat capacity for this base
            totalHeatCapacity += calculateBaseCoreHeatCapacity(base.coreLevel ?? 0, base.buildings, buildingsById);

            base.buildings.forEach((baseBuilding: BaseBuilding) => {
                const buildingType = buildingsById[baseBuilding.buildingTypeId];
                if (buildingType) {
                    // Exclude amplifiers from heat calculation (they increase capacity but don't generate heat)
                    if (!isAmplifierBuilding(buildingType.id)) {
                        totalHeat += buildingType.heat || 0;
                    }
                    // Energy: generators produce, others consume
                    if (buildingType.type === 'generator') {
                        totalEnergyProduced += buildingType.power || 0;
                    } else {
                        totalEnergyUsed += buildingType.power || 0;
                    }
                }
            });
        });

        // Calculate percentages and error states
        const heatPercentage = totalHeatCapacity > 0
            ? Math.min((totalHeat / totalHeatCapacity) * 100, 100)
            : 0;
        const isHeatOverCapacity = totalHeat > totalHeatCapacity;

        const energyPercentage = totalEnergyProduced > 0
            ? Math.min((totalEnergyUsed / totalEnergyProduced) * 100, 100)
            : totalEnergyUsed > 0
                ? 100
                : 0;
        const isEnergyInsufficient = totalEnergyUsed > 0 && (totalEnergyProduced === 0 || totalEnergyUsed > totalEnergyProduced);

        const totalPlans = bases.reduce((sum, base) => sum + (base.productions?.length ?? 0), 0);
        return {
            totalBases: bases.length,
            totalBuildings,
            totalPlans,
            totalHeat,
            totalHeatCapacity,
            totalEnergyUsed,
            totalEnergyProduced,
            heatPercentage,
            energyPercentage,
            isHeatOverCapacity,
            isEnergyInsufficient,
        };
    },
    () => [[SUB_IDS.BASES_LIST], [SUB_IDS.BUILDINGS_BY_ID_MAP]]);

//============================================================
// Production Plan subscriptions
//============================================================
regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_IDS,
    (selectedBase: Base | null): string[] => {
        if (!selectedBase) return [];
        return (selectedBase.productions || []).map(section => section.id);
    },
    () => [[SUB_IDS.BASES_SELECTED_BASE]]);

regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID,
    (base: Base | null, _baseId: string, sectionId: string): Production | null => {
        if (!base || !sectionId) return null;
        return base.productions?.find(section => section.id === sectionId) || null;
    },
    (baseId: string) => [[SUB_IDS.BASES_BASE_BY_ID, baseId]]);

const EMPTY_PRODUCTION_FLOW: ProductionFlowResult = { nodes: [], edges: [], rawMaterialDeficits: [] };
const EMPTY_PRODUCTION_PLAN_SECTION_STATS: ProductionPlanSectionStats = {
    buildingCount: 0,
    totalHeat: 0,
    totalPowerConsumption: 0,
};

const isLauncherEnabled = (corporationLevel?: CorporationLevelSelection | null): boolean =>
    corporationLevel !== null && corporationLevel !== undefined;

regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW_BY_ID,
    (section: Production | null, buildings: DbBuilding[]): ProductionFlowResult => {
        if (!section || !section.selectedItemId) {
            return EMPTY_PRODUCTION_FLOW;
        }

        const validAmount = section.targetAmount > 0 ? section.targetAmount : 1;
        const inputBuildings = section.inputs || [];
        const recipeSelections = sanitizeRecipeSelectionsForInputItems(section.recipeSelections, inputBuildings);

        return buildProductionFlow(
            {
                targetItemId: section.selectedItemId,
                targetAmount: validAmount,
                inputBuildings,
                rawProductionDisabled: true,
                includeLauncher: isLauncherEnabled(section.corporationLevel),
                recipeSelections,
            },
            buildings
        );
    },
    (baseId: string, sectionId: string) => [[SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId], [SUB_IDS.BUILDINGS_LIST]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_FLOW,
    (
        modalState: CreateProductionPlanModalState,
        buildings: DbBuilding[],
        basesById: BasesById
    ): ProductionFlowResult => {
        const {
            selectedItemId,
            targetAmount,
            selectedCorporationLevel,
            selectedInputIds,
            recipeSelections,
            baseId
        } = modalState;

        if (!selectedItemId) {
            return EMPTY_PRODUCTION_FLOW;
        }

        const validAmount = targetAmount > 0 ? targetAmount : 1;
        const base = baseId ? basesById[baseId] || null : null;
        const inputBuildings = getSelectedFlowInputBuildings(base, selectedInputIds || []);
        const sanitizedRecipeSelections = sanitizeRecipeSelectionsForInputItems(recipeSelections, inputBuildings);

        return buildProductionFlow(
            {
                targetItemId: selectedItemId,
                targetAmount: validAmount,
                inputBuildings,
                rawProductionDisabled: true,
                includeLauncher: isLauncherEnabled(selectedCorporationLevel),
                recipeSelections: sanitizedRecipeSelections
            },
            buildings
        );
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.BASES_BY_ID_MAP]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS,
    (
        modalState: CreateProductionPlanModalState,
        productionFlow: ProductionFlowResult,
        buildings: DbBuilding[],
        itemsById: Record<string, Item>,
        basesById: BasesById
    ): PlannerRecipeOptionsItem[] => {
        if (!modalState.selectedItemId || !productionFlow?.nodes?.length) return [];

        const base = modalState.baseId ? basesById[modalState.baseId] || null : null;
        const inputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds || []);
        const inputItemIds = new Set(
            inputBuildings
                .map((input) => input.selectedItemId)
                .filter((id): id is string => !!id)
        );

        const outputItems = new Set<string>();
        for (const node of productionFlow.nodes) {
            if (node.nodeType === 'production') {
                if (inputItemIds.has(node.outputItem)) continue;
                outputItems.add(node.outputItem);
            }
        }

        return buildRecipeOptionsForOutputItems(
            outputItems,
            buildings,
            itemsById,
            modalState.recipeSelections || {}
        );
    },
    () => [
        [SUB_IDS.PRODUCTION_PLAN_MODAL_STATE],
        [SUB_IDS.PRODUCTION_PLAN_MODAL_FLOW],
        [SUB_IDS.BUILDINGS_LIST],
        [SUB_IDS.ITEMS_BY_ID_MAP],
        [SUB_IDS.BASES_BY_ID_MAP]
    ]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS,
    (corporations: Corporation[], modalState: CreateProductionPlanModalState): CorporationLevelInfo[] => {
        const { selectedItemId } = modalState;
        if (!selectedItemId) return [];

        const levels: CorporationLevelInfo[] = [];
        for (const corporation of corporations) {
            for (const level of corporation.levels) {
                for (const component of level.components) {
                    if (component.id === selectedItemId) {
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
    () => [[SUB_IDS.CORPORATIONS_LIST], [SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]]);

regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_STATS_BY_ID,
    (
        productionFlow: ProductionFlowResult,
        section: Production | null,
    ): ProductionPlanSectionStats => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return EMPTY_PRODUCTION_PLAN_SECTION_STATS;
        }

        // Count buildings from production flow nodes (excluding custom input nodes)
        const productionBuildings = productionFlow.nodes
            .filter(node => node.nodeType !== 'input')
            .reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0);

        // Count custom input buildings from section snapshots to keep existing behavior
        const customInputBuildings = (section?.inputs || []).length;

        const totalBuildings = productionBuildings + customInputBuildings;
        const totalHeat = productionFlow.nodes.reduce((sum, node) => sum + node.totalHeat, 0);
        const totalPower = productionFlow.nodes.reduce((sum, node) => sum + node.totalPower, 0);

        return {
            buildingCount: totalBuildings,
            totalHeat,
            totalPowerConsumption: totalPower,
        };
    },
    (baseId: string, sectionId: string) => [[SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId], [SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId]]);

regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID,
    (
        section: Production | null,
        productionFlow: ProductionFlowResult,
        base: Base | null,
        itemsMap: Record<string, Item>,
        buildings: DbBuilding[],
        buildingsById: BuildingsByIdMap,
        corporations: Corporation[]
    ): ProductionPlanSectionViewModel | null => {

        if (!base || !section) {
            return null;
        }

        // Item name — derived from items lookup
        const itemName = section.selectedItemId
            ? (itemsMap[section.selectedItemId]?.name || section.selectedItemId)
            : '';

        // Corporation name — derived from corporations lookup
        const corporationName = section.corporationLevel
            ? (corporations.find(c => c.id === section.corporationLevel?.corporationId)?.name || null)
            : null;

        // Stats — calculated from buildings map by looking up building types
        const requiredBuildings = section.requiredBuildings || [];
        const sectionInputs = section.inputs || [];

        // Calculate heat/power from required buildings
        let totalHeat = 0;
        let totalPowerConsumption = 0;
        requiredBuildings.forEach(({ buildingId, count }) => {
            const building = buildingsById[buildingId];
            if (building) {
                totalHeat += (building.heat || 0) * count;
                totalPowerConsumption += (building.power || 0) * count;
            }
        });

        // Also account for input buildings
        sectionInputs.forEach((inputBuilding: BaseBuilding) => {
            const building = buildingsById[inputBuilding.buildingTypeId];
            if (building) {
                totalHeat += building.heat || 0;
                totalPowerConsumption += building.power || 0;
            }
        });

        const stats: ProductionPlanSectionStats = {
            buildingCount:
                requiredBuildings.reduce((sum, b) => sum + b.count, 0) +
                sectionInputs.length,
            totalHeat,
            totalPowerConsumption,
        };

        // --- Building requirements: compare requirements vs base buildings not reserved by other active plans ---
        const occupancyFromOtherPlans = buildActivePlanOccupancy(base, { excludePlanId: section.id });
        const totalBuildingsMap = new Map<string, number>();
        base.buildings.forEach((baseBuilding) => {
            const count = totalBuildingsMap.get(baseBuilding.buildingTypeId) || 0;
            totalBuildingsMap.set(baseBuilding.buildingTypeId, count + 1);
        });

        const buildingRequirements: BuildingRequirement[] = [];
        let allRequirementsSatisfied = true;

        requiredBuildings.forEach(({ buildingId, count }) => {
            const total = totalBuildingsMap.get(buildingId) || 0;
            const occupied = occupancyFromOtherPlans.occupiedBuildingTypeCounts.get(buildingId) || 0;
            const available = Math.max(0, total - occupied);
            const isSatisfied = available >= count;
            if (!isSatisfied) allRequirementsSatisfied = false;
            const building = buildingsById[buildingId];

            buildingRequirements.push({
                buildingId,
                buildingName: building?.name || buildingId,
                required: count,
                available,
                isSatisfied,
            });
        });

        buildingRequirements.sort((a, b) => {
            if (a.isSatisfied !== b.isSatisfied) return a.isSatisfied ? 1 : -1;
            return a.buildingName.localeCompare(b.buildingName);
        });

        const baseBuildingsById = new Map(base.buildings.map(b => [b.id, b]));
        const baseInputBuildingsById = new Map(
            base.buildings
                .filter((baseBuilding) =>
                    baseBuilding.sectionType === 'inputs' &&
                    !!baseBuilding.selectedItemId &&
                    !!baseBuilding.ratePerMinute &&
                    baseBuilding.ratePerMinute > 0
                )
                .map((baseBuilding) => [baseBuilding.id, baseBuilding])
        );

        // --- Input requirements: derived from section.inputs + name lookups ---
        const inputRequirements: InputRequirement[] = [];
        let allInputsSatisfied = true;

        if (sectionInputs.length > 0) {
            sectionInputs.forEach((inputBuilding: BaseBuilding) => {
                const matchingBaseBuilding = baseBuildingsById.get(inputBuilding.id);
                const building = buildingsById[inputBuilding.buildingTypeId] || null;
                const item = inputBuilding.selectedItemId ? itemsMap[inputBuilding.selectedItemId] : null;

                const isSatisfied = !!(
                    matchingBaseBuilding &&
                    matchingBaseBuilding.sectionType === 'inputs' &&
                    matchingBaseBuilding.selectedItemId === inputBuilding.selectedItemId &&
                    matchingBaseBuilding.ratePerMinute === inputBuilding.ratePerMinute &&
                    building &&
                    item
                );

                if (!isSatisfied) allInputsSatisfied = false;

                inputRequirements.push({
                    baseBuildingId: inputBuilding.id,
                    buildingId: building?.id || inputBuilding.buildingTypeId,
                    buildingName: building?.name || inputBuilding.buildingTypeId,
                    itemId: inputBuilding.selectedItemId || '',
                    itemName: item?.name || inputBuilding.selectedItemId || '',
                    ratePerMinute: inputBuilding.ratePerMinute || 0,
                    isSatisfied,
                });
            });
        }

        const sharedInputShortages: SharedInputShortage[] = calculateSharedInputShortages(base, section.id, buildings).map((shortage) => {
            const matchingBaseInput = baseInputBuildingsById.get(shortage.baseBuildingId);
            const customInputName = (matchingBaseInput?.name || '').trim();
            const itemId = shortage.itemId || matchingBaseInput?.selectedItemId || '';
            const itemName = itemId ? (itemsMap[itemId]?.name || itemId) : 'Unknown input';

            return {
                ...shortage,
                inputName: customInputName || itemName,
                itemId,
                itemName,
            };
        });
        const hasRawMaterialShortage = (productionFlow.rawMaterialDeficits || []).length > 0;
        const hasMaterialShortage = sharedInputShortages.length > 0 || hasRawMaterialShortage;

        // Determine plan status: error if inputs insufficient, otherwise use section.status or derive from active state
        const planStatus = section.status || (section.active ? 'active' : 'inactive');
        const hasError = planStatus === 'error' || !allInputsSatisfied;
        // Always show manage button if there are any requirements to manage
        const showManageButton = buildingRequirements.length > 0 || inputRequirements.length > 0;

        return {
            selectedBaseId: base.id,
            section,
            itemName,
            corporationName,
            stats,
            buildingRequirements,
            inputRequirements,
            sharedInputShortages,
            hasRawMaterialShortage,
            hasMaterialShortage,
            allRequirementsSatisfied,
            planStatus,
            hasError,
            showManageButton,
        };
    },
    (baseId: string, sectionId: string) => [
        [SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId],
        [SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, sectionId],
        [SUB_IDS.BASES_BASE_BY_ID, baseId],
        [SUB_IDS.ITEMS_BY_ID_MAP],
        [SUB_IDS.BUILDINGS_LIST],
        [SUB_IDS.BUILDINGS_BY_ID_MAP],
        [SUB_IDS.CORPORATIONS_LIST],
    ]);

regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID,
    (sectionData: ProductionPlanSectionViewModel | null): ProductionPlanRequirementsStatus => {
        if (!sectionData) {
            return {
                allRequirementsSatisfied: false,
                planStatus: 'inactive',
                hasError: false,
                hasMaterialShortage: false,
                itemName: '',
                corporationName: null
            };
        }
        return {
            allRequirementsSatisfied: sectionData.allRequirementsSatisfied,
            planStatus: sectionData.planStatus,
            hasError: sectionData.hasError,
            hasMaterialShortage: sectionData.hasMaterialShortage,
            itemName: sectionData.itemName,
            corporationName: sectionData.corporationName
        };
    },
    (baseId: string, sectionId: string) => [
        [SUB_IDS.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, sectionId],
    ]);

regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID,
    (itemsMap: Record<string, Item>, selectedItemId: string): string => {
        if (!selectedItemId) return '';
        const item = itemsMap[selectedItemId];
        return item?.name || selectedItemId;
    },
    () => [[SUB_IDS.ITEMS_BY_ID_MAP]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_OPEN_STATE,
    (modalState: CreateProductionPlanModalState): { isOpen: boolean } => {
        return {
            isOpen: modalState.isOpen,
        };
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_HEADER_DATA,
    (modalState: CreateProductionPlanModalState): { isEditMode: boolean } => {
        return {
            isEditMode: !!modalState.editSectionId,
        };
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_FORM_VALUES,
    (modalState: CreateProductionPlanModalState, items: Item[]): {
        defaultName: string;
        currentSelectedItemId: string;
        currentTargetAmount: number;
        defaultSelectedCorporationLevel: CorporationLevelSelection | null;
        selectedItemName: string;
        matchInputs: boolean;
    } => {
        const selectedItemName = modalState.selectedItemId
            ? items.find(i => i.id === modalState.selectedItemId)?.name || ''
            : '';

        return {
            defaultName: modalState.name,
            currentSelectedItemId: modalState.selectedItemId,
            currentTargetAmount: modalState.targetAmount,
            defaultSelectedCorporationLevel: modalState.selectedCorporationLevel,
            selectedItemName,
            matchInputs: modalState.matchInputs,
        };
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.ITEMS_LIST]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA,
    (
        basesById: BasesById,
        buildingsById: BuildingsByIdMap,
        itemsMap: Record<string, Item>,
        modalState: CreateProductionPlanModalState
    ): { inputItems: BaseInputItem[]; selectedInputIds: string[] } => {
        const { baseId, selectedInputIds } = modalState;
        if (!baseId) return { inputItems: [], selectedInputIds: [] };

        const base = basesById[baseId];
        if (!base) return { inputItems: [], selectedInputIds: [] };

        const inputItems = collectConfiguredSectionItems(base, buildingsById, itemsMap, 'inputs')
            .map((entry) => ({
                baseBuildingId: entry.baseBuildingId,
                item: entry.item,
                ratePerMinute: entry.ratePerMinute,
                building: entry.building,
                name: entry.name,
                description: entry.description,
            }));

        return { inputItems, selectedInputIds: selectedInputIds || [] };
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP], [SUB_IDS.ITEMS_BY_ID_MAP], [SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID,
    (modalState: CreateProductionPlanModalState): string => {
        return modalState.selectedItemId;
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS,
    (productionFlow: ProductionFlowResult, items: Item[]): RawMaterialDeficitWithName[] => {
        const deficits = productionFlow.rawMaterialDeficits || [];
        return deficits.map(deficit => ({
            ...deficit,
            itemName: getItemName(deficit.itemId, items),
        }));
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_FLOW], [SUB_IDS.ITEMS_LIST]]);

regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_FORM_VALIDITY,
    (
        modalState: CreateProductionPlanModalState,
        selectedItemId: string
    ): boolean => {
        const { name, targetAmount } = modalState;
        return !!(name.trim() && selectedItemId && targetAmount > 0);
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID]]);

//============================================================
// Base Overview subscriptions
//============================================================

function derivePlanStatus(plan: Production): PlanSummaryRow['status'] {
    if (plan.status === 'active' || plan.status === 'inactive' || plan.status === 'error') {
        return plan.status;
    }
    return plan.active ? 'active' : 'inactive';
}

const PLAN_STATUS_SORT_WEIGHT: Record<PlanSummaryRow['status'], number> = {
    active: 0,
    error: 1,
    inactive: 2,
};

function comparePlanSummaryRows(left: PlanSummaryRow, right: PlanSummaryRow): number {
    const statusDelta = PLAN_STATUS_SORT_WEIGHT[left.status] - PLAN_STATUS_SORT_WEIGHT[right.status];
    if (statusDelta !== 0) return statusDelta;

    const itemDelta = left.itemName.localeCompare(right.itemName);
    if (itemDelta !== 0) return itemDelta;

    return left.name.localeCompare(right.name);
}

regSub(SUB_IDS.BASES_OVERVIEW_PLAN_ROWS,
    (selectedBase: Base | null, corporations: Corporation[], itemsById: Record<string, Item>): PlanSummaryRow[] => {
        if (!selectedBase) return [];

        const corporationNameById = new Map(
            corporations.map((corporation) => [corporation.id, corporation.name])
        );

        return (selectedBase.productions || [])
            .map((plan) => ({
                id: plan.id,
                name: plan.name,
                selectedItemId: plan.selectedItemId,
                targetItem: itemsById[plan.selectedItemId] || null,
                itemName: itemsById[plan.selectedItemId]?.name || plan.selectedItemId,
                targetAmount: plan.targetAmount,
                status: derivePlanStatus(plan),
                requiredBuildingCount: (plan.requiredBuildings || []).reduce((sum, rb) => sum + rb.count, 0),
                inputCount: (plan.inputs || []).length,
                corporationLabel: plan.corporationLevel
                    ? `${corporationNameById.get(plan.corporationLevel.corporationId) || 'Corporation'} Lv.${plan.corporationLevel.level}`
                    : 'None',
            }))
            .sort(comparePlanSummaryRows);
    },
    () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.CORPORATIONS_LIST], [SUB_IDS.ITEMS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS,
    (selectedBase: Base | null, buildings: DbBuilding[], itemsById: Record<string, Item>): MaterialBalanceRow[] => {
        if (!selectedBase) return [];

        const plans = selectedBase.productions || [];

        const coverageByItem = new Map<string, number>();
        for (const baseBuilding of selectedBase.buildings) {
            if (baseBuilding.sectionType !== 'inputs') continue;
            if (!baseBuilding.selectedItemId) continue;
            if (!baseBuilding.ratePerMinute || baseBuilding.ratePerMinute <= 0) continue;
            coverageByItem.set(
                baseBuilding.selectedItemId,
                (coverageByItem.get(baseBuilding.selectedItemId) || 0) + baseBuilding.ratePerMinute
            );
        }

        const requirementsByItem = new Map<string, MaterialBalanceRow>();
        const rawRequirementKeys = new Set<string>();

        for (const plan of plans) {
            if (plan.selectedItemId && plan.targetAmount > 0) {
                const flow = buildProductionFlow(
                    {
                        targetItemId: plan.selectedItemId,
                        targetAmount: plan.targetAmount,
                        inputBuildings: plan.inputs || [],
                        rawProductionDisabled: true,
                        includeLauncher: isLauncherEnabled(plan.corporationLevel),
                        recipeSelections: plan.recipeSelections || {},
                    },
                    buildings
                );

                for (const deficit of flow.rawMaterialDeficits || []) {
                    rawRequirementKeys.add(`${plan.id}:${deficit.itemId}`);
                    const item = itemsById[deficit.itemId] || { id: deficit.itemId, name: deficit.itemId, type: 'unknown' };
                    const existing = requirementsByItem.get(deficit.itemId);
                    if (existing) {
                        existing.perPlan[plan.id] = (existing.perPlan[plan.id] || 0) + deficit.required;
                        existing.totalRequired += deficit.required;
                        continue;
                    }

                    requirementsByItem.set(deficit.itemId, {
                        itemId: deficit.itemId,
                        item,
                        perPlan: { [plan.id]: deficit.required },
                        totalRequired: deficit.required,
                        covered: 0,
                        available: 0,
                        missing: 0,
                    });
                }

                const flowWithInputs = buildProductionFlow(
                    {
                        targetItemId: plan.selectedItemId,
                        targetAmount: plan.targetAmount,
                        inputBuildings: plan.inputs || [],
                        rawProductionDisabled: true,
                        includeLauncher: isLauncherEnabled(plan.corporationLevel),
                        recipeSelections: plan.recipeSelections || {},
                    },
                    buildings
                );

                const planInputRequiredByItem = new Map<string, number>();
                for (const node of flowWithInputs.nodes) {
                    if (node.nodeType !== 'input' || !node.outputItem) continue;
                    if (!node.outputAmount || node.outputAmount <= 0) continue;
                    if (!node.buildingCount || node.buildingCount <= 0) continue;

                    const required = node.buildingCount * node.outputAmount;
                    if (required <= 0) continue;

                    planInputRequiredByItem.set(
                        node.outputItem,
                        (planInputRequiredByItem.get(node.outputItem) || 0) + required
                    );
                }

                for (const [itemId, required] of planInputRequiredByItem) {
                    if (required <= 0) continue;

                    // Raw requirements are already accounted for via production deficits.
                    if (rawRequirementKeys.has(`${plan.id}:${itemId}`)) continue;

                    const item = itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' };
                    const existing = requirementsByItem.get(itemId);
                    if (existing) {
                        existing.perPlan[plan.id] = (existing.perPlan[plan.id] || 0) + required;
                        existing.totalRequired += required;
                        continue;
                    }

                    requirementsByItem.set(itemId, {
                        itemId,
                        item,
                        perPlan: { [plan.id]: required },
                        totalRequired: required,
                        covered: 0,
                        available: 0,
                        missing: 0,
                    });
                }
            }
        }

        // Also show configured inputs that are currently unused by all plans.
        for (const [itemId, available] of coverageByItem) {
            if (requirementsByItem.has(itemId)) continue;
            const item = itemsById[itemId] || { id: itemId, name: itemId, type: 'unknown' };
            requirementsByItem.set(itemId, {
                itemId,
                item,
                perPlan: {},
                totalRequired: 0,
                covered: 0,
                available,
                missing: 0,
            });
        }

        return Array.from(requirementsByItem.values())
            .map((row) => {
                const available = coverageByItem.get(row.itemId) || 0;
                const covered = Math.min(row.totalRequired, available);
                const missing = Math.max(0, row.totalRequired - available);
                return { ...row, covered, available, missing };
            })
            .sort((left, right) => {
                if (left.missing !== right.missing) return right.missing - left.missing;
                if (left.totalRequired !== right.totalRequired) return right.totalRequired - left.totalRequired;
                return left.item.name.localeCompare(right.item.name);
            });
    },
    () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.ITEMS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS,
    (selectedBase: Base | null, buildings: DbBuilding[]): BuildingCoverageRow[] => {
        if (!selectedBase) return [];

        const plans = selectedBase.productions || [];
        if (plans.length === 0) return [];

        const ownedCounts = new Map<string, number>();
        for (const baseBuilding of selectedBase.buildings) {
            if (baseBuilding.sectionType !== 'production') continue;
            ownedCounts.set(baseBuilding.buildingTypeId, (ownedCounts.get(baseBuilding.buildingTypeId) || 0) + 1);
        }

        const buildingById = new Map(buildings.map((building) => [building.id, building]));
        const requirementsByBuilding = new Map<string, BuildingCoverageRow>();

        for (const plan of plans) {
            for (const requiredBuilding of plan.requiredBuildings || []) {
                const building = buildingById.get(requiredBuilding.buildingId);
                if (!building || !isBuildingAvailableForSection(building, 'production')) continue;

                const existing = requirementsByBuilding.get(requiredBuilding.buildingId);
                if (existing) {
                    existing.perPlan[plan.id] = requiredBuilding.count;
                    existing.totalRequired += requiredBuilding.count;
                    continue;
                }

                requirementsByBuilding.set(requiredBuilding.buildingId, {
                    buildingId: requiredBuilding.buildingId,
                    building,
                    perPlan: { [plan.id]: requiredBuilding.count },
                    totalRequired: requiredBuilding.count,
                    covered: 0,
                    owned: 0,
                    missing: 0,
                });
            }
        }

        return Array.from(requirementsByBuilding.values())
            .map((row) => {
                const owned = ownedCounts.get(row.buildingId) || 0;
                const covered = Math.min(row.totalRequired, owned);
                const missing = Math.max(0, row.totalRequired - owned);
                return { ...row, covered, owned, missing };
            })
            .sort((left, right) => right.totalRequired - left.totalRequired);
    },
    () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.BUILDINGS_LIST]]);
