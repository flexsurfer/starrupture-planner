/**
 * Production Flow Builder
 * 
 * Builds the complete production dependency tree for a target item.
 * 
 * Algorithm passes:
 * 1. DEMAND PASS: Calculate total demand for producible items
 * 2. ALLOCATION PASS: Allocate custom inputs to production demands
 * 3. NODE CREATION PASS: Create production nodes based on remaining demand
 * 4. RAW DEMAND PASS: Calculate raw material needs from actual production nodes
 * 5. RAW ALLOCATION PASS: Allocate custom inputs to raw material consumers
 * 6. RAW NODE PASS: Create raw production nodes (if allowed)
 * 7. EDGE CREATION PASS: Create edges from allocations and production relationships
 */

import type {
    Building,
    Recipe,
    FlowNode,
    FlowEdge,
    ProductionFlowParams,
    ProductionFlowResult,
    ProductionNode,
    RawMaterialDeficit,
    InputBuildingSnapshot,
    CustomInputAllocation,
    AllocationPlan,
} from './types';

// ============================================================================
// Types
// ============================================================================

interface ConsumerDemand {
    nodeId: string;
    amount: number;
}

interface RecipeInfo {
    building: Building;
    recipe: Recipe;
    recipeIndex: number;
}

// ============================================================================
// Helpers
// ============================================================================

/** Returns a fresh empty result each time to prevent mutation issues */
const emptyResult = (): ProductionFlowResult => ({
    nodes: [],
    edges: [],
    rawMaterialDeficits: []
});

const EPSILON = 0.0001;

const nodeId = (buildingId: string, recipeIndex: number, outputItem: string, suffix = ''): string =>
    suffix ? `${buildingId}_${recipeIndex}_${outputItem}_${suffix}` : `${buildingId}_${recipeIndex}_${outputItem}`;

const createFlowNode = (
    building: Building,
    recipeIndex: number,
    outputItem: string,
    outputRate: number,
    buildingsNeeded: number,
    extras: Partial<FlowNode> = {}
): FlowNode => {
    const power = building.power || 0;
    const heat = building.heat || 0;
    const ceilBuildings = Math.ceil(buildingsNeeded);
    return {
        buildingId: building.id,
        buildingName: building.name,
        recipeIndex,
        outputItem,
        outputAmount: outputRate,
        buildingCount: buildingsNeeded,
        powerPerBuilding: power,
        heatPerBuilding: heat,
        totalPower: ceilBuildings * power,
        totalHeat: ceilBuildings * heat,
        x: 0,
        y: 0,
        ...extras
    };
};

// ============================================================================
// Main Function
// ============================================================================

