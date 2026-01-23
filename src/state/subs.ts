import { regSub } from '@flexsurfer/reflex';
import { SUB_IDS } from './sub-ids';
import type { Item, Corporation } from './db';
import type { Building, ProductionFlowResult } from '../components/planner/core/types';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import { generateReactFlowData } from '../components/planner/visualization/plannerFlowUtils';
import { getItemName } from '../components/planner/core/productionFlowBuilder';
import type { Node, Edge } from '@xyflow/react';

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
regSub(SUB_IDS.TARGET_AMOUNT);

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

// Production flow for planner (raw nodes and edges)
regSub(SUB_IDS.PLANNER_PRODUCTION_FLOW,
    (selectedItem: string | null, targetAmount: number, buildings: Building[], corporations: Corporation[]): ProductionFlowResult => {
        if (!selectedItem) {
            return { nodes: [], edges: [] };
        }
        
        const validAmount = targetAmount > 0 ? targetAmount : 1;
        return buildProductionFlow(
            { targetItemId: selectedItem, targetAmount: validAmount },
            buildings,
            corporations
        );
    },
    () => [[SUB_IDS.SELECTED_PLANNER_ITEM], [SUB_IDS.TARGET_AMOUNT], [SUB_IDS.BUILDINGS], [SUB_IDS.CORPORATIONS]]);

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
