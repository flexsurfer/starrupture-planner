import { regSub } from '@flexsurfer/reflex';
import { SUB_IDS } from './sub-ids';
import type { Item, Corporation, Building as DbBuilding, Base, BaseBuilding, ProductionPlanSection } from './db';
import type { Building, ProductionFlowResult } from '../components/planner/core/types';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import { generateReactFlowData } from '../components/planner/visualization/plannerFlowUtils';
import { getItemName } from '../components/planner/core/productionFlowBuilder';
import type { Node, Edge } from '@xyflow/react';
import { calculateBaseCoreHeatCapacity, isAmplifierBuilding } from '../components/mybases/utils/baseCoreUtils';
import { getAvailableBuildingsForSection } from '../components/mybases/utils/buildingSectionUtils';
import type {
  BaseDetailStats,
  BuildingSectionStats,
  BaseInputItem,
  BaseOutputItem,
  BaseDefenseBuilding,
  BuildingSectionType,
  MyBasesStats,
  ProductionPlanSectionStats,
  BuildingRequirement,
} from '../components/mybases/types';

// Root subscriptions
regSub(SUB_IDS.DATA_VERSION);
regSub(SUB_IDS.DATA_VERSIONS);
regSub(SUB_IDS.ITEMS);
regSub(SUB_IDS.ITEMS_MAP);
regSub(SUB_IDS.SELECTED_CATEGORY);
regSub(SUB_IDS.SELECTED_BUILDING);
regSub(SUB_IDS.SEARCH_TERM);
regSub(SUB_IDS.CATEGORIES);
regSub(SUB_IDS.BUILDINGS);
regSub(SUB_IDS.CORPORATIONS);
regSub(SUB_IDS.THEME);
regSub(SUB_IDS.ACTIVE_TAB);
regSub(SUB_IDS.SELECTED_PLANNER_ITEM);
regSub(SUB_IDS.SELECTED_PLANNER_CORPORATION_LEVEL);
regSub(SUB_IDS.TARGET_AMOUNT);
regSub(SUB_IDS.BASES);
regSub(SUB_IDS.SELECTED_BASE_ID);
regSub(SUB_IDS.BASE_DETAIL_ACTIVE_TAB);
regSub(SUB_IDS.CONFIRMATION_DIALOG);
regSub(SUB_IDS.ACTIVATE_PLAN_DIALOG);

// Available buildings subscription (unique building names)
// Only includes production type buildings
regSub(SUB_IDS.AVAILABLE_PRODUCTION_BUILDINGS,
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
    () => [[SUB_IDS.BUILDINGS]]);

// Computed subscriptions
regSub(SUB_IDS.FILTERED_ITEMS,
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
    () => [[SUB_IDS.SELECTED_CATEGORY], [SUB_IDS.SELECTED_BUILDING], [SUB_IDS.SEARCH_TERM], [SUB_IDS.ITEMS], [SUB_IDS.BUILDINGS]]);

// Items table data with computed properties - computed directly from source data
interface ItemTableData {
    item: Item;
    producingBuilding: string;
    corporationUsage: Array<{ corporation: string; level: number }>;
}

