import type {
  BaseLayout,
  BaseLayoutBalance,
  BaseLayoutBuilding,
  BuildingsByIdMap,
  BaseLayoutConnection,
  DistributionMode,
} from "@/app/uklad/model";
import { resolveLayoutBuildingRecipe } from "@/features/base-layout/recipe-resolution";

/**
 * Rail tier capacity in items per minute
 */
const RAIL_CAPACITIES: Record<number, number> = {
  1: 120,
  2: 240,
  3: 480,
};

export interface BuildingProductionState {
  buildingId: string;
  outputItemId: string;
  maxOutputRate: number;
  actualOutputRate: number;
  consumedOutputRate: number; // How much of the output is actually being consumed by downstream buildings
  inputRequirements: Array<{
    itemId: string;
    requiredRate: number;
    suppliedRate: number;
  }>;
  productionFactor: number; // 0-1, based on input fulfillment
}

export interface LayoutBalanceResult {
  balances: BaseLayoutBalance[];
  buildingStates: Map<string, BuildingProductionState>;
  _timestamp?: number; // Forces unique object identity for Reflex reactivity
}

interface BuildingInfo {
  x: number;
  y: number;
  distributionMode: DistributionMode;
}

/**
 * Distributes a total amount equally across slots that each have a maximum capacity,
 * using the water-filling algorithm. Connections that are capped give their excess
 * back to the remaining active connections.
 */
function waterFill(total: number, maxes: number[]): number[] {
  const n = maxes.length;
  if (n === 0) return [];

  const result = new Array<number>(n).fill(0);
  let remaining = total;
  // Indices of connections that haven't been capped yet
  let activeIndices = maxes.map((_, i) => i);

  while (remaining > 0.001 && activeIndices.length > 0) {
    const share = remaining / activeIndices.length;
    let allocated = 0;
    const nextActive: number[] = [];

    for (const i of activeIndices) {
      const canTake = maxes[i] - result[i];
      if (canTake <= share + 0.001) {
        // This connection is at or below its cap — give it everything it can take
        result[i] = maxes[i];
        allocated += canTake;
      } else {
        // This connection can absorb the full equal share
        result[i] += share;
        allocated += share;
        nextActive.push(i);
      }
    }

    remaining -= allocated;
    activeIndices = nextActive;
  }

  return result;
}

/**
 * Calculates the production/demand balance for all items in a layout.
 *
 * Model:
 * 1. Each building's production is scaled by the minimum input fulfillment ratio
 *    (e.g. if it gets 10/100 of one input, it produces at 10%).
 * 2. A building's actual output is distributed across outbound connectors
 *    according to the building's distributionMode.
 * 3. Iterative convergence handles cascading production chains.
 * 4. Surplus = production − amount transferred out via connectors.
 *    Deficit = full demand − amount transferred in via connectors.
 *
 * Distribution modes (per building):
 * - "first-served": fill connectors in index order until output is exhausted.
 * - "shortest-path": same as first-served but sorted by Euclidean distance
 *   (closest target first).
 * - "equal": divide output equally across connectors using water-filling,
 *   so capacity-limited connections give excess to the others.
 *
 * @param layout The base layout with buildings and connections
 * @param buildingsById Map of building definitions by ID
 * @returns Balance data and per-building production states
 */
