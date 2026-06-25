import type { Base, BaseBuilding, OutputAllocationMode, Production } from '../state/db';
import {
    ORBITAL_CARGO_LAUNCHER_BUILDING_ID,
    PACKAGE_DISPATCHER_BUILDING_ID,
} from '../constants/buildingIds';

export const PACKAGE_DISPATCHER_CAPACITY_PER_MINUTE = 200;
export const ORBITAL_CARGO_LAUNCHER_CAPACITY_PER_MINUTE = 10;

export type OutputResolutionStatus =
    | 'manual'
    | 'allocated'
    | 'missing-plan'
    | 'unconfigured-output';

export interface ResolvedOutputBuilding extends BaseBuilding {
    outputResolutionStatus: OutputResolutionStatus;
    sourceProduction?: Production;
    producedRatePerMinute?: number;
    requestedRatePerMinuteResolved?: number;
    effectiveRatePerMinute?: number;
    capacityPerMinuteResolved?: number;
    remainingRatePerMinute?: number;
    isOverCapacity?: boolean;
    isUnderSupplied?: boolean;
}

function isPositiveNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function getDefaultOutputCapacityPerMinute(buildingTypeId: string): number | undefined {
    if (buildingTypeId === PACKAGE_DISPATCHER_BUILDING_ID) {
        return PACKAGE_DISPATCHER_CAPACITY_PER_MINUTE;
    }

    if (buildingTypeId === ORBITAL_CARGO_LAUNCHER_BUILDING_ID) {
        return ORBITAL_CARGO_LAUNCHER_CAPACITY_PER_MINUTE;
    }

    return undefined;
}

export function resolveOutputCapacityPerMinute(output: BaseBuilding): number | undefined {
    if (isPositiveNumber(output.capacityPerMinute)) {
        return output.capacityPerMinute;
    }

    return getDefaultOutputCapacityPerMinute(output.buildingTypeId);
}

function getAllocationMode(output: BaseBuilding): OutputAllocationMode {
    return output.allocationMode === 'fixed' ? 'fixed' : 'auto';
}

function getPlanLinkedOutputs(base: Base, planId: string): BaseBuilding[] {
    return base.buildings
        .filter((building) =>
            building.sectionType === 'outputs' &&
            building.sourceProductionId === planId
        )
        .sort((left, right) => {
            const leftPriority = Number.isFinite(left.priority) ? left.priority! : Number.MAX_SAFE_INTEGER;
            const rightPriority = Number.isFinite(right.priority) ? right.priority! : Number.MAX_SAFE_INTEGER;
            if (leftPriority !== rightPriority) return leftPriority - rightPriority;

            return base.buildings.indexOf(left) - base.buildings.indexOf(right);
        });
}

function resolveRequestedRate(output: BaseBuilding, remaining: number): number {
    const capacity = resolveOutputCapacityPerMinute(output);
    const mode = getAllocationMode(output);

    if (mode === 'fixed' && isPositiveNumber(output.requestedRatePerMinute)) {
        return output.requestedRatePerMinute;
    }

    if (isPositiveNumber(capacity)) {
        return capacity;
    }

    return remaining;
}

export function resolveOutputBuilding(output: BaseBuilding, sourceBase: Base | undefined): ResolvedOutputBuilding {
    if (!output.sourceProductionId) {
        return {
            ...output,
            outputResolutionStatus: output.selectedItemId && isPositiveNumber(output.ratePerMinute)
                ? 'manual'
                : 'unconfigured-output',
            effectiveRatePerMinute: output.ratePerMinute,
            capacityPerMinuteResolved: resolveOutputCapacityPerMinute(output),
        };
    }

    const sourceProduction = sourceBase?.productions.find((plan) => plan.id === output.sourceProductionId);
    if (!sourceBase || !sourceProduction) {
        return {
            ...output,
            outputResolutionStatus: 'missing-plan',
            capacityPerMinuteResolved: resolveOutputCapacityPerMinute(output),
        };
    }

    const producedRatePerMinute = sourceProduction.targetAmount > 0 ? sourceProduction.targetAmount : 0;
    let remaining = producedRatePerMinute;

    for (const candidate of getPlanLinkedOutputs(sourceBase, sourceProduction.id)) {
        const requested = resolveRequestedRate(candidate, remaining);
        const capacity = resolveOutputCapacityPerMinute(candidate);
        const capacityLimit = isPositiveNumber(capacity) ? capacity : Number.POSITIVE_INFINITY;
        const effective = Math.max(0, Math.min(requested, capacityLimit, remaining));
        const remainingAfter = Math.max(0, remaining - effective);

        if (candidate.id === output.id) {
            return {
                ...output,
                selectedItemId: sourceProduction.selectedItemId,
                ratePerMinute: effective,
                outputResolutionStatus: 'allocated',
                sourceProduction,
                producedRatePerMinute,
                requestedRatePerMinuteResolved: requested,
                effectiveRatePerMinute: effective,
                capacityPerMinuteResolved: isPositiveNumber(capacity) ? capacity : undefined,
                remainingRatePerMinute: remainingAfter,
                isOverCapacity: isPositiveNumber(capacity) && requested > capacity,
                isUnderSupplied: effective < Math.min(requested, capacityLimit),
            };
        }

        remaining = remainingAfter;
    }

    return {
        ...output,
        outputResolutionStatus: 'missing-plan',
        capacityPerMinuteResolved: resolveOutputCapacityPerMinute(output),
    };
}

export function getPlanOutputAllocationSummary(base: Base, planId: string): {
    producedRatePerMinute: number;
    assignedRatePerMinute: number;
    remainingRatePerMinute: number;
    outputs: ResolvedOutputBuilding[];
} | null {
    const plan = base.productions.find((candidate) => candidate.id === planId);
    if (!plan) return null;

    const outputs = getPlanLinkedOutputs(base, planId).map((output) => resolveOutputBuilding(output, base));
    const assignedRatePerMinute = outputs.reduce((sum, output) => sum + (output.effectiveRatePerMinute || 0), 0);
    const producedRatePerMinute = plan.targetAmount > 0 ? plan.targetAmount : 0;

    return {
        producedRatePerMinute,
        assignedRatePerMinute,
        remainingRatePerMinute: Math.max(0, producedRatePerMinute - assignedRatePerMinute),
        outputs,
    };
}
