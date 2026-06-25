/**
 * MyBases Utilities
 *
 * Utility functions for building section management and base core calculations
 */

export {
  isBuildingCountAvailable,
  isBuildingAvailableForSection,
  getAvailableBuildingsForSection,
  getSectionTypeForBuilding,
  isLogisticsExcludedOutputBuildingId,
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
  reconcileBaseBuildingSectionTypeCount,
} from './baseBuildingCounts';

export {
  LOGISTICS_DEFAULT_OUTPUT_BUILDING_ID,
  LOGISTICS_DEFAULT_INPUT_BUILDING_ID,
  PACKAGE_DISPATCHER_CAPACITY_PER_MINUTE,
  buildAllBaseLogisticsViewModels,
  buildBaseLogisticsViewModel,
  getLogisticsOutputCapacityPerMinute,
  isLogisticsInput,
  isLogisticsOutput,
} from './logistics';
