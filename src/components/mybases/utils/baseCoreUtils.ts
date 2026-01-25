import type { BaseBuilding, Building } from '../../../state/db';

/** Base heat capacity without amplifiers */
const BASE_CORE_HEAT_CAPACITY = 1000;

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
 * Calculate the base core heat capacity.
 * Base capacity is 1000, plus the heat value of any amplifier buildings.
 */
export function calculateBaseCoreHeatCapacity(
  baseBuildings: BaseBuilding[],
  buildings: Building[]
): number {
  let amplifierHeat = 0;

  for (const baseBuilding of baseBuildings) {
    const building = buildings.find(b => b.id === baseBuilding.buildingTypeId);
    if (building && AMPLIFIER_BUILDING_IDS.has(building.id)) {
      amplifierHeat += building.heat || 0;
    }
  }

  return BASE_CORE_HEAT_CAPACITY + amplifierHeat;
}
