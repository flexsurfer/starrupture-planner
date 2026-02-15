import { buildProductionFlow } from '../../planner/core/productionFlowBuilder';
import type { Base, BaseBuilding, Building, Production } from '../../../state/db';

const EPSILON = 0.0001;

interface PlanInputUsage {
    baseBuildingId: string;
    itemId: string;
    requiredPerMinute: number;
}

export interface CalculatedSharedInputShortage {
    baseBuildingId: string;
    itemId: string;
    requiredPerMinute: number;
    availablePerMinute: number;
    missingPerMinute: number;
}

const isLauncherEnabled = (plan: Production): boolean =>
    plan.corporationLevel !== null && plan.corporationLevel !== undefined;

function buildConfiguredInputBuildingsById(base: Base): Map<string, BaseBuilding> {
    const byId = new Map<string, BaseBuilding>();

    for (const baseBuilding of base.buildings) {
        if (baseBuilding.sectionType !== 'inputs') continue;
        if (!baseBuilding.selectedItemId) continue;
        if (!baseBuilding.ratePerMinute || baseBuilding.ratePerMinute <= 0) continue;
        byId.set(baseBuilding.id, baseBuilding);
    }

    return byId;
}

function buildPlanInputUsageByBuildingId(plan: Production, buildings: Building[]): Map<string, PlanInputUsage> {
    if (!plan.selectedItemId) {
        return new Map<string, PlanInputUsage>();
    }

    const validAmount = plan.targetAmount > 0 ? plan.targetAmount : 1;
    const productionFlow = buildProductionFlow(
        {
            targetItemId: plan.selectedItemId,
            targetAmount: validAmount,
            inputBuildings: plan.inputs || [],
            rawProductionDisabled: true,
            includeLauncher: isLauncherEnabled(plan),
        },
        buildings
    );

    const usageByBuildingId = new Map<string, PlanInputUsage>();

    for (const node of productionFlow.nodes) {
        if (node.nodeType !== 'input' || !node.baseBuildingId || !node.outputItem) continue;
        if (!node.outputAmount || node.outputAmount <= 0) continue;

        const requiredPerMinute = node.buildingCount * node.outputAmount;
        if (requiredPerMinute <= EPSILON) continue;

        const existing = usageByBuildingId.get(node.baseBuildingId);
        if (existing) {
            existing.requiredPerMinute += requiredPerMinute;
            continue;
        }

        usageByBuildingId.set(node.baseBuildingId, {
            baseBuildingId: node.baseBuildingId,
            itemId: node.outputItem,
            requiredPerMinute,
        });
    }

    return usageByBuildingId;
}

/**
 * Calculates shared-input shortages for one plan when evaluated together with
 * currently active plans in the same base.
 */
export function calculateSharedInputShortages(
    base: Base,
    sectionId: string,
    buildings: Building[]
): CalculatedSharedInputShortage[] {
    if (!sectionId || !buildings.length) return [];

    const plans = base.productions || [];
    const currentSection = plans.find((plan) => plan.id === sectionId);
    if (!currentSection) return [];

    const plansForCheck = plans.filter((plan) => plan.active || plan.id === sectionId);
    if (plansForCheck.length === 0) return [];

    const baseInputsById = buildConfiguredInputBuildingsById(base);
    if (baseInputsById.size === 0) return [];

    const usageByPlanId = new Map<string, Map<string, PlanInputUsage>>();
    const requiredByInputId = new Map<string, number>();

    for (const plan of plansForCheck) {
        const usage = buildPlanInputUsageByBuildingId(plan, buildings);
        usageByPlanId.set(plan.id, usage);

        usage.forEach((entry, baseBuildingId) => {
            requiredByInputId.set(
                baseBuildingId,
                (requiredByInputId.get(baseBuildingId) || 0) + entry.requiredPerMinute
            );
        });
    }

    const currentUsage = usageByPlanId.get(sectionId);
    if (!currentUsage || currentUsage.size === 0) return [];

    const shortages: CalculatedSharedInputShortage[] = [];

    currentUsage.forEach((entry, baseBuildingId) => {
        const inputBuilding = baseInputsById.get(baseBuildingId);
        if (!inputBuilding) return;

        const availablePerMinute = inputBuilding.ratePerMinute || 0;
        const requiredPerMinute = requiredByInputId.get(baseBuildingId) || 0;
        const missingPerMinute = requiredPerMinute - availablePerMinute;

        if (missingPerMinute <= EPSILON) return;

        shortages.push({
            baseBuildingId,
            itemId: entry.itemId,
            requiredPerMinute,
            availablePerMinute,
            missingPerMinute,
        });
    });

    return shortages.sort((a, b) => {
        if (Math.abs(b.missingPerMinute - a.missingPerMinute) > EPSILON) {
            return b.missingPerMinute - a.missingPerMinute;
        }
        return a.baseBuildingId.localeCompare(b.baseBuildingId);
    });
}
