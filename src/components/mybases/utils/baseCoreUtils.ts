import type { BaseBuilding, BuildingsByIdMap } from '../../../state/db';

/** Default base core heat capacity when no building data is available */
const DEFAULT_BASE_CORE_HEAT_CAPACITY = 1000;

/** The building ID for the base core */
const BASE_CORE_BUILDING_ID = 'base_core';

/** Building IDs for core amplifiers that increase heat capacity */
const AMPLIFIER_BUILDING_IDS = new Set([
  'base_core_amplifier_v1',
  'base_core_amplifier_v2',
]);

/**
 * Check if a building is a base core amplifier.
 */
export function isAmplifierBuilding(buildingId: string): boolean {
  return AMPLIFIER_BUILDING_IDS.has(buildingId);
}

/**
 * Get the base core heat capacity for a given core level from building data.
 * Falls back to DEFAULT_BASE_CORE_HEAT_CAPACITY if building data is not found.
 */
export function getCoreLevelHeatCapacity(
  coreLevel: number,
  buildingsById: BuildingsByIdMap
): number {
  const coreBuilding = buildingsById[BASE_CORE_BUILDING_ID];
  if (coreBuilding?.levels) {
    const levelData = coreBuilding.levels.find(l => l.level === coreLevel);
    if (levelData) {
      return levelData.heatCapacity;
    }
  }
  return DEFAULT_BASE_CORE_HEAT_CAPACITY;
}

/**
 * Get the available core levels from building data.
 * Returns an array of { level, heatCapacity } objects.
 */
export function getCoreLevels(
  buildingsById: BuildingsByIdMap
): { level: number; heatCapacity: number }[] {
  const coreBuilding = buildingsById[BASE_CORE_BUILDING_ID];
  if (coreBuilding?.levels) {
    return coreBuilding.levels;
  }
  return [{ level: 0, heatCapacity: DEFAULT_BASE_CORE_HEAT_CAPACITY }];
}

/**
 * Calculate the base core heat capacity.
 * Base capacity comes from the core level, plus the coreHeatCapacity value of any amplifier buildings.
 */
export function calculateBaseCoreHeatCapacity(
  coreLevel: number,
  baseBuildings: BaseBuilding[],
  buildingsById: BuildingsByIdMap
): number {
  const baseLevelCapacity = getCoreLevelHeatCapacity(coreLevel, buildingsById);

  let amplifierHeat = 0;

  for (const baseBuilding of baseBuildings) {
    const building = buildingsById[baseBuilding.buildingTypeId];
    if (building && AMPLIFIER_BUILDING_IDS.has(building.id)) {
      amplifierHeat += building.coreHeatCapacity || 0;
    }
  }

  return baseLevelCapacity + amplifierHeat;
}
