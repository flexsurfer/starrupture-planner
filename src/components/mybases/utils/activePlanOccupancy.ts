import type { Base, BaseBuilding } from '../../../state/db';

export interface ActivePlanOccupancyOptions {
    excludePlanId?: string | null;
}

export interface ActivePlanOccupancy {
    assignedPlanBuildingIds: Map<string, Set<string>>;
    occupiedBuildingIds: Set<string>;
    occupiedBuildingTypeCounts: Map<string, number>;
}

function buildPrioritizedBuildingsByType(base: Base): Map<string, BaseBuilding[]> {
    const withItemByType = new Map<string, BaseBuilding[]>();
    const withoutItemByType = new Map<string, BaseBuilding[]>();

    for (const baseBuilding of base.buildings) {
        if (baseBuilding.selectedItemId !== undefined) {
            const list = withItemByType.get(baseBuilding.buildingTypeId) || [];
            list.push(baseBuilding);
            withItemByType.set(baseBuilding.buildingTypeId, list);
        } else {
            const list = withoutItemByType.get(baseBuilding.buildingTypeId) || [];
            list.push(baseBuilding);
            withoutItemByType.set(baseBuilding.buildingTypeId, list);
        }
    }

    const prioritizedByType = new Map<string, BaseBuilding[]>();
    const allBuildingTypeIds = new Set<string>([
        ...withItemByType.keys(),
        ...withoutItemByType.keys(),
    ]);

    for (const buildingTypeId of allBuildingTypeIds) {
        prioritizedByType.set(buildingTypeId, [
            ...(withItemByType.get(buildingTypeId) || []),
            ...(withoutItemByType.get(buildingTypeId) || []),
        ]);
    }

    return prioritizedByType;
}

/**
 * Assigns concrete production buildings to active plans.
 * Earlier active plans reserve unique buildings first; later plans
 * overlap only when there are not enough free buildings.
 */
export function buildActivePlanOccupancy(
    base: Base,
    options: ActivePlanOccupancyOptions = {}
): ActivePlanOccupancy {
    const assignedPlanBuildingIds = new Map<string, Set<string>>();
    const occupiedBuildingIds = new Set<string>();
    const occupiedBuildingTypeCounts = new Map<string, number>();

    if (base.buildings.length === 0 || !base.productions || base.productions.length === 0) {
        return {
            assignedPlanBuildingIds,
            occupiedBuildingIds,
            occupiedBuildingTypeCounts,
        };
    }

    const baseBuildingsById = new Map<string, BaseBuilding>(base.buildings.map((b) => [b.id, b]));
    const availableBuildingsByType = buildPrioritizedBuildingsByType(base);

    const activePlans = base.productions.filter((plan) =>
        plan.active && plan.id !== options.excludePlanId
    );

    const assignUniqueBuilding = (planId: string, buildingId: string): boolean => {
        if (!buildingId || occupiedBuildingIds.has(buildingId)) {
            return false;
        }

        const baseBuilding = baseBuildingsById.get(buildingId);
        if (!baseBuilding) {
            return false;
        }

        let planAssignments = assignedPlanBuildingIds.get(planId);
        if (!planAssignments) {
            planAssignments = new Set<string>();
            assignedPlanBuildingIds.set(planId, planAssignments);
        }

        planAssignments.add(buildingId);
        occupiedBuildingIds.add(buildingId);

        const buildingTypeCount = occupiedBuildingTypeCounts.get(baseBuilding.buildingTypeId) || 0;
        occupiedBuildingTypeCounts.set(baseBuilding.buildingTypeId, buildingTypeCount + 1);

        return true;
    };

    for (const plan of activePlans) {
        if (!assignedPlanBuildingIds.has(plan.id)) {
            assignedPlanBuildingIds.set(plan.id, new Set<string>());
        }

        for (const { buildingId, count } of plan.requiredBuildings || []) {
            if (!buildingId || count <= 0) continue;

            const available = availableBuildingsByType.get(buildingId) || [];
            const planAssignments = assignedPlanBuildingIds.get(plan.id)!;

            let uniquelyAssignedCount = 0;
            for (const candidate of available) {
                if (uniquelyAssignedCount >= count) break;
                if (assignUniqueBuilding(plan.id, candidate.id)) {
                    uniquelyAssignedCount += 1;
                }
            }

            // Not enough free buildings: overlap on already-used buildings.
            if (uniquelyAssignedCount < count) {
                for (const candidate of available) {
                    if (uniquelyAssignedCount >= count) break;
                    if (!planAssignments.has(candidate.id)) {
                        planAssignments.add(candidate.id);
                    }
                    uniquelyAssignedCount += 1;
                }
            }
        }
    }

    return {
        assignedPlanBuildingIds,
        occupiedBuildingIds,
        occupiedBuildingTypeCounts,
    };
}
