import type { Base, BaseBuilding } from '../../../state/db';

export const MAX_BULK_BUILDING_COUNT = 500;

export interface ReconcileBaseBuildingTypeCountOptions {
  base: Base;
  buildingTypeId: string;
  targetCount: number;
  preferredSectionType: string;
  createId: () => string;
}

export function sanitizeBuildingCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

export function sanitizeBulkBuildingCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(MAX_BULK_BUILDING_COUNT, Math.max(1, Math.floor(value)));
}

export function getPreferredSectionTypeForBuildingType(
  base: Base,
  buildingTypeId: string,
  fallbackSectionType: string
): string {
  const sectionCounts = new Map<string, number>();

  for (const building of base.buildings) {
    if (building.buildingTypeId !== buildingTypeId) continue;
    sectionCounts.set(building.sectionType, (sectionCounts.get(building.sectionType) || 0) + 1);
  }

  let preferredSectionType = fallbackSectionType;
  let preferredCount = sectionCounts.get(fallbackSectionType) || 0;

  sectionCounts.forEach((count, sectionType) => {
    if (count > preferredCount) {
      preferredSectionType = sectionType;
      preferredCount = count;
    }
  });

  return preferredSectionType;
}

function buildProtectedPlanInputIds(base: Base): Set<string> {
  const protectedIds = new Set<string>();

  for (const plan of base.productions || []) {
    for (const inputBuilding of plan.inputs || []) {
      if (inputBuilding.id) {
        protectedIds.add(inputBuilding.id);
      }
    }
  }

  return protectedIds;
}

function getRemovalPriority(
  building: BaseBuilding,
  protectedPlanInputIds: Set<string>,
  preferredSectionType: string
): number {
  let priority = 0;

  if (protectedPlanInputIds.has(building.id)) {
    priority += 100;
  }
  if (building.selectedItemId) {
    priority += 30;
  }
  if (building.ratePerMinute && building.ratePerMinute > 0) {
    priority += 15;
  }
  if (building.name?.trim()) {
    priority += 8;
  }
  if (building.description?.trim()) {
    priority += 5;
  }
  if (building.sectionType === preferredSectionType) {
    priority += 2;
  }

  return priority;
}

export function reconcileBaseBuildingTypeCount({
  base,
  buildingTypeId,
  targetCount,
  preferredSectionType,
  createId,
}: ReconcileBaseBuildingTypeCountOptions): BaseBuilding[] {
  const sanitizedTargetCount = sanitizeBuildingCount(targetCount);
  const matchingBuildings = base.buildings.filter((building) => building.buildingTypeId === buildingTypeId);
  const currentCount = matchingBuildings.length;

  if (sanitizedTargetCount === currentCount) {
    return base.buildings;
  }

  if (sanitizedTargetCount > currentCount) {
    const newBuildings = Array.from({ length: sanitizedTargetCount - currentCount }, (): BaseBuilding => ({
      id: createId(),
      buildingTypeId,
      sectionType: preferredSectionType,
    }));

    return [...base.buildings, ...newBuildings];
  }

  const protectedPlanInputIds = buildProtectedPlanInputIds(base);
  const removableIds = new Set(
    matchingBuildings
      .slice()
      .sort((left, right) => {
        const leftPriority = getRemovalPriority(left, protectedPlanInputIds, preferredSectionType);
        const rightPriority = getRemovalPriority(right, protectedPlanInputIds, preferredSectionType);
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }
        return left.id.localeCompare(right.id);
      })
      .slice(0, currentCount - sanitizedTargetCount)
      .map((building) => building.id)
  );

  return base.buildings.filter((building) => !removableIds.has(building.id));
}
