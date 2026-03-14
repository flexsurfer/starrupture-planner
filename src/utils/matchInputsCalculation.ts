import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import type { BaseBuilding, Building } from '../state/db';

export interface MatchInputsParams {
    selectedItemId: string;
    inputBuildings: BaseBuilding[];
    buildings: Building[];
    includeLauncher: boolean;
}

/**
 * Calculates the max target amount achievable from the given input buildings
 * by binary-searching the production flow for the tipping point where input
 * capacity is exceeded. Accounts for the full multi-level recipe chain.
 */
export function calculateMaxTargetFromInputs(params: MatchInputsParams): number | null {
    const { selectedItemId, inputBuildings, buildings, includeLauncher } = params;
    if (!selectedItemId || inputBuildings.length === 0) return null;

    const flowParams = {
        targetItemId: selectedItemId,
        inputBuildings,
        rawProductionDisabled: true,
        includeLauncher,
    };

    const probeFlow = buildProductionFlow({ ...flowParams, targetAmount: 1 }, buildings);
    if (!probeFlow.nodes.some(n => n.nodeType === 'input')) return null;

    const T_BASE = 0.001;
    const baselineFlow = buildProductionFlow({ ...flowParams, targetAmount: T_BASE }, buildings);
    const baselineRequiredByItem = new Map<string, number>();
    for (const d of baselineFlow.rawMaterialDeficits || []) {
        baselineRequiredByItem.set(d.itemId, d.required);
    }

    const EPS = 0.0001;
    const overCapacityCache = new Map<number, boolean>();
    const isOverCapacity = (T: number): boolean => {
        const cached = overCapacityCache.get(T);
        if (cached !== undefined) return cached;

        const flow = buildProductionFlow({ ...flowParams, targetAmount: T }, buildings);
        for (const d of flow.rawMaterialDeficits || []) {
            if (d.missing <= EPS) continue;
            if (d.available > 0) {
                overCapacityCache.set(T, true);
                return true;
            }

            const baseline = baselineRequiredByItem.get(d.itemId);
            if (baseline === undefined) {
                overCapacityCache.set(T, true);
                return true;
            }

            const expectedRequired = baseline * (T / T_BASE);
            if (d.required > expectedRequired * 1.001 + EPS) {
                overCapacityCache.set(T, true);
                return true;
            }
        }
        overCapacityCache.set(T, false);
        return false;
    };

    if (isOverCapacity(T_BASE)) return null;

    let low = T_BASE;
    let high = 1;
    const MAX_TARGET_SEARCH = 1e6;
    let highOverCapacity = isOverCapacity(high);

    while (!highOverCapacity && high < MAX_TARGET_SEARCH) {
        low = high;
        high = Math.min(high * 2, MAX_TARGET_SEARCH);
        highOverCapacity = isOverCapacity(high);
    }

    if (!highOverCapacity) return null;

    const SEARCH_PRECISION = 0.005; // Enough for 2-decimal output.
    const MAX_BINARY_STEPS = 28;
    for (let i = 0; i < MAX_BINARY_STEPS; i++) {
        if (high - low <= SEARCH_PRECISION) break;
        const mid = (low + high) / 2;
        if (isOverCapacity(mid)) {
            high = mid;
        } else {
            low = mid;
        }
    }

    const rounded = Math.round(low * 100) / 100;
    const result = !isOverCapacity(rounded) ? rounded : Math.floor(low * 100) / 100;
    return result > 0 ? result : null;
}
