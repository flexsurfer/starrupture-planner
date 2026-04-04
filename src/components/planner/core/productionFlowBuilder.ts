/**
 * Production Flow Builder
 *
 * Builds the complete production dependency tree for a target item.
 *
 * Algorithm (three phases):
 *   Phase 1 – Normalize: validate and normalize external input sources
 *   Phase 2 – Fulfill:   recursively satisfy target demand (external inputs first, then production)
 *   Phase 3 – Finalize:  derive input-node utilization, add launcher, compute raw deficits
 */

import type {
    Building,
    Recipe,
    FlowNode,
    FlowNodeType,
    FlowEdge,
    ProductionFlowParams,
    ProductionFlowResult,
    RawMaterialDeficit,
} from './types';

// ============================================================================
// Constants & helpers
// ============================================================================

const EPSILON = 0.0001;
const ROUND_DECIMALS = 10;
const round = (value: number): number => Number(value.toFixed(ROUND_DECIMALS));

const nodeId = (buildingId: string, recipeIndex: number, outputItem: string, suffix = ''): string =>
    suffix ? `${buildingId}_${recipeIndex}_${outputItem}_${suffix}` : `${buildingId}_${recipeIndex}_${outputItem}`;

/** Returns a fresh empty result each time to prevent mutation issues. */
const emptyResult = (): ProductionFlowResult => ({
    nodes: [],
    edges: [],
    rawMaterialDeficits: []
});

// ============================================================================
// Internal types
// ============================================================================

interface RecipeInfo {
    building: Building;
    recipe: Recipe;
    recipeIndex: number;
}

const LAUNCHER_BUILDING_ID = 'orbital_cargo_launcher';
const LAUNCHER_RATE_PER_MINUTE = 10;

/** All mutable state accumulated during the demand-fulfillment pass. */
interface BuilderContext {
    nodes: FlowNode[];
    flows: Map<string, { from: string; to: string; itemId: string; amount: number }>;
    producedNodeByItem: Map<string, FlowNode>;
    inputNodeBySource: Map<string, FlowNode>;
    usedByInputSource: Map<string, number>;
    rawRequiredByItem: Map<string, number>;
    rawAvailableByItem: Map<string, number>;
}

const createBuilderContext = (): BuilderContext => ({
    nodes: [],
    flows: new Map(),
    producedNodeByItem: new Map(),
    inputNodeBySource: new Map(),
    usedByInputSource: new Map(),
    rawRequiredByItem: new Map(),
    rawAvailableByItem: new Map(),
});

// ============================================================================
// Node factory
// ============================================================================

const createFlowNode = (
    nodeType: FlowNodeType,
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
        nodeType,
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
        ...extras
    };
};

// ============================================================================
// Main function
// ============================================================================