export function calculateLayoutBalance(
  layout: BaseLayout | undefined,
  buildingsById: BuildingsByIdMap,
): LayoutBalanceResult {
  if (!layout || layout.buildings.length === 0) {
    return {
      balances: [],
      buildingStates: new Map(),
    };
  }

  // Build a lookup for each layout building's position and distribution mode
  const buildingInfoMap = new Map<string, BuildingInfo>();
  for (const b of layout.buildings) {
    buildingInfoMap.set(b.id, {
      x: b.x,
      y: b.y,
      distributionMode: b.distributionMode ?? "first-served",
    });
  }

  // Phase 1: Build production state for each building
  const buildingStates = new Map<string, BuildingProductionState>();

  for (const layoutBuilding of layout.buildings) {
    // Skip disabled buildings — they produce and consume nothing
    if (layoutBuilding.enabled === false) continue;

    // Handle package receivers separately.
    // Also check buildingId as a fallback for legacy data saved before
    // buildingType was consistently persisted.
    const isReceiver =
      layoutBuilding.buildingType === "receiver" ||
      layoutBuilding.buildingId === "package_receiver";
    if (isReceiver) {
      const outputRate = layoutBuilding.receiverOutputRate || 100;
      buildingStates.set(layoutBuilding.id, {
        buildingId: layoutBuilding.id,
        outputItemId: layoutBuilding.itemId,
        maxOutputRate: outputRate,
        actualOutputRate: outputRate, // Always at 100%
        consumedOutputRate: 0,
        inputRequirements: [], // No inputs for package receivers
        productionFactor: 1, // Always at 100%
      });
      continue;
    }

    const isDispatcher =
      layoutBuilding.buildingType === "dispatcher" ||
      layoutBuilding.buildingId === "package_dispatcher";
    if (isDispatcher) {
      const inputRate = layoutBuilding.dispatcherInputRate || 100;
      buildingStates.set(layoutBuilding.id, {
        buildingId: layoutBuilding.id,
        outputItemId: layoutBuilding.itemId,
        maxOutputRate: 0,
        actualOutputRate: 0,
        consumedOutputRate: 0,
        inputRequirements: [
          {
            itemId: layoutBuilding.itemId,
            requiredRate: inputRate,
            suppliedRate: 0,
          },
        ],
        productionFactor: 1,
      });
      continue;
    }

    const building = buildingsById[layoutBuilding.buildingId];
    if (!building || !building.recipes || building.recipes.length === 0) {
      continue;
    }

    const recipe = resolveLayoutBuildingRecipe(layoutBuilding, building);
    if (!recipe) {
      continue;
    }

    const hasInputs = recipe.inputs.length > 0;
    const buildingCount = layoutBuilding.count || 1;
    const maxOutputRate = recipe.output.amount_per_minute * buildingCount;

    buildingStates.set(layoutBuilding.id, {
      buildingId: layoutBuilding.id,
      outputItemId: recipe.output.id,
      maxOutputRate,
      actualOutputRate: hasInputs ? 0 : maxOutputRate, // Extractors at 100%
      consumedOutputRate: 0,
      inputRequirements: recipe.inputs.map((input) => ({
        itemId: input.id,
        requiredRate: input.amount_per_minute * buildingCount,
        suppliedRate: 0,
      })),
      productionFactor: hasInputs ? 0 : 1,
    });
  }

  // Phase 2: Iteratively calculate production with connector-based supply
  const MAX_ITERATIONS = 10;
  const CONVERGENCE_THRESHOLD = 0.01;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let maxChange = 0;

    // Allocate output via connectors and compute supply per target input
    const { suppliedPerInput } = allocateConnectors(
      layout.connections,
      buildingStates,
      buildingInfoMap,
    );

    // Update each building's supply, production factor, and output
    for (const [buildingId, state] of buildingStates) {
      if (state.inputRequirements.length === 0) continue; // Extractors don't change

      // Update supplied rates from connector allocation
      for (const inputReq of state.inputRequirements) {
        const key = `${buildingId}:${inputReq.itemId}`;
        inputReq.suppliedRate = Math.min(
          suppliedPerInput.get(key) || 0,
          inputReq.requiredRate,
        );
      }

      // Production factor = minimum fulfillment ratio across all inputs
      let minFulfillment = 1;
      for (const inputReq of state.inputRequirements) {
        const ratio =
          inputReq.requiredRate > 0
            ? Math.min(1, inputReq.suppliedRate / inputReq.requiredRate)
            : 1;
        minFulfillment = Math.min(minFulfillment, ratio);
      }

      const oldOutputRate = state.actualOutputRate;
      state.productionFactor = minFulfillment;
      state.actualOutputRate = state.maxOutputRate * minFulfillment;

      maxChange = Math.max(
        maxChange,
        Math.abs(state.actualOutputRate - oldOutputRate),
      );
    }

    if (maxChange < CONVERGENCE_THRESHOLD) {
      break;
    }
  }

  // Phase 3: Final connector allocation to get consumedOutputRate
  const { consumedPerSource, suppliedPerInput } = allocateConnectors(
    layout.connections,
    buildingStates,
    buildingInfoMap,
  );

  for (const [buildingId, state] of buildingStates) {
    state.consumedOutputRate = consumedPerSource.get(buildingId) || 0;
  }

  // Phase 4: Aggregate balance per item using connector-based surplus/deficit
  const itemProduction = new Map<string, number>();
  const itemDemand = new Map<string, number>();
  const itemTransferredOut = new Map<string, number>();
  const itemTransferredIn = new Map<string, number>();

  for (const state of buildingStates.values()) {
    const outputId = state.outputItemId;
    itemProduction.set(
      outputId,
      (itemProduction.get(outputId) || 0) + state.actualOutputRate,
    );
    itemTransferredOut.set(
      outputId,
      (itemTransferredOut.get(outputId) || 0) + state.consumedOutputRate,
    );

    for (const inputReq of state.inputRequirements) {
      itemDemand.set(
        inputReq.itemId,
        (itemDemand.get(inputReq.itemId) || 0) + inputReq.requiredRate,
      );
      const key = `${state.buildingId}:${inputReq.itemId}`;
      const supplied = suppliedPerInput.get(key) || 0;
      itemTransferredIn.set(
        inputReq.itemId,
        (itemTransferredIn.get(inputReq.itemId) || 0) + supplied,
      );
    }
  }

  const allItemIds = new Set([...itemProduction.keys(), ...itemDemand.keys()]);

  const balances: BaseLayoutBalance[] = [];
  for (const itemId of allItemIds) {
    const production = itemProduction.get(itemId) || 0;
    const demand = itemDemand.get(itemId) || 0;
    const transferredOut = itemTransferredOut.get(itemId) || 0;
    const transferredIn = itemTransferredIn.get(itemId) || 0;

    // Surplus = production that isn't sent out via connectors
    const surplus = Math.max(0, production - transferredOut);

    // Deficit = demand that isn't satisfied via connectors
    const deficit = Math.max(0, demand - transferredIn);

    balances.push({
      itemId,
      totalProduction: production,
      totalDemand: demand,
      surplus,
      deficit,
    });
  }

  // Sort by item ID for consistent ordering
  balances.sort((a, b) => a.itemId.localeCompare(b.itemId));

  // Create a new Map to ensure Reflex detects changes (reference equality)
  // Add timestamp to force new object identity
  return {
    balances,
    buildingStates: new Map(buildingStates),
    _timestamp: Date.now(), // Force unique object identity
  };
}

