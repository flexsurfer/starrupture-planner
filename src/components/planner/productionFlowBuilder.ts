/**
 * Production Flow Builder
 * 
 * This module is responsible for building the complete production dependency tree
 * for any given target item. It analyzes recipes, calculates building requirements,
 * and creates a flow graph that can be rendered in the UI.
 * 
 * The algorithm works backwards from the target item, recursively finding all
 * required input materials and their production chains until it reaches raw materials.
 */

import type {
    Item,
    Building,
    Recipe,
    FlowNode,
    FlowEdge,
    ProductionFlowParams,
    ProductionFlowResult,
    ProductionNode,
    OrbitalCargoLauncherNode
} from './types';
import type { Corporation } from '../../state/db';

/**
 * Helper function to find corporation component data for an item
 * 
 * @param itemId - ID of the item to find data for
 * @param corporations - Corporations data from subscription
 * @returns Component data with points and level, or null if not found
 */
function getComponentData(itemId: string, corporations: Corporation[]): { points: number; level: number } | null {
    for (const corporation of corporations) {
        for (const level of corporation.levels) {
            for (const component of level.components) {
                if (component.id === itemId) {
                    return { points: component.points, level: level.level };
                }
            }
        }
    }
    return null; // Item not used in any corporation
}

/**
 * Helper function to get level cost from levels data
 * 
 * @param level - Level number
 * @param levels - Levels data from subscription
 * @returns Cost for the level, or 0 if not found
 */
function getLevelCost(level: number, levels: any[]): number {
    const levelData = levels.find(l => l.level === level);
    return levelData ? levelData.cost : 0;
}

/**
 * Builds a complete production flow for a target item
 * 
 * This function creates a dependency tree showing all buildings and material flows
 * needed to produce a specific item at a given rate. It handles:
 * - Recipe lookup and validation
 * - Building count calculations based on production rates
 * - Recursive dependency resolution
 * - Duplicate detection to avoid infinite loops
 * 
 * @param params - Configuration for the production flow
 * @returns Complete production flow with nodes and edges
 */