export function buildProductionFlow(params: ProductionFlowParams, buildings: Building[]): ProductionFlowResult {
    const {
        targetItemId,
        targetAmount = 60,
        inputBuildings = [],
        rawProductionDisabled = false,
        includeLauncher = false
    } = params;

    if (!buildings?.length) return emptyResult();

    // -------------------------------------------------------------------------
    // Build lookup caches
    // -------------------------------------------------------------------------
    const buildingById = new Map(buildings.filter(Boolean).map(b => [b.id, b]));
    
    const recipeCache = new Map<string, RecipeInfo | null>();
    for (const building of buildings) {
        if (!building?.recipes) continue;
        building.recipes.forEach((recipe, i) => {
            if (!recipeCache.has(recipe.output.id)) {
                recipeCache.set(recipe.output.id, { building, recipe, recipeIndex: i });
            }
        });
    }

    const getRecipe = (itemId: string): RecipeInfo | null => recipeCache.get(itemId) ?? null;
    
    // "Raw" = leaf node in production graph (no recipe OR zero-input recipe)
    // Per spec: raw items CAN be produced via their recipes when rawProductionDisabled=false
    // The term "raw" refers to dependency structure, not production capability
    const rawCache = new Map<string, boolean>();
    const isRaw = (itemId: string): boolean => {
        if (!rawCache.has(itemId)) {
            const info = getRecipe(itemId);
            rawCache.set(itemId, !info || info.recipe.inputs.length === 0);
        }
        return rawCache.get(itemId)!;
    };

    // Target must be producible
    if (isRaw(targetItemId)) return emptyResult();

    // -------------------------------------------------------------------------
    // STEP 1: Normalize external inputs
    // -------------------------------------------------------------------------
    const normalizeInputBuildings = (snapshots: InputBuildingSnapshot[]): Array<{
        baseBuildingId: string;
        itemId: string;
        available: number;
        buildingId: string;
        buildingName: string;
    }> =>
        snapshots
            .filter((inputBuilding) =>
                inputBuilding.sectionType === 'inputs' &&
                !!inputBuilding.id &&
                !!inputBuilding.selectedItemId &&
                !!inputBuilding.ratePerMinute &&
                inputBuilding.ratePerMinute > 0
            )
            .map((inputBuilding) => {
                const buildingId = inputBuilding.buildingTypeId;
                const buildingName = buildingById.get(buildingId)?.name || buildingId;
                return {
                    baseBuildingId: inputBuilding.id,
                    itemId: inputBuilding.selectedItemId!,
                    available: inputBuilding.ratePerMinute!,
                    buildingId,
                    buildingName
                };
            });

    const sources = normalizeInputBuildings(inputBuildings)
        .filter((source) => source.itemId !== targetItemId && source.available > 0);

    const allocate = (consumers: Map<string, ConsumerDemand[]>): AllocationPlan => {
        const allocations: CustomInputAllocation[] = [];
        const totalAllocatedByItem = new Map<string, number>();
        const usedByTracker = new Map<string, number>();
        
        if (sources.length === 0) return { allocations, totalAllocatedByItem, usedByTracker };

        // Build demand tracking: itemId -> sorted list of { nodeId, remaining }
        const demandByItem = new Map<string, Array<{ nodeId: string; remaining: number }>>();
        consumers.forEach((list, itemId) => {
            const merged = new Map<string, number>();
            for (const { nodeId, amount } of list) {
                merged.set(nodeId, (merged.get(nodeId) ?? 0) + amount);
            }
            const sorted = Array.from(merged.entries())
                .map(([nodeId, amount]) => ({ nodeId, remaining: amount }))
                .sort((a, b) => a.nodeId.localeCompare(b.nodeId));
            demandByItem.set(itemId, sorted);
        });

        // Track remaining supply per source (fresh each call - safe due to disjoint item types)
        const supply = new Map(sources.map(s => [s.baseBuildingId, s.available]));

        // Process sources in order
        for (const source of sources) {
            let available = supply.get(source.baseBuildingId) ?? 0;
            if (available <= 0) continue;

            const demands = demandByItem.get(source.itemId);
            if (!demands) continue;

            for (const demand of demands) {
                if (available <= 0 || demand.remaining <= 0) continue;

                const amount = Math.min(available, demand.remaining);
                
                allocations.push({
                    baseBuildingId: source.baseBuildingId,
                    buildingId: source.buildingId,
                    buildingName: source.buildingName,
                    consumerNodeId: demand.nodeId,
                    itemId: source.itemId,
                    amount
                });

                available -= amount;
                demand.remaining -= amount;
                supply.set(source.baseBuildingId, available);
                totalAllocatedByItem.set(source.itemId, (totalAllocatedByItem.get(source.itemId) ?? 0) + amount);
                usedByTracker.set(source.baseBuildingId, (usedByTracker.get(source.baseBuildingId) ?? 0) + amount);
            }
        }

        return { allocations, totalAllocatedByItem, usedByTracker };
    };

    // Compute remaining demand and consume custom input pools only on reachable
    // branches. This prevents supply from being "spent" on branches that are
    // later pruned by other custom inputs.
    const remainingDemand = new Map<string, number>();
    remainingDemand.set(targetItemId, targetAmount);

    const remainingSupplyByItem = new Map<string, number>();
    for (const source of sources) {
        remainingSupplyByItem.set(
            source.itemId,
            (remainingSupplyByItem.get(source.itemId) ?? 0) + source.available
        );
    }

    const propagatedByItem = new Map<string, number>();
    const queue: string[] = [targetItemId];

    while (queue.length > 0) {
        const itemId = queue.shift()!;
        if (isRaw(itemId)) continue;

        const info = getRecipe(itemId);
        if (!info) continue;

        const totalDemand = remainingDemand.get(itemId) ?? 0;
        const alreadyPropagated = propagatedByItem.get(itemId) ?? 0;
        const deltaDemand = totalDemand - alreadyPropagated;
        if (deltaDemand <= EPSILON) continue;

        propagatedByItem.set(itemId, totalDemand);
        const buildingsForDelta = deltaDemand / info.recipe.output.amount_per_minute;

        for (const input of info.recipe.inputs) {
            const inputNeeded = input.amount_per_minute * buildingsForDelta;
            if (inputNeeded <= EPSILON) continue;

            const available = remainingSupplyByItem.get(input.id) ?? 0;
            const fromCustom = Math.min(inputNeeded, available);
            if (fromCustom > EPSILON) {
                remainingSupplyByItem.set(input.id, available - fromCustom);
            }

            const remainingInputDemand = inputNeeded - fromCustom;
            if (remainingInputDemand <= EPSILON) continue;

            remainingDemand.set(input.id, (remainingDemand.get(input.id) ?? 0) + remainingInputDemand);
            queue.push(input.id);
        }
    }

    // -------------------------------------------------------------------------
    // STEP 3: Create production nodes
    // -------------------------------------------------------------------------
    const flowNodes: ProductionNode[] = [];
    const nodeByItem = new Map<string, FlowNode>();
    const processed = new Set<string>();

    const processItem = (itemId: string): void => {
        if (processed.has(itemId)) return;
        processed.add(itemId);

        if (isRaw(itemId)) return;

        const info = getRecipe(itemId);
        if (!info) return;

        const demand = remainingDemand.get(itemId) ?? 0;
        if (demand <= 0) return;

        const buildingsNeeded = demand / info.recipe.output.amount_per_minute;
        const node = createFlowNode(
            info.building,
            info.recipeIndex,
            itemId,
            info.recipe.output.amount_per_minute,
            buildingsNeeded
        );

        flowNodes.push(node);
        nodeByItem.set(itemId, node);

        for (const input of info.recipe.inputs) {
            processItem(input.id);
        }
    };

    processItem(targetItemId);

    // -------------------------------------------------------------------------
    // STEP 4: Calculate raw material demands from actual production nodes
    // -------------------------------------------------------------------------
    const rawDemand = new Map<string, number>();
    const rawConsumers = new Map<string, ConsumerDemand[]>();

    for (const node of flowNodes) {
        if (node.isCustomInput || node.recipeIndex < 0) continue;

        const info = getRecipe(node.outputItem);
        if (!info) continue;

        const consumerNodeId = nodeId(node.buildingId, node.recipeIndex, node.outputItem);

        for (const input of info.recipe.inputs) {
            if (!isRaw(input.id)) continue;

            const inputDemand = input.amount_per_minute * node.buildingCount;
            rawDemand.set(input.id, (rawDemand.get(input.id) ?? 0) + inputDemand);

            const consumers = rawConsumers.get(input.id) ?? [];
            consumers.push({ nodeId: consumerNodeId, amount: inputDemand });
            rawConsumers.set(input.id, consumers);
        }
    }

    // -------------------------------------------------------------------------
    // STEP 5: Allocate custom inputs to raw materials
    // -------------------------------------------------------------------------
    const rawAllocation = rawDemand.size > 0
        ? allocate(rawConsumers)
        : { allocations: [], totalAllocatedByItem: new Map(), usedByTracker: new Map() };

    // -------------------------------------------------------------------------
    // STEP 6: Create raw production nodes (if allowed)
    // -------------------------------------------------------------------------
    if (!rawProductionDisabled) {
        rawDemand.forEach((required, itemId) => {
            const allocated = rawAllocation.totalAllocatedByItem.get(itemId) ?? 0;
            const remaining = required - allocated;
            if (remaining <= EPSILON) return;

            const info = getRecipe(itemId);
            if (!info) return;

            const buildingsNeeded = remaining / info.recipe.output.amount_per_minute;
            const node = createFlowNode(
                info.building,
                info.recipeIndex,
                itemId,
                info.recipe.output.amount_per_minute,
                buildingsNeeded
            );

            flowNodes.push(node);
            nodeByItem.set(itemId, node);
        });
    }

    // -------------------------------------------------------------------------
    // STEP 7: Create edges (edge-driven approach)
    // 
    // Custom input nodes and allocation tracking are built AS edges are created,
    // ensuring custom utilization and allocatedToConsumer always match actual edges.
    // -------------------------------------------------------------------------
    const flowEdges: FlowEdge[] = [];
    const flows = new Map<string, { from: string; to: string; itemId: string; amount: number }>();

    const addFlow = (from: string, to: string, itemId: string, amount: number): void => {
        const key = `${from}=>${to}::${itemId}`;
        const existing = flows.get(key);
        if (existing) {
            existing.amount += amount;
        } else {
            flows.set(key, { from, to, itemId, amount });
        }
    };

    // Edge-driven custom input node creation
    // Nodes are created lazily when they first get an outgoing edge
    const customNodeBySource = new Map<string, FlowNode>();
    const sourceById = new Map(sources.map(s => [s.baseBuildingId, s]));

    const getOrCreateCustomNode = (trackerId: string): FlowNode | null => {
        if (customNodeBySource.has(trackerId)) return customNodeBySource.get(trackerId)!;

        const source = sourceById.get(trackerId);
        if (!source) return null;

        const building = buildingById.get(source.buildingId);
        // Custom nodes behave like regular nodes:
        // outputAmount = source rate per minute, buildingCount derived from used amount.
        const node = createFlowNode(
            building ?? { id: source.buildingId, name: source.buildingName, power: 0, heat: 0, recipes: [] },
            -2,
            source.itemId,
            source.available,
            0,
            { isCustomInput: true, baseBuildingId: source.baseBuildingId }
        );

        flowNodes.push(node);
        customNodeBySource.set(trackerId, node);
        return node;
    };

    // Edge-driven allocation tracking
    // Built as edges are created, ensuring consistency with actual graph
    const allocatedToConsumer = new Map<string, number>();
    const usedByCustomSource = new Map<string, number>();
    const actualConsumers = new Map<string, ConsumerDemand[]>();
    for (const consumer of flowNodes) {
        if (consumer.isCustomInput || consumer.recipeIndex < 0) continue;

        const info = getRecipe(consumer.outputItem);
        if (!info) continue;

        const consumerId = nodeId(consumer.buildingId, consumer.recipeIndex, consumer.outputItem);
        for (const input of info.recipe.inputs) {
            const amount = input.amount_per_minute * consumer.buildingCount;
            if (amount <= EPSILON) continue;

            const consumers = actualConsumers.get(input.id) ?? [];
            consumers.push({ nodeId: consumerId, amount });
            actualConsumers.set(input.id, consumers);
        }
    }

    const edgeAllocation = allocate(actualConsumers);
    const allAllocations = edgeAllocation.allocations;
    const validConsumerIds = new Set<string>(
        flowNodes
            .filter(node => !node.isCustomInput)
            .map(node => nodeId(node.buildingId, node.recipeIndex, node.outputItem))
    );

    // Create custom input edges and track allocations simultaneously
    for (const a of allAllocations) {
        if (!a.consumerNodeId || a.amount <= 0) continue;
        if (!validConsumerIds.has(a.consumerNodeId)) continue;
        
        const customNode = getOrCreateCustomNode(a.baseBuildingId);
        if (!customNode) continue;

        usedByCustomSource.set(a.baseBuildingId, (usedByCustomSource.get(a.baseBuildingId) ?? 0) + a.amount);

        // Track allocation for this consumer (edge-driven)
        const allocKey = `${a.consumerNodeId}::${a.itemId}`;
        allocatedToConsumer.set(allocKey, (allocatedToConsumer.get(allocKey) ?? 0) + a.amount);

        const customId = nodeId(customNode.buildingId, customNode.recipeIndex, customNode.outputItem, a.baseBuildingId);
        addFlow(customId, a.consumerNodeId, a.itemId, a.amount);
    }

    // Finalize custom node utilization from edge-driven used amounts.
    for (const [trackerId, customNode] of customNodeBySource.entries()) {
        const source = sourceById.get(trackerId);
        if (!source || source.available <= 0) continue;

        const used = usedByCustomSource.get(trackerId) ?? 0;
        const buildingCount = used / source.available;
        const ceilBuildings = Math.ceil(buildingCount);

        customNode.buildingCount = buildingCount;
        customNode.totalPower = ceilBuildings * customNode.powerPerBuilding;
        customNode.totalHeat = ceilBuildings * customNode.heatPerBuilding;
    }

    // Edges from production relationships (using edge-driven allocation index)
    for (const consumer of flowNodes) {
        if (consumer.isCustomInput || consumer.recipeIndex < 0) continue;

        const info = getRecipe(consumer.outputItem);
        if (!info) continue;

        const consumerId = nodeId(consumer.buildingId, consumer.recipeIndex, consumer.outputItem);

        for (const input of info.recipe.inputs) {
            const totalNeeded = input.amount_per_minute * consumer.buildingCount;
            const fromCustom = allocatedToConsumer.get(`${consumerId}::${input.id}`) ?? 0;
            const remaining = totalNeeded - fromCustom;

            if (remaining > EPSILON) {
                const producer = nodeByItem.get(input.id);
                if (producer) {
                    const producerId = nodeId(producer.buildingId, producer.recipeIndex, producer.outputItem);
                    addFlow(producerId, consumerId, input.id, remaining);
                }
            }
        }
    }

    // Convert flows to edges
    flows.forEach(f => flowEdges.push({ from: f.from, to: f.to, itemId: f.itemId, amount: f.amount }));

    // -------------------------------------------------------------------------
    // STEP 8: Add launcher
    // -------------------------------------------------------------------------
    if (includeLauncher) {
        const launchRate = 10;
        const launchersNeeded = targetAmount / launchRate;

        const launcherNode: FlowNode = {
            buildingId: 'orbital_cargo_launcher',
            buildingName: 'Orbital Cargo Launcher',
            recipeIndex: -1,
            outputItem: targetItemId,
            outputAmount: launchRate,
            buildingCount: launchersNeeded,
            powerPerBuilding: 10,
            heatPerBuilding: 5,
            totalPower: Math.ceil(launchersNeeded) * 10,
            totalHeat: Math.ceil(launchersNeeded) * 5,
            x: 0,
            y: 0
        };

        flowNodes.push(launcherNode);

        const targetNode = nodeByItem.get(targetItemId);
        if (targetNode) {
            flowEdges.push({
                from: nodeId(targetNode.buildingId, targetNode.recipeIndex, targetNode.outputItem),
                to: nodeId(launcherNode.buildingId, launcherNode.recipeIndex, launcherNode.outputItem),
                itemId: targetItemId,
                amount: targetAmount
            });
        }
    }

    // -------------------------------------------------------------------------
    // STEP 9: Calculate raw material deficits
    // -------------------------------------------------------------------------
    const rawMaterialDeficits: RawMaterialDeficit[] = [];

    if (rawProductionDisabled) {
        rawDemand.forEach((required, itemId) => {
            const available = rawAllocation.totalAllocatedByItem.get(itemId) ?? 0;
            const missing = required - available;
            if (missing > EPSILON) {
                rawMaterialDeficits.push({ itemId, required, available, missing });
            }
        });
    }

    return { nodes: flowNodes, edges: flowEdges, rawMaterialDeficits };
}