export interface ConnectionTransferRate {
  connectionId: string;
  currentRate: number;
  maxRate: number;
  tierName: string;
}

/**
 * Allocates each source building's actualOutputRate across its outbound connectors,
 * applying the building's distributionMode:
 *
 * - "first-served": fill connectors in their natural index order.
 * - "shortest-path": sort connectors by ascending Euclidean distance to target,
 *   then fill in order (closest first).
 * - "equal": distribute remaining output equally via water-filling so capacity-
 *   constrained connectors give their unused share to others.
 *
 * Returns:
 * - consumedPerSource: total output consumed via connectors per source building
 * - suppliedPerInput: total supplied per target input (`${buildingId}:${itemId}`)
 * - perConnection: rate per connection ID
 */
function allocateConnectors(
  connections: BaseLayoutConnection[],
  buildingStates: Map<string, BuildingProductionState>,
  buildingInfoMap: Map<string, BuildingInfo>,
): {
  consumedPerSource: Map<string, number>;
  suppliedPerInput: Map<string, number>;
  perConnection: Map<string, number>;
} {
  const consumedPerSource = new Map<string, number>();
  const suppliedPerInput = new Map<string, number>();
  const perConnection = new Map<string, number>();

  // Group outbound connections by source building
  const outboundBySource = new Map<string, BaseLayoutConnection[]>();
  for (const conn of connections) {
    if (!outboundBySource.has(conn.fromBuildingId)) {
      outboundBySource.set(conn.fromBuildingId, []);
    }
    outboundBySource.get(conn.fromBuildingId)!.push(conn);
  }

  for (const [sourceBuildingId, outbound] of outboundBySource) {
    const sourceState = buildingStates.get(sourceBuildingId);
    if (!sourceState) {
      for (const conn of outbound) {
        perConnection.set(conn.id, 0);
      }
      continue;
    }

    const sourceInfo = buildingInfoMap.get(sourceBuildingId);
    const distributionMode = sourceInfo?.distributionMode ?? "first-served";

    // Build an ordered list of connections to process
    let orderedConnections: BaseLayoutConnection[];

    if (distributionMode === "shortest-path" && sourceInfo) {
      // Sort by Euclidean distance to each target building (ascending)
      orderedConnections = [...outbound].sort((a, b) => {
        const infoA = buildingInfoMap.get(a.toBuildingId);
        const infoB = buildingInfoMap.get(b.toBuildingId);
        const distA = infoA
          ? Math.sqrt(
              (infoA.x - sourceInfo.x) ** 2 + (infoA.y - sourceInfo.y) ** 2,
            )
          : Infinity;
        const distB = infoB
          ? Math.sqrt(
              (infoB.x - sourceInfo.x) ** 2 + (infoB.y - sourceInfo.y) ** 2,
            )
          : Infinity;
        return distA - distB;
      });
    } else {
      orderedConnections = outbound;
    }

    if (distributionMode === "equal") {
      // Compute the maximum each connection can absorb given rail capacity
      // and the target's remaining unfilled demand
      const maxes = orderedConnections.map((conn) => {
        const railCapacity = RAIL_CAPACITIES[conn.railTier] || 0;
        const targetState = buildingStates.get(conn.toBuildingId);
        let targetRemainingInput = 0;
        if (targetState) {
          const inputReq = targetState.inputRequirements.find(
            (r) => r.itemId === conn.itemId,
          );
          if (inputReq) {
            const inboundKey = `${conn.toBuildingId}:${conn.itemId}`;
            const alreadyAllocated = suppliedPerInput.get(inboundKey) || 0;
            targetRemainingInput = Math.max(
              0,
              inputReq.requiredRate - alreadyAllocated,
            );
          }
        }
        return Math.min(railCapacity, targetRemainingInput);
      });

      // Distribute the source's output equally using water-filling
      const rates = waterFill(sourceState.actualOutputRate, maxes);

      for (let i = 0; i < orderedConnections.length; i++) {
        const conn = orderedConnections[i];
        const rate = rates[i];
        perConnection.set(conn.id, rate);
        consumedPerSource.set(
          sourceBuildingId,
          (consumedPerSource.get(sourceBuildingId) || 0) + rate,
        );
        const inboundKey = `${conn.toBuildingId}:${conn.itemId}`;
        suppliedPerInput.set(
          inboundKey,
          (suppliedPerInput.get(inboundKey) || 0) + rate,
        );
      }
    } else {
      // "first-served" and "shortest-path" both fill greedily in order
      let remainingOutput = sourceState.actualOutputRate;

      for (const conn of orderedConnections) {
        const railCapacity = RAIL_CAPACITIES[conn.railTier] || 0;

        const targetState = buildingStates.get(conn.toBuildingId);
        let targetRemainingInput = 0;

        if (targetState) {
          const inputReq = targetState.inputRequirements.find(
            (r) => r.itemId === conn.itemId,
          );
          if (inputReq) {
            const inboundKey = `${conn.toBuildingId}:${conn.itemId}`;
            const alreadyAllocated = suppliedPerInput.get(inboundKey) || 0;
            targetRemainingInput = Math.max(
              0,
              inputReq.requiredRate - alreadyAllocated,
            );
          }
        }

        const rate = Math.min(
          railCapacity,
          remainingOutput,
          targetRemainingInput,
        );
        perConnection.set(conn.id, rate);

        remainingOutput -= rate;
        consumedPerSource.set(
          sourceBuildingId,
          (consumedPerSource.get(sourceBuildingId) || 0) + rate,
        );
        const inboundKey = `${conn.toBuildingId}:${conn.itemId}`;
        suppliedPerInput.set(
          inboundKey,
          (suppliedPerInput.get(inboundKey) || 0) + rate,
        );
      }
    }
  }

  return { consumedPerSource, suppliedPerInput, perConnection };
}

