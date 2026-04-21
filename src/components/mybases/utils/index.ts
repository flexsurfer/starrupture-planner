/**
 * MyBases Utilities
 *
 * Utility functions for building section management and base core calculations
 */

export {
  isBuildingAvailableForSection,
  getAvailableBuildingsForSection,
  getSectionTypeForBuilding,
  isRawExtractor,
} from './buildingSectionUtils';

export {
  isAmplifierBuilding,
  calculateBaseCoreHeatCapacity,
} from './baseCoreUtils';

export {
  buildActivePlanOccupancy,
} from './activePlanOccupancy';

export {
  calculateSharedInputShortages,
} from './sharedInputShortages';

export {
  MAX_BULK_BUILDING_COUNT,
  sanitizeBuildingCount,
  sanitizeBulkBuildingCount,
  getPreferredSectionTypeForBuildingType,
  reconcileBaseBuildingTypeCount,
} from './baseBuildingCounts';