export function buildProductionFlow(params: ProductionFlowParams, buildings: Building[]): ProductionFlowResult {
    const {
        targetItemId,
        targetAmount = 60,
        inputBuildings = [],
        recipeSelections = {},
        rawProductionDisabled = false,
        includeLauncher = false
    } = params;

    if (!buildings?.length) return emptyResult();
    if (targetAmount <= 0) return emptyResult();

    // ── Lookup caches ────────────────────────────────────────────────────
    const buildingById = new Map(buildings.filter(Boolean).map(b => [b.id, b]));

    const recipeOptionsCache = new Map<string, RecipeInfo[]>();
    for (const building of buildings) {
        if (!building?.recipes) continue;
        building.recipes.forEach((recipe, i) => {
            if (!recipeOptionsCache.has(recipe.output.id)) {
                recipeOptionsCache.set(recipe.output.id, []);
            }
            recipeOptionsCache.get(recipe.output.id)!.push({ building, recipe, recipeIndex: i });
        });
    }

    recipeOptionsCache.forEach((options) => {
        options.sort((a, b) => {
            const rateDiff = a.recipe.output.amount_per_minute - b.recipe.output.amount_per_minute;
            if (rateDiff !== 0) return rateDiff;
            const nameDiff = a.building.name.localeCompare(b.building.name);
            if (nameDiff !== 0) return nameDiff;
            return a.recipeIndex - b.recipeIndex;
        });
    });

    const getRecipe = (itemId: string): RecipeInfo | null => {
        const options = recipeOptionsCache.get(itemId) ?? [];
        if (options.length === 0) return null;

        const selectedKey = recipeSelections[itemId];
        if (selectedKey) {
            const selected = options.find(
                ({ building, recipeIndex }) => `${building.id}:${recipeIndex}` === selectedKey
            );
            if (selected) return selected;
        }

        // Slow-rate recipe is default.
        return options[0];
    };

    // "Raw" = leaf node in production graph (no recipe OR zero-input recipe).
    // Raw items CAN be produced via their recipes when rawProductionDisabled=false.
    const rawCache = new Map<string, boolean>();
    const isRaw = (itemId: string): boolean => {
        if (!rawCache.has(itemId)) {
            const info = getRecipe(itemId);
            rawCache.set(itemId, !info || info.recipe.inputs.length === 0);
        }
        return rawCache.get(itemId)!;
    };

    // Target must be producible (non-raw).
    if (isRaw(targetItemId)) return emptyResult();

    // ── Phase 1: Normalize external inputs ───────────────────────────────
    const sources = inputBuildings
        .filter((ib) =>
            ib.sectionType === 'inputs' &&
            !!ib.id &&
            !!ib.selectedItemId &&
            !!ib.ratePerMinute &&
            ib.ratePerMinute > 0 &&
            ib.selectedItemId !== targetItemId
        )
        .map((ib) => {
            const bid = ib.buildingTypeId;
            const name = buildingById.get(bid)?.name || bid;
            return {
                baseBuildingId: ib.id,
                itemId: ib.selectedItemId!,
                available: ib.ratePerMinute!,
                buildingId: bid,
                buildingName: name,
            };
        })
        .filter((s) => s.available > 0);

    const sourceStateById = new Map(sources.map(s => [
        s.baseBuildingId,
        { ...s, remaining: s.available }
    ]));

    const sourceIdsByItem = new Map<string, string[]>();
    for (const source of sources) {
        const ids = sourceIdsByItem.get(source.itemId) ?? [];
        ids.push(source.baseBuildingId);
        sourceIdsByItem.set(source.itemId, ids);
    }

    // ── Phase 2: Demand-driven fulfillment ───────────────────────────────
    const ctx = createBuilderContext();

    const addFlow = (from: string, to: string, itemId: string, amount: number): void => {
        if (amount <= EPSILON) return;
        const key = `${from}=>${to}::${itemId}`;
        const existing = ctx.flows.get(key);
        if (existing) {
            existing.amount += amount;
        } else {
            ctx.flows.set(key, { from, to, itemId, amount });
        }
    };

    const getOrCreateInputNode = (trackerId: string): FlowNode | null => {
        if (ctx.inputNodeBySource.has(trackerId)) return ctx.inputNodeBySource.get(trackerId)!;

        const source = sourceStateById.get(trackerId);
        if (!source) return null;

        const building = buildingById.get(source.buildingId);
        const node = createFlowNode(
            'input',
            building ?? { id: source.buildingId, name: source.buildingName, power: 0, heat: 0, recipes: [] },
            -2,
            source.itemId,
            source.available,
            0,
            { baseBuildingId: source.baseBuildingId }
        );

        ctx.nodes.push(node);
        ctx.inputNodeBySource.set(trackerId, node);
        return node;
    };

    const getOrCreateProducedNode = (itemId: string, info: RecipeInfo): FlowNode => {
        const existing = ctx.producedNodeByItem.get(itemId);
        if (existing) return existing;

        const node = createFlowNode(
            'production',
            info.building,
            info.recipeIndex,
            itemId,
            info.recipe.output.amount_per_minute,
            0
        );
        ctx.nodes.push(node);
        ctx.producedNodeByItem.set(itemId, node);
        return node;
    };

    const allocateInputToConsumer = (itemId: string, consumerId: string, requested: number): number => {
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

            ctx.usedByInputSource.set(sourceId, (ctx.usedByInputSource.get(sourceId) ?? 0) + amount);

            const inputNode = getOrCreateInputNode(sourceId);
            if (!inputNode) continue;

            const inputId = nodeId(
                inputNode.buildingId,
                inputNode.recipeIndex,
                inputNode.outputItem,
                sourceId
            );
            addFlow(inputId, consumerId, itemId, amount);
        }

        return allocated;
    };

    const fulfillDemand = (itemId: string, requested: number, consumerId: string | null, path: Set<string>): void => {
        if (requested <= EPSILON) return;

        const allocatedFromInput = consumerId
            ? allocateInputToConsumer(itemId, consumerId, requested)
            : 0;
        const remaining = requested - allocatedFromInput;

        const info = getRecipe(itemId);
        const raw = isRaw(itemId);

        if (raw) {
            ctx.rawRequiredByItem.set(itemId, (ctx.rawRequiredByItem.get(itemId) ?? 0) + requested);
            ctx.rawAvailableByItem.set(itemId, (ctx.rawAvailableByItem.get(itemId) ?? 0) + allocatedFromInput);

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

    fulfillDemand(targetItemId, targetAmount, null, new Set());

    // ── Phase 3: Finalize ────────────────────────────────────────────────

    // 3a. Derive input-node utilization from edge-driven used amounts.
    for (const [sourceId, inputNode] of ctx.inputNodeBySource.entries()) {
        const source = sourceStateById.get(sourceId);
        if (!source || source.available <= 0) continue;

        const used = ctx.usedByInputSource.get(sourceId) ?? 0;
        const buildingCount = round(used / source.available);
        const ceilBuildings = Math.ceil(buildingCount);

        inputNode.buildingCount = buildingCount;
        inputNode.totalPower = ceilBuildings * inputNode.powerPerBuilding;
        inputNode.totalHeat = ceilBuildings * inputNode.heatPerBuilding;
    }

    // 3b. Convert flows to edges.
    const flowEdges: FlowEdge[] = [];
    ctx.flows.forEach(f => flowEdges.push({ from: f.from, to: f.to, itemId: f.itemId, amount: f.amount }));

    // 3c. Add launcher (optional).
    if (includeLauncher) {
        const launcherBuilding = buildingById.get(LAUNCHER_BUILDING_ID);
        if (launcherBuilding) {
            const launchersNeeded = targetAmount / LAUNCHER_RATE_PER_MINUTE;

            const launcherNode = createFlowNode(
                'launcher',
                launcherBuilding,
                -1,
                targetItemId,
                LAUNCHER_RATE_PER_MINUTE,
                launchersNeeded,
            );

            ctx.nodes.push(launcherNode);

            const targetNode = ctx.producedNodeByItem.get(targetItemId);
            if (targetNode) {
                flowEdges.push({
                    from: nodeId(targetNode.buildingId, targetNode.recipeIndex, targetNode.outputItem),
                    to: nodeId(launcherNode.buildingId, launcherNode.recipeIndex, launcherNode.outputItem),
                    itemId: targetItemId,
                    amount: targetAmount
                });
            }
        }
    }

    // 3d. Calculate raw material deficits.
    const rawMaterialDeficits: RawMaterialDeficit[] = [];

    if (rawProductionDisabled) {
        ctx.rawRequiredByItem.forEach((required, itemId) => {
            const available = ctx.rawAvailableByItem.get(itemId) ?? 0;
            const missing = required - available;
            if (missing > EPSILON) {
                rawMaterialDeficits.push({ itemId, required, available, missing });
            }
        });
    }

    return { nodes: ctx.nodes, edges: flowEdges, rawMaterialDeficits };
}
