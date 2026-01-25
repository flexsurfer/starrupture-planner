import type { Building } from '../../../state/db';
import type { BuildingSectionType } from '../types';

// ============================================================================
// Building Predicates
// These are simple, reusable checks for specific building characteristics.
// ============================================================================

/** Buildings that extract raw resources (no inputs required) */
const EXTRACTOR_IDS = new Set(['ore_excavator', 'sulfur_extractor', 'helium_extractor']);

const isExtractor = (b: Building) => EXTRACTOR_IDS.has(b.id);
const isReceiver = (b: Building) => b.id === 'package_receiver';
const isDispatcher = (b: Building) => b.id === 'orbital_cargo_launcher' || b.id === 'package_dispatcher';
const isStorage = (b: Building) => b.id === 'storage_depot_v1';

// ============================================================================
// Section Classification
// Determines which buildings can be added to each section.
// Storage can appear in both Production and Outputs sections.
// ============================================================================

/**
 * Returns true if a building can be added to the given section.
 * This is used when filtering available buildings in the "Add Building" modal.
 */
export function isBuildingAvailableForSection(building: Building, section: BuildingSectionType): boolean {
  switch (section) {
    case 'inputs':
      // Extractors and receivers bring resources into the base
      return isExtractor(building) || isReceiver(building);

    case 'energy':
      // Generators produce power, amplifiers increase heat capacity
      return building.type === 'generator' || building.type === 'temperature';

    case 'production':
      // Production buildings (except extractors) and storage
      return (building.type === 'production' && !isExtractor(building)) || isStorage(building);

    case 'outputs':
      // Dispatchers send items out, storage can also be used for output staging
      return isDispatcher(building) || isStorage(building);

    case 'infrastructure':
      // Habitat and defense buildings
      return building.type === 'habitat' || building.type === 'defense';

    default:
      return false;
  }
}

/**
 * Returns all buildings that can be added to a specific section.
 */
export function getAvailableBuildingsForSection(allBuildings: Building[],sectionType: BuildingSectionType): Building[] {
  
  return allBuildings.filter(building => isBuildingAvailableForSection(building, sectionType));
}