/**
 * Calculates the current transfer rate for each connection.
 *
 * Distributes each source building's actualOutputRate across outbound
 * connectors according to each building's distributionMode.
 */
export function calculateConnectionTransferRates(
  layout: BaseLayout | undefined,
  buildingStates: Map<string, BuildingProductionState>,
): Map<string, ConnectionTransferRate> {
  const result = new Map<string, ConnectionTransferRate>();

  if (!layout || layout.connections.length === 0) {
    return result;
  }

  const buildingInfoMap = new Map<string, BuildingInfo>();
  for (const b of layout.buildings) {
    buildingInfoMap.set(b.id, {
      x: b.x,
      y: b.y,
      distributionMode: b.distributionMode ?? "first-served",
    });
  }

  const { perConnection } = allocateConnectors(
    layout.connections,
    buildingStates,
    buildingInfoMap,
  );

  for (const conn of layout.connections) {
    const railCapacity = RAIL_CAPACITIES[conn.railTier] || 0;
    result.set(conn.id, {
      connectionId: conn.id,
      currentRate: perConnection.get(conn.id) || 0,
      maxRate: railCapacity,
      tierName: `mk${conn.railTier}`,
    });
  }

  return result;
}

/**
 * Gets the rail tier capacity in items per minute
 */
export function getRailCapacity(tier: number): number {
  return RAIL_CAPACITIES[tier] || 0;
}

