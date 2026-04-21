import type { Base, BaseBuilding } from '../../../state/db';

export const MAX_BULK_BUILDING_COUNT = 500;

export interface ReconcileBaseBuildingSectionTypeCountOptions {
  base: Base;
  buildingTypeId: string;
  sectionType: string;
  targetCount: number;
  createId: () => string;
}

export function sanitizeBuildingCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(MAX_BULK_BUILDING_COUNT, Math.max(0, Math.floor(value)));
}

export function sanitizeBulkBuildingCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(MAX_BULK_BUILDING_COUNT, Math.max(1, Math.floor(value)));
}

export function reconcileBaseBuildingSectionTypeCount({
  base,
  buildingTypeId,
  sectionType,
  targetCount,
  createId,
}: ReconcileBaseBuildingSectionTypeCountOptions): BaseBuilding[] {
  const sanitizedTargetCount = sanitizeBuildingCount(targetCount);
  const matchingBuildings = base.buildings.filter((building) => (
    building.buildingTypeId === buildingTypeId &&
    building.sectionType === sectionType
  ));
  const currentCount = matchingBuildings.length;

  if (sanitizedTargetCount === currentCount) {
    return base.buildings;
  }

  if (sanitizedTargetCount > currentCount) {
    const newBuildings = Array.from({ length: sanitizedTargetCount - currentCount }, (): BaseBuilding => ({
      id: createId(),
      buildingTypeId,
      sectionType,
    }));

    return [...base.buildings, ...newBuildings];
  }

  const removableIds = new Set(
    matchingBuildings
      .slice(sanitizedTargetCount)
      .map((building) => building.id)
  );

  return base.buildings.filter((building) => !removableIds.has(building.id));
}
