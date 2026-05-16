import { buildProductionFlow } from '../../planner/core/productionFlowBuilder';
import type { Base, BaseBuilding, Building, Production } from '../../../state/db';
import {
    buildBasesById,
    getFlowInputBuildings,
    getInputAvailabilityKey,
    resolveInputBuilding,
} from '../../../utils/productionPlanInputs';

const EPSILON = 0.0001;

interface PlanInputUsage {
    baseBuildingId: string;
    sourceKey: string;
    itemId: string;
    requiredPerMinute: number;
    availablePerMinute: number;
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

function getPlanKey(baseId: string, planId: string): string {
    return `${baseId}:${planId}`;
}

function resolveInputAvailability(
    input: BaseBuilding,
    planBase: Base,
    allBases: Map<string, Base>
): { sourceKey: string; itemId: string; availablePerMinute: number } | null {
    if (input.linkedOutput) {
        const resolvedInput = resolveInputBuilding(input, allBases);
        if (resolvedInput.linkedOutputStatus !== 'ok') return null;
        if (!resolvedInput.selectedItemId || !resolvedInput.ratePerMinute || resolvedInput.ratePerMinute <= 0) return null;

        return {
            sourceKey: getInputAvailabilityKey(input, planBase.id),
            itemId: resolvedInput.selectedItemId,
            availablePerMinute: resolvedInput.ratePerMinute,
        };
    }

    const currentInput = planBase.buildings.find((building) => building.id === input.id);
    if (!currentInput || currentInput.sectionType !== 'inputs') return null;
    if (!currentInput.selectedItemId) return null;
    if (currentInput.selectedItemId !== input.selectedItemId) return null;
    if (!currentInput.ratePerMinute || currentInput.ratePerMinute <= 0) return null;

    return {
        sourceKey: getInputAvailabilityKey(input, planBase.id),
        itemId: currentInput.selectedItemId,
        availablePerMinute: currentInput.ratePerMinute,
    };
}

function buildPlanInputUsageByBuildingId(
    planBase: Base,
    plan: Production,
    buildings: Building[],
    allBases: Map<string, Base>
): Map<string, PlanInputUsage> {
    if (!plan.selectedItemId) {
        return new Map<string, PlanInputUsage>();
    }

    const validAmount = plan.targetAmount > 0 ? plan.targetAmount : 1;
    const inputSnapshots = plan.inputs || [];
    const inputSnapshotsById = new Map(inputSnapshots.map((input) => [input.id, input]));
    const productionFlow = buildProductionFlow(
        {
            targetItemId: plan.selectedItemId,
            targetAmount: validAmount,
            inputBuildings: getFlowInputBuildings(inputSnapshots, allBases),
            rawProductionDisabled: true,
            includeLauncher: isLauncherEnabled(plan),
            recipeSelections: plan.recipeSelections || {},
        },
        buildings
    );

    const usageByBuildingId = new Map<string, PlanInputUsage>();

    for (const node of productionFlow.nodes) {
        if (node.nodeType !== 'input' || !node.baseBuildingId || !node.outputItem) continue;
        if (!node.outputAmount || node.outputAmount <= 0) continue;

        const requiredPerMinute = node.buildingCount * node.outputAmount;
        if (requiredPerMinute <= EPSILON) continue;
        const inputSnapshot = inputSnapshotsById.get(node.baseBuildingId);
        if (!inputSnapshot) continue;
        const availability = resolveInputAvailability(inputSnapshot, planBase, allBases);
        if (!availability) continue;

        const existing = usageByBuildingId.get(node.baseBuildingId);
        if (existing) {
            existing.requiredPerMinute += requiredPerMinute;
            continue;
        }

        usageByBuildingId.set(node.baseBuildingId, {
            baseBuildingId: node.baseBuildingId,
            sourceKey: availability.sourceKey,
            itemId: node.outputItem,
            requiredPerMinute,
            availablePerMinute: availability.availablePerMinute,
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
    buildings: Building[],
    allBases: Base[] = [base]
): CalculatedSharedInputShortage[] {
    if (!sectionId || !buildings.length) return [];

    const plans = base.productions || [];
    const currentSection = plans.find((plan) => plan.id === sectionId);
    if (!currentSection) return [];

    const basesForCheck = allBases.length > 0 ? allBases : [base];
    const basesById = buildBasesById(basesForCheck);
    const planEntriesForCheck = basesForCheck.flatMap((candidateBase) =>
        (candidateBase.productions || [])
            .filter((plan) => plan.active || (candidateBase.id === base.id && plan.id === sectionId))
            .map((plan) => ({ base: candidateBase, plan }))
    );
    if (planEntriesForCheck.length === 0) return [];

    const usageByPlanId = new Map<string, Map<string, PlanInputUsage>>();
    const requiredBySourceKey = new Map<string, number>();
    const availableBySourceKey = new Map<string, number>();

    for (const entry of planEntriesForCheck) {
        const usage = buildPlanInputUsageByBuildingId(entry.base, entry.plan, buildings, basesById);
        usageByPlanId.set(getPlanKey(entry.base.id, entry.plan.id), usage);

        usage.forEach((usageEntry) => {
            requiredBySourceKey.set(
                usageEntry.sourceKey,
                (requiredBySourceKey.get(usageEntry.sourceKey) || 0) + usageEntry.requiredPerMinute
            );
            if (!availableBySourceKey.has(usageEntry.sourceKey)) {
                availableBySourceKey.set(usageEntry.sourceKey, usageEntry.availablePerMinute);
            }
        });
    }

    const currentUsage = usageByPlanId.get(getPlanKey(base.id, sectionId));
    if (!currentUsage || currentUsage.size === 0) return [];

    const shortages: CalculatedSharedInputShortage[] = [];

    currentUsage.forEach((entry, baseBuildingId) => {
        const availablePerMinute = availableBySourceKey.get(entry.sourceKey) ?? entry.availablePerMinute;
        const requiredPerMinute = requiredBySourceKey.get(entry.sourceKey) || 0;
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