/**
 * Gets all available rail tiers with their capacities
 */
export function getAvailableRailTiers(): Array<{
  tier: number;
  capacity: number;
}> {
  return [
    { tier: 1, capacity: 120 },
    { tier: 2, capacity: 240 },
    { tier: 3, capacity: 480 },
  ];
}

// ─── Virtual Transfers Mode ───────────────────────────────────────────────────

export interface VirtualEdge {
  id: string; // "virtual_${fromId}_${toId}_${itemId}"
  fromBuildingId: string;
  toBuildingId: string;
  itemId: string;
  rate: number; // Actual flow rate in this mode
  maxRate: number; // What the consumer needs
}

/**
 * For a selected building in virtual mode, compute the implicit connections
 * to/from all buildings that share items with it:
 * - If the selected building produces item X → emit edges TO all consumers of X
 * - If the selected building consumes item Y → emit edges FROM all producers of Y
 */
export function computeVirtualEdges(
  selectedBuildingId: string,
  buildings: BaseLayoutBuilding[],
  buildingStates: Record<string, BuildingProductionState>,
): VirtualEdge[] {
  const selectedState = buildingStates[selectedBuildingId];
  if (!selectedState) return [];

  const edges: VirtualEdge[] = [];

  // Outbound edges: selected building produces item X → consumers of X
  const outputItem = selectedState.outputItemId;
  for (const building of buildings) {
    if (building.id === selectedBuildingId) continue;
    const state = buildingStates[building.id];
    if (!state) continue;
    const inputReq = state.inputRequirements.find(
      (r) => r.itemId === outputItem,
    );
    if (!inputReq) continue;
    edges.push({
      id: `virtual_${selectedBuildingId}_${building.id}_${outputItem}`,
      fromBuildingId: selectedBuildingId,
      toBuildingId: building.id,
      itemId: outputItem,
      rate: inputReq.suppliedRate,
      maxRate: inputReq.requiredRate,
    });
  }

  // Inbound edges: selected building consumes item Y → producers of Y
  for (const inputReq of selectedState.inputRequirements) {
    for (const building of buildings) {
      if (building.id === selectedBuildingId) continue;
      const state = buildingStates[building.id];
      if (!state || state.outputItemId !== inputReq.itemId) continue;
      edges.push({
        id: `virtual_${building.id}_${selectedBuildingId}_${inputReq.itemId}`,
        fromBuildingId: building.id,
        toBuildingId: selectedBuildingId,
        itemId: inputReq.itemId,
        rate: inputReq.suppliedRate,
        maxRate: inputReq.requiredRate,
      });
    }
  }

  return edges;
}