export function buildProductionFlow(params: ProductionFlowParams, buildings: Building[], corporations: Corporation[], levels: any[]): ProductionFlowResult {
    const { targetItemId, targetAmount = 60 } = params;
    
    // Internal state for building the flow
    const flowNodes: ProductionNode[] = [];
    const flowEdges: FlowEdge[] = [];
    const processedItems = new Set<string>();

    /**
     * Finds the recipe and building needed to produce a specific item
     * 
     * Each item can only be produced by one building/recipe combination.
     * This function searches through all buildings to find the matching recipe.
     * 
     * @param itemId - ID of the item to find a recipe for
     * @returns Recipe information or null if no recipe exists (raw material)
     */
    const findRecipeForItem = (itemId: string): { building: Building; recipe: Recipe; recipeIndex: number } | null => {
        for (const building of buildings) {
            for (let i = 0; i < building.recipes.length; i++) {
                const recipe = building.recipes[i];
                if (recipe.output.id === itemId) {
                    return { building, recipe, recipeIndex: i };
                }
            }
        }
        return null; // This is a raw material (no recipe needed)
    };

    // Track total demand for each item to handle multiple consumers correctly
    const itemDemand = new Map<string, number>();

    /**
     * First pass: Calculate total demand for each item across all consumers
     * This prevents the issue where multiple consumers of the same item
     * create duplicate buildings instead of sharing production capacity
     * 
     * @param itemId - ID of the item to analyze
     * @param requiredAmount - How much of this item is needed (units/min)
     * @param currentPath - Set to track current recursion path (prevent cycles)
     */
    const calculateDemand = (itemId: string, requiredAmount: number, currentPath = new Set<string>()): void => {
        // Prevent infinite recursion (cycles in dependency graph)
        if (currentPath.has(itemId)) {
            console.warn(`🔄 Circular dependency detected for ${itemId}`);
            return;
        }

        // Always accumulate demand, even if we've seen this item before
        const currentDemand = itemDemand.get(itemId) || 0;
        const newTotalDemand = currentDemand + requiredAmount;
        itemDemand.set(itemId, newTotalDemand);

        // Find recipe to calculate input demands
        const recipeInfo = findRecipeForItem(itemId);
        if (!recipeInfo) return; // Raw material - no inputs to process

        // Add this item to the current path to prevent cycles
        const newPath = new Set(currentPath);
        newPath.add(itemId);

        const { recipe } = recipeInfo;
        const outputRate = recipe.output.amount_per_minute;
        const buildingsNeeded = requiredAmount / outputRate;

        // Recursively calculate demand for inputs
        for (const input of recipe.inputs) {
            const inputAmount = input.amount_per_minute * buildingsNeeded;
            calculateDemand(input.id, inputAmount, newPath);
        }
    };

    /**
     * Second pass: Create nodes and edges based on total calculated demand
     * 
     * This is the core algorithm that builds the dependency tree. For each item:
     * 1. Use pre-calculated total demand to size buildings correctly
     * 2. Find the recipe that produces this item
     * 3. Calculate how many buildings are needed for total demand
     * 4. Create a flow node for the building
     * 5. Recursively process all input materials
     * 6. Create flow edges for all material transfers
     * 
     * @param itemId - ID of the item to process
     * @param depth - Current recursion depth (for debugging)
     * @returns Unique node ID for this building instance
     */
    const processItem = (itemId: string, depth: number = 0): string => {
        // Skip if we've already processed this item
        if (processedItems.has(itemId)) {
            const existingNode = flowNodes.find(node => node.outputItem === itemId);
            return existingNode ? `${existingNode.buildingId}_${existingNode.recipeIndex}_${existingNode.outputItem}` : '';
        }

        // Try to find a recipe for this item
        const recipeInfo = findRecipeForItem(itemId);
        if (!recipeInfo) {
            // This is a raw material (ore, oil, helium, etc.)
            processedItems.add(itemId);
            return '';
        }

        const { building, recipe, recipeIndex } = recipeInfo;
        
        // Create a unique identifier for this building instance
        const nodeId = `${building.id}_${recipeIndex}_${itemId}`;
        
        // Use the pre-calculated total demand for this item
        const totalDemand = itemDemand.get(itemId) || 0;
        const outputRate = recipe.output.amount_per_minute;
        const buildingsNeeded = totalDemand / outputRate;

        // Create a flow node representing this building in the production chain
        const powerPerBuilding = building.power;
        const totalPower = Math.ceil(buildingsNeeded) * powerPerBuilding;
        
        const node: FlowNode = {
            buildingId: building.id,
            buildingName: building.name,
            recipeIndex,
            outputItem: itemId,
            outputAmount: outputRate,
            buildingCount: buildingsNeeded,
            powerPerBuilding,
            totalPower,
            x: 0, // Will be positioned by the layout algorithm
            y: 0,
        };
        
        flowNodes.push(node);
        processedItems.add(itemId);

        // Process all input materials required by this recipe
        // Note: We only create nodes here, edges will be created separately
        for (const input of recipe.inputs) {
            processItem(input.id, depth + 1);
        }

        return nodeId;
    };

    /**
     * Third step: Create edges between nodes based on their input/output relationships
     * This ensures we have single consolidated edges between buildings
     */
    const createEdges = (): void => {
        // Map to consolidate flows between the same producer-consumer pair
        const consolidatedFlows = new Map<string, { from: string; to: string; itemId: string; totalAmount: number }>();

        flowNodes.forEach(consumerNode => {
            const recipeInfo = findRecipeForItem(consumerNode.outputItem);
            if (!recipeInfo) return;

            const { recipe } = recipeInfo;
            const consumerNodeId = `${consumerNode.buildingId}_${consumerNode.recipeIndex}_${consumerNode.outputItem}`;

            // For each input this consumer needs
            recipe.inputs.forEach(input => {
                // Find the producer node for this input
                const producerNode = flowNodes.find(n => n.outputItem === input.id);
                if (producerNode) {
                    const producerNodeId = `${producerNode.buildingId}_${producerNode.recipeIndex}_${producerNode.outputItem}`;
                    
                    // Create a unique key for this producer->consumer relationship for this specific item
                    const flowKey = `${producerNodeId}==>${consumerNodeId}::${input.id}`;
                    
                    // Calculate how much this consumer needs from this producer
                    const flowAmount = input.amount_per_minute * consumerNode.buildingCount;
                    
                    // Consolidate flows between the same nodes for the same item
                    if (consolidatedFlows.has(flowKey)) {
                        consolidatedFlows.get(flowKey)!.totalAmount += flowAmount;
                    } else {
                        consolidatedFlows.set(flowKey, {
                            from: producerNodeId,
                            to: consumerNodeId,
                            itemId: input.id,
                            totalAmount: flowAmount
                        });
                    }
                }
            });
        });

        // Convert consolidated flows to edges
        consolidatedFlows.forEach(flow => {
            flowEdges.push({
                from: flow.from,
                to: flow.to,
                itemId: flow.itemId,
                amount: flow.totalAmount,
            });
        });
    };

    // Three-step algorithm to handle multiple consumers correctly:
    // 1. First step: Calculate total demand for each item
    calculateDemand(targetItemId, targetAmount);
    
    // 2. Second step: Create nodes based on total demand
    processItem(targetItemId);
    
    // 3. Third step: Create consolidated edges between nodes
    createEdges();

    // 4. Fourth step: Add Orbital Cargo Launcher node if the target item can be sent to corporations
    const componentData = getComponentData(targetItemId, corporations);
    if (componentData) {
        const launchRate = 10; // items per minute per launcher
        const launchersNeeded = targetAmount / launchRate; // number of launchers needed
        const levelCost = getLevelCost(componentData.level, levels); // get actual level cost
        const pointsPerMinute = targetAmount * componentData.points; // points earned per minute
        const launchTime = levelCost / pointsPerMinute; // total time to earn the level cost

        // Create the Orbital Cargo Launcher node
        const launcherPowerPerBuilding = 10; // Power consumption per launcher
        const launcherTotalPower = Math.ceil(launchersNeeded) * launcherPowerPerBuilding;
        
        const launcherNode: OrbitalCargoLauncherNode = {
            buildingId: 'orbital_cargo_launcher',
            buildingName: 'Orbital Cargo Launcher',
            recipeIndex: -1,
            outputItem: targetItemId,
            outputAmount: launchRate,
            buildingCount: launchersNeeded, // Now shows proper multiplier like other buildings
            powerPerBuilding: launcherPowerPerBuilding,
            totalPower: launcherTotalPower,
            x: 0,
            y: 0,
            pointsPerItem: componentData.points,
            launchTime,
            totalPoints: levelCost // Use actual level cost, not points * items
        };
        
        flowNodes.push(launcherNode);

        // Find the target item's production node to create an edge
        const targetProductionNode = flowNodes.find((node): node is FlowNode => 
            'recipeIndex' in node && 
            node.recipeIndex >= 0 && 
            node.outputItem === targetItemId
        );
        
        if (targetProductionNode) {
            const targetProductionNodeId = `${targetProductionNode.buildingId}_${targetProductionNode.recipeIndex}_${targetProductionNode.outputItem}`;
            const launcherNodeId = `${launcherNode.buildingId}_${launcherNode.recipeIndex}_${launcherNode.outputItem}`;
            
            // Add edge from production to launcher
            flowEdges.push({
                from: targetProductionNodeId,
                to: launcherNodeId,
                itemId: targetItemId,
                amount: targetAmount // Show the actual flow rate, not per-launcher rate
            });
        }
    }

    return {
        nodes: flowNodes,
        edges: flowEdges
    };
}

/**
 * Helper function to get item name by ID
 * Exported for use in UI components
 */
export function getItemName(itemId: string, items: Item[]): string {
    return items.find(item => item.id === itemId)?.name || itemId;
}