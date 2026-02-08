import { regSub } from '@flexsurfer/reflex';
import { SUB_IDS } from './sub-ids';
import type {
    Item,
    Corporation,
    Building as DbBuilding,
    BuildingsByIdMap,
    Base,
    BasesById,
    BaseBuilding,
    Production,
    CreateProductionPlanModalState,
    CorporationLevelSelection,
} from './db';
import type {
    CorporationLevelInfo,
    PlannerBuildingStats,
    PlannerDetailedStats,
    PlannerDetailedStatsItem,
    ProductionFlowResult,
    RawMaterialDeficitWithName,
} from '../components/planner/core/types';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import { generateReactFlowData } from '../components/planner/visualization/plannerFlowUtils';
import { getItemName } from '../utils/itemUtils';
import type { Node, Edge } from '@xyflow/react';
import { calculateBaseCoreHeatCapacity, isAmplifierBuilding, getCoreLevels } from '../components/mybases/utils/baseCoreUtils';
import { getAvailableBuildingsForSection } from '../components/mybases/utils/buildingSectionUtils';
import { getSelectedFlowInputBuildings } from '../utils/productionPlanInputs';
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
    ProductionPlanSectionViewModel,
    ProductionPlanRequirementsStatus,
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
regSub(SUB_IDS.UI_ACTIVE_TAB, "uiActiveTab");
regSub(SUB_IDS.PLANNER_SELECTED_ITEM_ID, "plannerSelectedItemId");
regSub(SUB_IDS.PLANNER_SELECTED_CORPORATION_LEVEL, "plannerSelectedCorporationLevel");
regSub(SUB_IDS.PLANNER_TARGET_AMOUNT, "plannerTargetAmount");
regSub(SUB_IDS.BASES_LIST, "basesList");
regSub(SUB_IDS.BASES_SELECTED_BASE_ID, "basesSelectedBaseId");
regSub(SUB_IDS.UI_CONFIRMATION_DIALOG, "uiConfirmationDialog");
regSub(SUB_IDS.PRODUCTION_PLAN_MODAL_STATE, "productionPlanModalState");

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
        const producingBuildingsMap = new Map<string, string>();
        for (const building of buildings) {
            for (const recipe of building.recipes || []) {
                producingBuildingsMap.set(recipe.output.id, building.name);
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
            producingBuilding: producingBuildingsMap.get(item.id) || 'Raw Material',
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

regSub(SUB_IDS.BUILDINGS_SORTED_PRODUCTION_LIST,
    (buildings: DbBuilding[], helperMaps: ItemsHelperLookups): DbBuilding[] => {
        const productionBuildings = buildings.filter(building => building.type === 'production');

        return [...productionBuildings].sort((a, b) => {
            const usageA = helperMaps.buildingCorporationUsage.get(a.name) || [];
            const usageB = helperMaps.buildingCorporationUsage.get(b.name) || [];

            // Get minimum level for each building
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
        selectedCorporationLevel: CorporationLevelSelection | null
    ): ProductionFlowResult => {
        if (!selectedItem) {
            return { nodes: [], edges: [] };
        }

        const validAmount = targetAmount > 0 ? targetAmount : 1;
        // Only include launcher if a corporation level is selected
        const includeLauncher = selectedCorporationLevel !== null;
        return buildProductionFlow(
            { targetItemId: selectedItem, targetAmount: validAmount, includeLauncher },
            buildings
        );
    },
    () => [[SUB_IDS.PLANNER_SELECTED_ITEM_ID], [SUB_IDS.PLANNER_TARGET_AMOUNT], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.PLANNER_SELECTED_CORPORATION_LEVEL]]);

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
// Bases subscriptions
//============================================================
interface ConfiguredSectionItem {
    baseBuildingId: string;
    item: Item;
    ratePerMinute: number;
    building: DbBuilding;
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

// Helper function to calculate stats for a base
function calculateBaseDetailStats(base: Base, buildingsById: BuildingsByIdMap): BaseDetailStats {
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

    const coreLevel = base.coreLevel ?? 0;
    const baseCoreHeatCapacity = calculateBaseCoreHeatCapacity(coreLevel, base.buildings, buildingsById);
    const heatPercentage = Math.min((totalHeat / baseCoreHeatCapacity) * 100, 100);
    // Calculate energy percentage: used / available (similar to heat)
    // If no generation, show full red bar (100%)
    const energyPercentage = energyGeneration > 0
        ? Math.min((energyConsumption / energyGeneration) * 100, 100)
        : energyConsumption > 0
            ? 100 // Full red bar when consuming but no generation
            : 0;

    const isHeatOverCapacity = totalHeat > baseCoreHeatCapacity;
    const isEnergyInsufficient = energyGeneration === 0 || energyConsumption > energyGeneration;

    return {
        baseName: base.name,
        coreLevel,
        buildingCount: base.buildings.length,
        totalHeat,
        energyGeneration,
        energyConsumption,
        baseCoreHeatCapacity,
        heatPercentage,
        energyPercentage,
        isHeatOverCapacity,
        isEnergyInsufficient,
    };
}

regSub(SUB_IDS.BASES_SELECTED_BASE_DETAIL_STATS,
    (selectedBase: Base | null, buildingsById: BuildingsByIdMap): BaseDetailStats | null => {
        if (!selectedBase) return null;
        return calculateBaseDetailStats(selectedBase, buildingsById);
    },
    () => [[SUB_IDS.BASES_SELECTED_BASE], [SUB_IDS.BUILDINGS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_CORE_LEVELS,
    (buildingsById: BuildingsByIdMap): { level: number; heatCapacity: number }[] => {
        return getCoreLevels(buildingsById);
    },
    () => [[SUB_IDS.BUILDINGS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_DETAIL_STATS_BY_BASE_ID,
    (basesById: BasesById, buildingsById: BuildingsByIdMap, baseId: string): BaseDetailStats | null => {
        const base = basesById[baseId];
        if (!base) return null;
        return calculateBaseDetailStats(base, buildingsById);
    },
    () => [[SUB_IDS.BASES_BY_ID_MAP], [SUB_IDS.BUILDINGS_BY_ID_MAP]]);

regSub(SUB_IDS.BASES_INPUT_ITEMS_BY_BASE_ID,
    (basesById: BasesById, buildingsById: BuildingsByIdMap, itemsMap: Record<string, Item>, baseId: string): BaseInputItem[] => {
        const base = basesById[baseId];
        if (!base) return [];

        return collectConfiguredSectionItems(base, buildingsById, itemsMap, 'inputs').map((entry) => ({
            baseBuildingId: entry.baseBuildingId,
            item: entry.item,
            ratePerMinute: entry.ratePerMinute,
            building: entry.building,
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
    (base: Base | null, buildingsById: BuildingsByIdMap, _baseId: string, sectionType: string): BuildingSectionBuilding[] => {
        if (!base) return [];

        const sectionBuildings = base.buildings.filter(b => b.sectionType === sectionType);
        if (sectionBuildings.length === 0) return [];

        // Build active-plan highlight map for the entire base
        const activePlans = base.productions?.filter(p => p.active) || [];
        const planNamesMap = new Map<string, Set<string>>();

        const addPlanName = (buildingId: string, planName: string) => {
            let set = planNamesMap.get(buildingId);
            if (!set) {
                set = new Set<string>();
                planNamesMap.set(buildingId, set);
            }
            set.add(planName);
        };

        const baseBuildingIds = new Set(base.buildings.map(b => b.id));
        const withItemByType = new Map<string, BaseBuilding[]>();
        const withoutItemByType = new Map<string, BaseBuilding[]>();
        for (const baseBuilding of base.buildings) {
            if (baseBuilding.selectedItemId !== undefined) {
                const list = withItemByType.get(baseBuilding.buildingTypeId) || [];
                list.push(baseBuilding);
                withItemByType.set(baseBuilding.buildingTypeId, list);
            } else {
                const list = withoutItemByType.get(baseBuilding.buildingTypeId) || [];
                list.push(baseBuilding);
                withoutItemByType.set(baseBuilding.buildingTypeId, list);
            }
        }
        const prioritizedBuildingsByType = new Map<string, BaseBuilding[]>();
        const allBuildingTypeIds = new Set<string>([
            ...withItemByType.keys(),
            ...withoutItemByType.keys(),
        ]);
        for (const buildingTypeId of allBuildingTypeIds) {
            prioritizedBuildingsByType.set(buildingTypeId, [
                ...(withItemByType.get(buildingTypeId) || []),
                ...(withoutItemByType.get(buildingTypeId) || []),
            ]);
        }

        activePlans.forEach(plan => {
            // Required production buildings (stored on plan save)
            (plan.requiredBuildings || []).forEach(({ buildingId, count }) => {
                const prioritized = prioritizedBuildingsByType.get(buildingId) || [];
                prioritized.slice(0, count).forEach(b => addPlanName(b.id, plan.name));
            });

            // Input building snapshots
            (plan.inputs || []).forEach(inputBuilding => {
                if (inputBuilding.id && baseBuildingIds.has(inputBuilding.id)) {
                    addPlanName(inputBuilding.id, plan.name);
                }
            });
        });

        return sectionBuildings
            .map(baseBuilding => {
                const building = buildingsById[baseBuilding.buildingTypeId];
                if (!building) return null;
                return {
                    baseBuilding,
                    building,
                    activePlanNames: Array.from(planNamesMap.get(baseBuilding.id) || []),
                };
            })
            .filter((b): b is BuildingSectionBuilding => b !== null);
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
        const isEnergyInsufficient = totalEnergyProduced === 0 || totalEnergyUsed > totalEnergyProduced;

        return {
            totalBases: bases.length,
            totalBuildings,
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

        return buildProductionFlow(
            {
                targetItemId: section.selectedItemId,
                targetAmount: validAmount,
                inputBuildings: section.inputs,
                rawProductionDisabled: true,
                includeLauncher: isLauncherEnabled(section.corporationLevel),
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
        const { selectedItemId, targetAmount, selectedCorporationLevel, selectedInputIds, baseId } = modalState;

        if (!selectedItemId) {
            return EMPTY_PRODUCTION_FLOW;
        }

        const validAmount = targetAmount > 0 ? targetAmount : 1;
        const base = baseId ? basesById[baseId] || null : null;
        const inputBuildings = getSelectedFlowInputBuildings(base, selectedInputIds || []);

        return buildProductionFlow(
            {
                targetItemId: selectedItemId,
                targetAmount: validAmount,
                inputBuildings,
                rawProductionDisabled: true,
                includeLauncher: isLauncherEnabled(selectedCorporationLevel)
            },
            buildings
        );
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.BUILDINGS_LIST], [SUB_IDS.BASES_BY_ID_MAP]]);

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
            .filter(node => !node.isCustomInput)
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
        base: Base | null,
        itemsMap: Record<string, Item>,
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

        // --- Building requirements: compare stored required buildings vs current base ---
        const availableBuildingsMap = new Map<string, number>();
        base.buildings.forEach(baseBuilding => {
            const count = availableBuildingsMap.get(baseBuilding.buildingTypeId) || 0;
            availableBuildingsMap.set(baseBuilding.buildingTypeId, count + 1);
        });

        const buildingRequirements: BuildingRequirement[] = [];
        let allRequirementsSatisfied = true;

        requiredBuildings.forEach(({ buildingId, count }) => {
            const available = availableBuildingsMap.get(buildingId) || 0;
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

        // --- Input requirements: derived from section.inputs + name lookups ---
        const inputRequirements: InputRequirement[] = [];
        let allInputsSatisfied = true;

        if (sectionInputs.length > 0) {
            const baseBuildingsById = new Map(base.buildings.map(b => [b.id, b]));

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
            allRequirementsSatisfied,
            planStatus,
            hasError,
            showManageButton,
        };
    },
    (baseId: string, sectionId: string) => [
        [SUB_IDS.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, sectionId],
        [SUB_IDS.BASES_BASE_BY_ID, baseId],
        [SUB_IDS.ITEMS_BY_ID_MAP],
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
                itemName: '',
                corporationName: null
            };
        }
        return {
            allRequirementsSatisfied: sectionData.allRequirementsSatisfied,
            planStatus: sectionData.planStatus,
            hasError: sectionData.hasError,
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

        const inputItems = collectConfiguredSectionItems(base, buildingsById, itemsMap, 'inputs').map((entry) => ({
            baseBuildingId: entry.baseBuildingId,
            item: entry.item,
            ratePerMinute: entry.ratePerMinute,
            building: entry.building,
        }));

        return { inputItems, selectedInputIds };
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
        selectedItemId: string,
        rawMaterialDeficits: RawMaterialDeficitWithName[]
    ): boolean => {
        const { name, targetAmount } = modalState;
        const hasDeficits = rawMaterialDeficits.length > 0;
        return !!(name.trim() && selectedItemId && targetAmount > 0 && !hasDeficits);
    },
    () => [[SUB_IDS.PRODUCTION_PLAN_MODAL_STATE], [SUB_IDS.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID], [SUB_IDS.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS]]);