/**
 * Virtual transfer mode balance calculator.
 *
 * All buildings are implicitly connected — items are distributed proportionally
 * from producers to consumers based on global supply vs total demand, with no
 * rail capacity limits.
 *
 * Returns the same LayoutBalanceResult shape as calculateLayoutBalance so all
 * downstream subscriptions work unchanged.
 */
export function calculateVirtualLayoutBalance(
  layout: BaseLayout | undefined,
  buildingsById: BuildingsByIdMap,
): LayoutBalanceResult {
  if (!layout || layout.buildings.length === 0) {
    return { balances: [], buildingStates: new Map() };
  }

  // Phase 1: Build initial production state (identical to physical mode)
  const buildingStates = new Map<string, BuildingProductionState>();

  for (const layoutBuilding of layout.buildings) {
    // Skip disabled buildings — they produce and consume nothing
    if (layoutBuilding.enabled === false) continue;

    const isReceiver =
      layoutBuilding.buildingType === "receiver" ||
      layoutBuilding.buildingId === "package_receiver";
    if (isReceiver) {
      const outputRate = layoutBuilding.receiverOutputRate || 100;
      buildingStates.set(layoutBuilding.id, {
        buildingId: layoutBuilding.id,
        outputItemId: layoutBuilding.itemId,
        maxOutputRate: outputRate,
        actualOutputRate: outputRate,
        consumedOutputRate: 0,
        inputRequirements: [],
        productionFactor: 1,
      });
      continue;
    }

    const isDispatcher =
      layoutBuilding.buildingType === "dispatcher" ||
      layoutBuilding.buildingId === "package_dispatcher";
    if (isDispatcher) {
      const inputRate = layoutBuilding.dispatcherInputRate || 100;
      buildingStates.set(layoutBuilding.id, {
        buildingId: layoutBuilding.id,
        outputItemId: layoutBuilding.itemId,
        maxOutputRate: 0,
        actualOutputRate: 0,
        consumedOutputRate: 0,
        inputRequirements: [
          {
            itemId: layoutBuilding.itemId,
            requiredRate: inputRate,
            suppliedRate: 0,
          },
        ],
        productionFactor: 1,
      });
      continue;
    }

    const building = buildingsById[layoutBuilding.buildingId];
    if (!building || !building.recipes || building.recipes.length === 0)
      continue;

    const recipe = resolveLayoutBuildingRecipe(layoutBuilding, building);
    if (!recipe) continue;

    const hasInputs = recipe.inputs.length > 0;
    const buildingCount = layoutBuilding.count || 1;
    const maxOutputRate = recipe.output.amount_per_minute * buildingCount;

    buildingStates.set(layoutBuilding.id, {
      buildingId: layoutBuilding.id,
      outputItemId: recipe.output.id,
      maxOutputRate,
      actualOutputRate: hasInputs ? 0 : maxOutputRate,
      consumedOutputRate: 0,
      inputRequirements: recipe.inputs.map((input) => ({
        itemId: input.id,
        requiredRate: input.amount_per_minute * buildingCount,
        suppliedRate: 0,
      })),
      productionFactor: hasInputs ? 0 : 1,
    });
  }

  // Phase 2: Iterative proportional distribution
  const MAX_ITERATIONS = 10;
  const CONVERGENCE_THRESHOLD = 0.01;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    let maxChange = 0;

    // Aggregate total production and total demand per item
    const itemTotalProduction = new Map<string, number>();
    const itemTotalDemand = new Map<string, number>();
    for (const state of buildingStates.values()) {
      const prev = itemTotalProduction.get(state.outputItemId) || 0;
      itemTotalProduction.set(
        state.outputItemId,
        prev + state.actualOutputRate,
      );
      for (const req of state.inputRequirements) {
        const d = itemTotalDemand.get(req.itemId) || 0;
        itemTotalDemand.set(req.itemId, d + req.requiredRate);
      }
    }

    // Distribute proportionally: each consumer gets requiredRate * fulfillmentRatio
    for (const [, state] of buildingStates) {
      if (state.inputRequirements.length === 0) continue;

      for (const req of state.inputRequirements) {
        const totalProd = itemTotalProduction.get(req.itemId) || 0;
        const totalDemand = itemTotalDemand.get(req.itemId) || 0;
        const ratio =
          totalDemand > 0 ? Math.min(1, totalProd / totalDemand) : 1;
        req.suppliedRate = req.requiredRate * ratio;
      }

      // Production factor = minimum fulfillment ratio across all inputs
      let minFulfillment = 1;
      for (const req of state.inputRequirements) {
        const ratio =
          req.requiredRate > 0
            ? Math.min(1, req.suppliedRate / req.requiredRate)
            : 1;
        minFulfillment = Math.min(minFulfillment, ratio);
      }

      const oldOutputRate = state.actualOutputRate;
      state.productionFactor = minFulfillment;
      state.actualOutputRate = state.maxOutputRate * minFulfillment;
      maxChange = Math.max(
        maxChange,
        Math.abs(state.actualOutputRate - oldOutputRate),
      );
    }

    if (maxChange < CONVERGENCE_THRESHOLD) break;
  }

  // Phase 3: Compute consumedOutputRate per building.
  // In virtual mode, a producer's consumed output = its contribution to satisfying demand.
  const itemTotalProductionFinal = new Map<string, number>();
  const itemTotalDemandFinal = new Map<string, number>();
  for (const state of buildingStates.values()) {
    const p = itemTotalProductionFinal.get(state.outputItemId) || 0;
    itemTotalProductionFinal.set(
      state.outputItemId,
      p + state.actualOutputRate,
    );
    for (const req of state.inputRequirements) {
      const d = itemTotalDemandFinal.get(req.itemId) || 0;
      itemTotalDemandFinal.set(req.itemId, d + req.requiredRate);
    }
  }

  for (const state of buildingStates.values()) {
    const totalProd = itemTotalProductionFinal.get(state.outputItemId) || 0;
    const totalDemand = itemTotalDemandFinal.get(state.outputItemId) || 0;
    if (totalProd > 0) {
      state.consumedOutputRate =
        state.actualOutputRate * Math.min(1, totalDemand / totalProd);
    } else {
      state.consumedOutputRate = 0;
    }
  }

  // Phase 4: Aggregate balance per item
  const itemProduction = new Map<string, number>();
  const itemDemand = new Map<string, number>();
  const itemTransferredOut = new Map<string, number>();
  const itemTransferredIn = new Map<string, number>();

  for (const state of buildingStates.values()) {
    const outputId = state.outputItemId;
    itemProduction.set(
      outputId,
      (itemProduction.get(outputId) || 0) + state.actualOutputRate,
    );
    itemTransferredOut.set(
      outputId,
      (itemTransferredOut.get(outputId) || 0) + state.consumedOutputRate,
    );
    for (const req of state.inputRequirements) {
      itemDemand.set(
        req.itemId,
        (itemDemand.get(req.itemId) || 0) + req.requiredRate,
      );
      itemTransferredIn.set(
        req.itemId,
        (itemTransferredIn.get(req.itemId) || 0) + req.suppliedRate,
      );
    }
  }

  const allItemIds = new Set([...itemProduction.keys(), ...itemDemand.keys()]);
  const balances: BaseLayoutBalance[] = [];
  for (const itemId of allItemIds) {
    const production = itemProduction.get(itemId) || 0;
    const demand = itemDemand.get(itemId) || 0;
    const transferredOut = itemTransferredOut.get(itemId) || 0;
    const transferredIn = itemTransferredIn.get(itemId) || 0;
    balances.push({
      itemId,
      totalProduction: production,
      totalDemand: demand,
      surplus: Math.max(0, production - transferredOut),
      deficit: Math.max(0, demand - transferredIn),
    });
  }

  balances.sort((a, b) => a.itemId.localeCompare(b.itemId));

  return {
    balances,
    buildingStates: new Map(buildingStates),
    _timestamp: Date.now(),
  };
}
