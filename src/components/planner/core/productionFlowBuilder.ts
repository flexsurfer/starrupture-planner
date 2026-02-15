/**
 * Production Flow Builder
 *
 * Builds the complete production dependency tree for a target item.
 *
 * Algorithm (demand-driven):
 * 1. Normalize external input sources
 * 2. Recursively fulfill target demand:
 *    - consume matching custom inputs (deterministic source order)
 *    - produce remaining demand internally (unless raw production is disabled)
 *    - propagate input demands to producer recipes
 * 3. Finalize custom node utilization from emitted edges
 * 4. Add launcher (optional)
 * 5. Compute raw deficits (optional)
 */

import type {
    Building,
    Recipe,
    FlowNode,
    FlowEdge,
    ProductionFlowParams,
    ProductionFlowResult,
    RawMaterialDeficit,
    InputBuildingSnapshot
} from './types';

// ============================================================================
// Types
// ============================================================================

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
const ROUND_DECIMALS = 10;
const round = (value: number): number => Number(value.toFixed(ROUND_DECIMALS));

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

    const sourceStateById = new Map(sources.map(source => [
        source.baseBuildingId,
        { ...source, remaining: source.available }
    ]));
    const sourceIdsByItem = new Map<string, string[]>();
    for (const source of sources) {
        const sourceIds = sourceIdsByItem.get(source.itemId) ?? [];
        sourceIds.push(source.baseBuildingId);
        sourceIdsByItem.set(source.itemId, sourceIds);
    }

    // -------------------------------------------------------------------------
    // STEP 2: Demand-driven fulfillment (production + edges)
    // -------------------------------------------------------------------------
    const flowNodes: FlowNode[] = [];
    const flowEdges: FlowEdge[] = [];
    const flows = new Map<string, { from: string; to: string; itemId: string; amount: number }>();
    const producedNodeByItem = new Map<string, FlowNode>();
    const customNodeBySource = new Map<string, FlowNode>();
    const usedByCustomSource = new Map<string, number>();
    const rawRequiredByItem = new Map<string, number>();
    const rawAvailableByItem = new Map<string, number>();

    const addFlow = (from: string, to: string, itemId: string, amount: number): void => {
        if (amount <= EPSILON) return;
        const key = `${from}=>${to}::${itemId}`;
        const existing = flows.get(key);
        if (existing) {
            existing.amount += amount;
        } else {
            flows.set(key, { from, to, itemId, amount });
        }
    };

    const getOrCreateCustomNode = (trackerId: string): FlowNode | null => {
        if (customNodeBySource.has(trackerId)) return customNodeBySource.get(trackerId)!;

        const source = sourceStateById.get(trackerId);
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

    const getOrCreateProducedNode = (itemId: string, info: RecipeInfo): FlowNode => {
        const existing = producedNodeByItem.get(itemId);
        if (existing) return existing;

        const node = createFlowNode(
            info.building,
            info.recipeIndex,
            itemId,
            info.recipe.output.amount_per_minute,
            0
        );
        flowNodes.push(node);
        producedNodeByItem.set(itemId, node);
        return node;
    };

    const allocateCustomToConsumer = (itemId: string, consumerId: string, requested: number): number => {
        if (!consumerId || requested <= EPSILON) return 0;

        const sourceIds = sourceIdsByItem.get(itemId) ?? [];
        if (sourceIds.length === 0) return 0;

        let remaining = requested;
        let allocated = 0;

        for (const sourceId of sourceIds) {
            if (remaining <= EPSILON) break;

            const source = sourceStateById.get(sourceId);
            if (!source || source.remaining <= EPSILON) continue;

            const amount = Math.min(source.remaining, remaining);
            if (amount <= EPSILON) continue;

            source.remaining -= amount;
            remaining -= amount;
            allocated += amount;

            usedByCustomSource.set(sourceId, (usedByCustomSource.get(sourceId) ?? 0) + amount);

            const customNode = getOrCreateCustomNode(sourceId);
            if (!customNode) continue;

            const customId = nodeId(
                customNode.buildingId,
                customNode.recipeIndex,
                customNode.outputItem,
                sourceId
            );
            addFlow(customId, consumerId, itemId, amount);
        }

        return allocated;
    };

    const fulfillDemand = (itemId: string, requested: number, consumerId: string, path: Set<string>): void => {
        if (requested <= EPSILON) return;

        const allocatedFromCustom = allocateCustomToConsumer(itemId, consumerId, requested);
        const remaining = requested - allocatedFromCustom;

        const info = getRecipe(itemId);
        const raw = isRaw(itemId);

        if (raw) {
            rawRequiredByItem.set(itemId, (rawRequiredByItem.get(itemId) ?? 0) + requested);
            rawAvailableByItem.set(itemId, (rawAvailableByItem.get(itemId) ?? 0) + allocatedFromCustom);

            if (remaining <= EPSILON) return;
            if (rawProductionDisabled || !info) return;
        }

        if (remaining <= EPSILON) return;
        if (!info) return;
        if (path.has(itemId)) return;

        const producerNode = getOrCreateProducedNode(itemId, info);
        const additionalBuildings = remaining / info.recipe.output.amount_per_minute;
        producerNode.buildingCount = round(producerNode.buildingCount + additionalBuildings);
        const ceilBuildings = Math.ceil(producerNode.buildingCount);
        producerNode.totalPower = ceilBuildings * producerNode.powerPerBuilding;
        producerNode.totalHeat = ceilBuildings * producerNode.heatPerBuilding;

        const producerId = nodeId(producerNode.buildingId, producerNode.recipeIndex, producerNode.outputItem);
        if (consumerId) {
            addFlow(producerId, consumerId, itemId, remaining);
        }

        path.add(itemId);
        for (const input of info.recipe.inputs) {
            const inputAmount = input.amount_per_minute * additionalBuildings;
            fulfillDemand(input.id, inputAmount, producerId, path);
        }
        path.delete(itemId);
    };

    fulfillDemand(targetItemId, targetAmount, '', new Set());

    // Finalize custom node utilization from edge-driven used amounts.
    for (const [sourceId, customNode] of customNodeBySource.entries()) {
        const source = sourceStateById.get(sourceId);
        if (!source || source.available <= 0) continue;

        const used = usedByCustomSource.get(sourceId) ?? 0;
        const buildingCount = round(used / source.available);
        const ceilBuildings = Math.ceil(buildingCount);

        customNode.buildingCount = buildingCount;
        customNode.totalPower = ceilBuildings * customNode.powerPerBuilding;
        customNode.totalHeat = ceilBuildings * customNode.heatPerBuilding;
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

        const targetNode = producedNodeByItem.get(targetItemId);
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
        rawRequiredByItem.forEach((required, itemId) => {
            const available = rawAvailableByItem.get(itemId) ?? 0;
            const missing = required - available;
            if (missing > EPSILON) {
                rawMaterialDeficits.push({ itemId, required, available, missing });
            }
        });
    }

    return { nodes: flowNodes, edges: flowEdges, rawMaterialDeficits };
}