regSub(SUB_IDS.ITEMS_TABLE_DATA,
    (filteredItems: Item[], buildings: DbBuilding[], corporations: Corporation[]): ItemTableData[] => {
        // Build producing buildings map
        const producingBuildingsMap = new Map<string, string>();
        for (const building of buildings) {
            for (const recipe of building.recipes || []) {
                producingBuildingsMap.set(recipe.output.id, building.name);
            }
        }

        // Build corporation usage map
        const corporationUsageMap = new Map<string, Array<{ corporation: string; level: number }>>();
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
    () => [[SUB_IDS.FILTERED_ITEMS], [SUB_IDS.BUILDINGS], [SUB_IDS.CORPORATIONS]]);

// Helper maps for RecipesPage and other components
interface ItemsHelperMaps {
    corporationNameToId: Map<string, string>;
    buildingCorporationUsage: Map<string, Array<{ corporation: string; level: number }>>;
}

regSub(SUB_IDS.ITEMS_HELPER_MAPS,
    (corporations: Corporation[]): ItemsHelperMaps => {
        const corporationNameToId = new Map<string, string>();
        const buildingCorporationUsage = new Map<string, Array<{ corporation: string; level: number }>>();

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
    () => [[SUB_IDS.CORPORATIONS]]);

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

// Parameterized subscription for available corporation levels by item ID
regSub(SUB_IDS.AVAILABLE_CORPORATION_LEVELS_FOR_ITEM,
    (corporations: Corporation[], itemId: string): CorporationLevelInfo[] => {
        if (!itemId) return [];
        
        const levels: CorporationLevelInfo[] = [];
        for (const corporation of corporations) {
            for (const level of corporation.levels) {
                for (const component of level.components) {
                    if (component.id === itemId) {
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
    () => [[SUB_IDS.CORPORATIONS]]);

// Production flow for planner (raw nodes and edges)
// Only includes the Orbital Cargo Launcher when a corporation level is selected
interface SelectedCorporationLevel {
    corporationId: string;
    level: number;
}

regSub(SUB_IDS.PLANNER_PRODUCTION_FLOW,
    (selectedItem: string | null, targetAmount: number, buildings: Building[], corporations: Corporation[], selectedCorporationLevel: SelectedCorporationLevel | null): ProductionFlowResult => {
        if (!selectedItem) {
            return { nodes: [], edges: [] };
        }
        
        const validAmount = targetAmount > 0 ? targetAmount : 1;
        // Only include launcher if a corporation level is selected
        const includeLauncher = selectedCorporationLevel !== null;
        return buildProductionFlow(
            { targetItemId: selectedItem, targetAmount: validAmount },
            buildings,
            corporations,
            includeLauncher
        );
    },
    () => [[SUB_IDS.SELECTED_PLANNER_ITEM], [SUB_IDS.TARGET_AMOUNT], [SUB_IDS.BUILDINGS], [SUB_IDS.CORPORATIONS], [SUB_IDS.SELECTED_PLANNER_CORPORATION_LEVEL]]);

// React Flow formatted data for visualization
regSub(SUB_IDS.PLANNER_REACT_FLOW_DATA,
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
    () => [[SUB_IDS.PLANNER_PRODUCTION_FLOW], [SUB_IDS.ITEMS]]);

// Planner stats summary (for button display)
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
    () => [[SUB_IDS.SELECTED_PLANNER_ITEM], [SUB_IDS.PLANNER_PRODUCTION_FLOW]]);

// Planner detailed stats (for modal display)
interface BuildingStats {
    buildingId: string;
    buildingName: string;
    count: number;
    totalPower: number;
    totalHeat: number;
}

interface DetailedStats {
    buildingStats: BuildingStats[];
    totalEnergy: number;
    totalHotness: number;
    totalBuildings: number;
    itemsByType: Map<string, Array<{ id: string; name: string; type: string }>>;
    sortedTypes: string[];
}

regSub(SUB_IDS.PLANNER_STATS_DETAILED,
    (productionFlow: ProductionFlowResult, items: Item[]): DetailedStats => {
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
        const buildingMap = new Map<string, BuildingStats>();
        
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
        const itemsByType = new Map<string, typeof itemsWithData>();
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
    () => [[SUB_IDS.PLANNER_PRODUCTION_FLOW], [SUB_IDS.ITEMS]]);

// Selected base subscription - computed from selectedBaseId and bases
regSub(SUB_IDS.SELECTED_BASE,
    (selectedBaseId: string | null, bases: Base[]): Base | null => {
        if (!selectedBaseId) return null;
        return bases.find(b => b.id === selectedBaseId) || null;
    },
    () => [[SUB_IDS.SELECTED_BASE_ID], [SUB_IDS.BASES]]);

// Helper function to calculate stats for a base
function calculateBaseDetailStats(base: Base, buildings: DbBuilding[]): BaseDetailStats {
    let totalHeat = 0;
    let energyGeneration = 0;
    let energyConsumption = 0;
    
    base.buildings.forEach((baseBuilding: BaseBuilding) => {
        const buildingType = buildings.find(b => b.id === baseBuilding.buildingTypeId);
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
    
    const baseCoreHeatCapacity = calculateBaseCoreHeatCapacity(base.buildings, buildings);
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

regSub(SUB_IDS.SELECTED_BASE_DETAIL_STATS,
    (selectedBase: Base | null, buildings: DbBuilding[]): BaseDetailStats | null => {
        if (!selectedBase) return null;
        return calculateBaseDetailStats(selectedBase, buildings);
    },
    () => [[SUB_IDS.SELECTED_BASE], [SUB_IDS.BUILDINGS]]);

// Parameterized subscription for base detail stats by base ID
regSub(SUB_IDS.BASE_DETAIL_STATS,
    (bases: Base[], buildings: DbBuilding[], baseId: string): BaseDetailStats | null => {
        const base = bases.find(b => b.id === baseId);
        if (!base) return null;
        return calculateBaseDetailStats(base, buildings);
    },
    () => [[SUB_IDS.BASES], [SUB_IDS.BUILDINGS]]);

// Parameterized subscription for base input items by base ID
regSub(SUB_IDS.BASE_INPUT_ITEMS,
    (bases: Base[], buildings: DbBuilding[], itemsMap: Record<string, Item>, baseId: string): BaseInputItem[] => {
        const base = bases.find(b => b.id === baseId);
        if (!base) return [];
        
        const items: BaseInputItem[] = [];
        
        base.buildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildings.find(b => b.id === baseBuilding.buildingTypeId);
            if (!building || !baseBuilding.selectedItemId || !baseBuilding.ratePerMinute) return;
            
            // Check if building is in inputs section
            const isInputBuilding = baseBuilding.sectionType === 'inputs';
            
            if (isInputBuilding) {
                const item = itemsMap[baseBuilding.selectedItemId];
                if (item) {
                    items.push({
                        item,
                        ratePerMinute: baseBuilding.ratePerMinute,
                        building,
                    });
                }
            }
        });
        
        return items;
    },
    () => [[SUB_IDS.BASES], [SUB_IDS.BUILDINGS], [SUB_IDS.ITEMS_MAP]]);

// Parameterized subscription for base output items by base ID
regSub(SUB_IDS.BASE_OUTPUT_ITEMS,
    (bases: Base[], buildings: DbBuilding[], itemsMap: Record<string, Item>, baseId: string): BaseOutputItem[] => {
        const base = bases.find(b => b.id === baseId);
        if (!base) return [];
        
        const items: BaseOutputItem[] = [];
        
        base.buildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildings.find(b => b.id === baseBuilding.buildingTypeId);
            if (!building || !baseBuilding.selectedItemId || !baseBuilding.ratePerMinute) return;
            
            // Check if building is in outputs section
            const isOutputBuilding = baseBuilding.sectionType === 'outputs';
            
            if (isOutputBuilding) {
                const item = itemsMap[baseBuilding.selectedItemId];
                if (item) {
                    items.push({
                        item,
                        ratePerMinute: baseBuilding.ratePerMinute,
                        building,
                    });
                }
            }
        });
        
        return items;
    },
    () => [[SUB_IDS.BASES], [SUB_IDS.BUILDINGS], [SUB_IDS.ITEMS_MAP]]);

// Parameterized subscription for base defense buildings by base ID
regSub(SUB_IDS.BASE_DEFENSE_BUILDINGS,
    (bases: Base[], buildings: DbBuilding[], baseId: string): BaseDefenseBuilding[] => {
        const base = bases.find(b => b.id === baseId);
        if (!base) return [];
        
        const defenseMap = new Map<string, BaseDefenseBuilding>();
        
        base.buildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildings.find(b => b.id === baseBuilding.buildingTypeId);
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
    () => [[SUB_IDS.BASES], [SUB_IDS.BUILDINGS]]);

// Sorted production buildings subscription
regSub(SUB_IDS.SORTED_PRODUCTION_BUILDINGS,
    (buildings: DbBuilding[], helperMaps: ItemsHelperMaps): DbBuilding[] => {
        // Filter buildings by type="production"
        const productionBuildings = buildings.filter(building => building.type === 'production');
        
        // Sort buildings by corporation level
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
    () => [[SUB_IDS.BUILDINGS], [SUB_IDS.ITEMS_HELPER_MAPS]]);

// Parameterized subscription for available items for a building
regSub(SUB_IDS.AVAILABLE_ITEMS_FOR_BUILDING,
    (items: Item[], buildings: DbBuilding[], buildingId: string): Item[] => {
        const building = buildings.find(b => b.id === buildingId);
        if (!building) return [];
        
        if (building.id === 'package_receiver' || building.id === 'package_dispatcher' || building.id === 'orbital_cargo_launcher' || building.id === 'storage_depot_v1') {
            // For package_receiver and output buildings, all items are available
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
    () => [[SUB_IDS.ITEMS], [SUB_IDS.BUILDINGS]]);

// Parameterized subscription for buildings in a specific section
regSub(SUB_IDS.BUILDING_SECTION_BUILDINGS,
    (bases: Base[], baseId: string, sectionType: string): BaseBuilding[] => {
        const base = bases.find(b => b.id === baseId);
        if (!base) {
            return [];
        }
        
        // Filter base buildings by the section type they were added to
        return base.buildings.filter((baseBuilding: BaseBuilding) => {
            return baseBuilding.sectionType === sectionType;
        });
    },
    () => [[SUB_IDS.BASES]]);

regSub(SUB_IDS.BUILDING_SECTION_STATS,
    (bases: Base[], buildings: DbBuilding[], baseId: string, sectionType: string): BuildingSectionStats => {
        const base = bases.find(b => b.id === baseId);
        if (!base) {
            return {
                buildingCount: 0,
                totalHeat: 0,
                totalPowerGeneration: 0,
                totalPowerConsumption: 0,
                hasGenerators: false,
            };
        }
        
        // Create a map for quick building lookup
        const buildingMap = new Map(buildings.map(b => [b.id, b]));
        
        // Filter base buildings by the section type they were added to
        const baseBuildings = base.buildings.filter((baseBuilding: BaseBuilding) => {
            return baseBuilding.sectionType === sectionType;
        });
        
        let totalHeat = 0;
        let totalPowerGeneration = 0;
        let totalPowerConsumption = 0;
        let hasGenerators = false;

        baseBuildings.forEach((baseBuilding: BaseBuilding) => {
            const building = buildingMap.get(baseBuilding.buildingTypeId);
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
    () => [[SUB_IDS.BASES], [SUB_IDS.BUILDINGS]]);

// Planner selectable items (excludes raw materials, sorted alphabetically)
regSub(SUB_IDS.PLANNER_SELECTABLE_ITEMS,
    (items: Item[]): Item[] => {
        return items.filter(item => item.type !== 'raw').sort((a, b) => a.name.localeCompare(b.name));
    },
    () => [[SUB_IDS.ITEMS]]);

// Parameterized subscription for available buildings for a specific section
regSub(SUB_IDS.AVAILABLE_BUILDINGS_FOR_SECTION,
    (buildings: DbBuilding[], sectionType: BuildingSectionType): DbBuilding[] => {
        return getAvailableBuildingsForSection(buildings, sectionType);
    },
    () => [[SUB_IDS.BUILDINGS]]);

// Aggregated stats for all bases
regSub(SUB_IDS.MY_BASES_STATS,
    (bases: Base[], buildings: DbBuilding[]): MyBasesStats => {
        let totalBuildings = 0;
        let totalHeat = 0;
        let totalEnergyUsed = 0;

        bases.forEach((base: Base) => {
            totalBuildings += base.buildings.length;

            base.buildings.forEach((baseBuilding: BaseBuilding) => {
                const buildingType = buildings.find(b => b.id === baseBuilding.buildingTypeId);
                if (buildingType) {
                    // Exclude amplifiers from heat calculation (they increase capacity but don't generate heat)
                    if (!isAmplifierBuilding(buildingType.id)) {
                        totalHeat += buildingType.heat || 0;
                    }
                    // Energy consumption (only count consumption, not generation)
                    if (buildingType.type !== 'generator') {
                        totalEnergyUsed += buildingType.power || 0;
                    }
                }
            });
        });

        return {
            totalBases: bases.length,
            totalBuildings,
            totalHeat,
            totalEnergyUsed,
        };
    },
    () => [[SUB_IDS.BASES], [SUB_IDS.BUILDINGS]]);

// Production Plan Section subscriptions

// Parameterized subscription for production plan sections of a base
regSub(SUB_IDS.BASE_PRODUCTION_PLAN_SECTIONS,
    (bases: Base[], baseId: string): ProductionPlanSection[] => {
        const base = bases.find(b => b.id === baseId);
        if (!base) return [];
        return base.productionPlanSections || [];
    },
    () => [[SUB_IDS.BASES]]);

// Parameterized subscription for production flow of a specific section
regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW,
    (buildings: Building[], corporations: Corporation[], selectedItemId: string, targetAmount: number, corporationLevel?: { corporationId: string; level: number } | null): ProductionFlowResult => {
        if (!selectedItemId) {
            return { nodes: [], edges: [] };
        }
        
        const validAmount = targetAmount > 0 ? targetAmount : 1;
        const includeLauncher = corporationLevel !== null && corporationLevel !== undefined;
        return buildProductionFlow(
            { targetItemId: selectedItemId, targetAmount: validAmount },
            buildings,
            corporations,
            includeLauncher
        );
    },
    () => [[SUB_IDS.BUILDINGS], [SUB_IDS.CORPORATIONS]]);

// Parameterized subscription for React Flow data of a production plan section
regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_REACT_FLOW_DATA,
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
    () => [[SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW], [SUB_IDS.ITEMS]]);

// Parameterized subscription for stats of a production plan section
regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_STATS,
    (productionFlow: ProductionFlowResult): ProductionPlanSectionStats => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return {
                buildingCount: 0,
                totalHeat: 0,
                totalPowerConsumption: 0,
            };
        }

        const totalBuildings = productionFlow.nodes.reduce((sum, node) => sum + Math.ceil(node.buildingCount), 0);
        const totalHeat = productionFlow.nodes.reduce((sum, node) => sum + node.totalHeat, 0);
        const totalPower = productionFlow.nodes.reduce((sum, node) => sum + node.totalPower, 0);

        return {
            buildingCount: totalBuildings,
            totalHeat,
            totalPowerConsumption: totalPower,
        };
    },
    (selectedItemId: string, targetAmount: number, corporationLevel?: { corporationId: string; level: number } | null) => [[SUB_IDS.PRODUCTION_PLAN_SECTION_FLOW, selectedItemId, targetAmount, corporationLevel]]);

// Active plans buildings map - maps buildingTypeId to array of plan names
// This is used to highlight buildings in the buildings tab that are part of active plans
export interface ActivePlansBuildingsMap {
    [buildingTypeId: string]: string[];  // buildingTypeId -> plan names
}

regSub(SUB_IDS.ACTIVE_PLANS_BUILDINGS_MAP,
    (selectedBase: Base | null, buildings: Building[], corporations: Corporation[]): ActivePlansBuildingsMap => {
        if (!selectedBase) return {};
        
        const activePlans = selectedBase.productionPlanSections?.filter(section => section.active) || [];
        if (activePlans.length === 0) return {};
        
        const buildingsMap: ActivePlansBuildingsMap = {};
        
        activePlans.forEach(plan => {
            if (!plan.selectedItemId) return;
            
            // Compute production flow for this plan
            const includeLauncher = plan.corporationLevel !== null && plan.corporationLevel !== undefined;
            const flow = buildProductionFlow(
                { targetItemId: plan.selectedItemId, targetAmount: plan.targetAmount || 1 },
                buildings,
                corporations,
                includeLauncher
            );
            
            // Extract building types from flow nodes
            flow.nodes.forEach(node => {
                if (!buildingsMap[node.buildingId]) {
                    buildingsMap[node.buildingId] = [];
                }
                if (!buildingsMap[node.buildingId].includes(plan.name)) {
                    buildingsMap[node.buildingId].push(plan.name);
                }
            });
        });
        
        return buildingsMap;
    },
    () => [[SUB_IDS.SELECTED_BASE], [SUB_IDS.BUILDINGS], [SUB_IDS.CORPORATIONS]]);

// Parameterized subscription for production plan section item name
regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_ITEM_NAME,
    (itemsMap: Record<string, Item>, selectedItemId: string): string => {
        if (!selectedItemId) return '';
        const item = itemsMap[selectedItemId];
        return item?.name || selectedItemId;
    },
    () => [[SUB_IDS.ITEMS_MAP]]);

// Parameterized subscription for building requirements comparison
// Returns building requirements with availability status for a production plan section
regSub(SUB_IDS.PRODUCTION_PLAN_SECTION_BUILDING_REQUIREMENTS,
    (
        bases: Base[],
        buildings: Building[],
        corporations: Corporation[],
        baseId: string,
        sectionId: string
    ): { buildingRequirements: BuildingRequirement[]; allRequirementsSatisfied: boolean } => {
        const base = bases.find(b => b.id === baseId);
        if (!base) {
            return {
                buildingRequirements: [],
                allRequirementsSatisfied: false
            };
        }

        const section = base.productionPlanSections?.find(s => s.id === sectionId);
        if (!section || !section.selectedItemId) {
            return {
                buildingRequirements: [],
                allRequirementsSatisfied: false
            };
        }

        const validAmount = section.targetAmount > 0 ? section.targetAmount : 1;
        const includeLauncher = section.corporationLevel !== null && section.corporationLevel !== undefined;
        const flow: ProductionFlowResult = buildProductionFlow(
            { targetItemId: section.selectedItemId, targetAmount: validAmount },
            buildings,
            corporations,
            includeLauncher
        );

        // Calculate required buildings from flow
        const requiredBuildingsMap = new Map<string, { name: string; count: number }>();
        flow.nodes.forEach(node => {
            const existing = requiredBuildingsMap.get(node.buildingId);
            if (existing) {
                existing.count += Math.ceil(node.buildingCount);
            } else {
                requiredBuildingsMap.set(node.buildingId, {
                    name: node.buildingName,
                    count: Math.ceil(node.buildingCount)
                });
            }
        });

        // Count available buildings in base
        const availableBuildingsMap = new Map<string, number>();
        base.buildings.forEach(baseBuilding => {
            const count = availableBuildingsMap.get(baseBuilding.buildingTypeId) || 0;
            availableBuildingsMap.set(baseBuilding.buildingTypeId, count + 1);
        });

        // Compare requirements with available
        const requirements: BuildingRequirement[] = [];
        let allSatisfied = true;
        
        requiredBuildingsMap.forEach((value, buildingId) => {
            const available = availableBuildingsMap.get(buildingId) || 0;
            const isSatisfied = available >= value.count;
            if (!isSatisfied) allSatisfied = false;
            
            requirements.push({
                buildingId,
                buildingName: value.name,
                required: value.count,
                available,
                isSatisfied
            });
        });

        // Sort by unsatisfied first, then by name
        requirements.sort((a, b) => {
            if (a.isSatisfied !== b.isSatisfied) {
                return a.isSatisfied ? 1 : -1;
            }
            return a.buildingName.localeCompare(b.buildingName);
        });

        return {
            buildingRequirements: requirements,
            allRequirementsSatisfied: allSatisfied
        };
    },
    () => [[SUB_IDS.BASES], [SUB_IDS.BUILDINGS], [SUB_IDS.CORPORATIONS]]);
