import type {
  Base,
  BaseBuilding,
  Building,
  BuildingsByIdMap,
  Item,
} from '../../../state/db';
import {
  resolveInputBuilding,
  resolveLinkedOutput,
} from '../../../utils/productionPlanInputs';
import {
  PACKAGE_DISPATCHER_CAPACITY_PER_MINUTE,
  resolveOutputBuilding,
  resolveOutputCapacityPerMinute,
} from '../../../utils/planOutputAllocations';
import type {
  BaseLogisticsViewModel,
  LogisticsIncomingInput,
  LogisticsInputLink,
  LogisticsOutput,
} from '../types';
import {
  PACKAGE_DISPATCHER_BUILDING_ID,
  PACKAGE_RECEIVER_BUILDING_ID,
} from '../../../constants/buildingIds';
import {
  isLogisticsExcludedOutputBuildingId,
  isRawExtractor,
} from './buildingSectionUtils';

export const LOGISTICS_DEFAULT_OUTPUT_BUILDING_ID = PACKAGE_DISPATCHER_BUILDING_ID;
export const LOGISTICS_DEFAULT_INPUT_BUILDING_ID = PACKAGE_RECEIVER_BUILDING_ID;
export { PACKAGE_DISPATCHER_CAPACITY_PER_MINUTE };

const formatFallbackName = (building: BaseBuilding): string => building.name || building.buildingTypeId;

export function isLogisticsOutput(baseBuilding: BaseBuilding): boolean {
  return baseBuilding.sectionType === 'outputs'
    && !isLogisticsExcludedOutputBuildingId(baseBuilding.buildingTypeId);
}

export function isLogisticsInput(baseBuilding: BaseBuilding, buildingsById: BuildingsByIdMap): boolean {
  if (baseBuilding.sectionType !== 'inputs') return false;

  const building = buildingsById[baseBuilding.buildingTypeId];
  if (!building) return false;

  return !isRawExtractor(building as Building);
}

export function getLogisticsOutputCapacityPerMinute(baseBuilding: BaseBuilding): number | undefined {
  return resolveOutputCapacityPerMinute(baseBuilding);
}

function getItemName(itemsById: Record<string, Item>, itemId: string | undefined): string | undefined {
  if (!itemId) return undefined;
  return itemsById[itemId]?.name || itemId;
}

function buildInputLink(
  base: Base,
  input: BaseBuilding,
  buildingsById: BuildingsByIdMap,
  itemsById: Record<string, Item>,
  allBases: Base[]
): LogisticsInputLink {
  const resolved = resolveInputBuilding(input, allBases);
  const building = buildingsById[input.buildingTypeId];
  const itemId = resolved.selectedItemId ?? input.linkedOutput?.itemIdSnapshot;
  const ratePerMinute = resolved.ratePerMinute ?? input.linkedOutput?.ratePerMinuteSnapshot;

  return {
    baseId: base.id,
    baseName: base.name,
    baseBuildingId: input.id,
    buildingTypeId: input.buildingTypeId,
    buildingName: building?.name || input.buildingTypeId,
    name: input.name || building?.name || formatFallbackName(input),
    itemId,
    itemName: getItemName(itemsById, itemId),
    ratePerMinute,
    linkedOutputStatus: resolved.linkedOutputStatus,
  };
}

function buildIncomingInput(
  base: Base,
  input: BaseBuilding,
  buildingsById: BuildingsByIdMap,
  itemsById: Record<string, Item>,
  allBases: Base[]
): LogisticsIncomingInput {
  const link = buildInputLink(base, input, buildingsById, itemsById, allBases);
  const resolution = input.linkedOutput ? resolveLinkedOutput(input, allBases) : null;
  const sourceOutputBuilding = resolution?.sourceOutput
    ? buildingsById[resolution.sourceOutput.buildingTypeId]
    : null;

  return {
    ...link,
    sourceBaseId: input.linkedOutput?.baseId,
    sourceBaseName: resolution?.sourceBase?.name,
    sourceOutputBuildingId: input.linkedOutput?.buildingId,
    sourceOutputName:
      resolution?.sourceOutput?.name ||
      sourceOutputBuilding?.name ||
      input.linkedOutput?.buildingId,
  };
}

function getOutputLinkedInputs(
  sourceBaseId: string,
  outputId: string,
  allBases: Base[],
  buildingsById: BuildingsByIdMap,
  itemsById: Record<string, Item>
): LogisticsInputLink[] {
  const inputs: LogisticsInputLink[] = [];

  for (const base of allBases) {
    for (const building of base.buildings) {
      if (!isLogisticsInput(building, buildingsById)) continue;
      if (building.linkedOutput?.baseId !== sourceBaseId) continue;
      if (building.linkedOutput?.buildingId !== outputId) continue;

      inputs.push(buildInputLink(base, building, buildingsById, itemsById, allBases));
    }
  }

  return inputs.sort((left, right) => {
    const baseDelta = left.baseName.localeCompare(right.baseName);
    if (baseDelta !== 0) return baseDelta;
    return left.name.localeCompare(right.name);
  });
}

function buildOutputs(
  selectedBase: Base,
  allBases: Base[],
  buildingsById: BuildingsByIdMap,
  itemsById: Record<string, Item>
): LogisticsOutput[] {
  return selectedBase.buildings
    .filter(isLogisticsOutput)
    .map((output) => {
      const resolvedOutput = resolveOutputBuilding(output, selectedBase);
      const building = buildingsById[output.buildingTypeId];
      const itemId = resolvedOutput.selectedItemId;
      const ratePerMinute = resolvedOutput.ratePerMinute ?? 0;
      const capacityPerMinute = getLogisticsOutputCapacityPerMinute(output);

      return {
        baseBuildingId: output.id,
        buildingTypeId: output.buildingTypeId,
        buildingName: building?.name || output.buildingTypeId,
        name: output.name || building?.name || formatFallbackName(output),
        itemId,
        itemName: getItemName(itemsById, itemId),
        ratePerMinute,
        capacityPerMinute,
        availableCapacityPerMinute: capacityPerMinute == null
          ? undefined
          : Math.max(0, capacityPerMinute - ratePerMinute),
        linkedInputs: getOutputLinkedInputs(selectedBase.id, output.id, allBases, buildingsById, itemsById),
      };
    });
}

function buildIncomingInputs(
  selectedBase: Base,
  allBases: Base[],
  buildingsById: BuildingsByIdMap,
  itemsById: Record<string, Item>
): LogisticsIncomingInput[] {
  return selectedBase.buildings
    .filter((input) => isLogisticsInput(input, buildingsById))
    .map((input) => buildIncomingInput(selectedBase, input, buildingsById, itemsById, allBases))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildBaseLogisticsViewModel(params: {
  selectedBaseId: string;
  bases: Base[];
  buildingsById: BuildingsByIdMap;
  itemsById: Record<string, Item>;
}): BaseLogisticsViewModel | null {
  const { selectedBaseId, bases, buildingsById, itemsById } = params;
  const selectedBase = bases.find((base) => base.id === selectedBaseId);
  if (!selectedBase) return null;

  return {
    baseId: selectedBase.id,
    baseName: selectedBase.name,
    outputs: buildOutputs(selectedBase, bases, buildingsById, itemsById),
    incomingInputs: buildIncomingInputs(selectedBase, bases, buildingsById, itemsById),
  };
}

export function buildAllBaseLogisticsViewModels(params: {
  bases: Base[];
  buildingsById: BuildingsByIdMap;
  itemsById: Record<string, Item>;
}): BaseLogisticsViewModel[] {
  const { bases, buildingsById, itemsById } = params;

  return bases
    .map((base) => buildBaseLogisticsViewModel({
      selectedBaseId: base.id,
      bases,
      buildingsById,
      itemsById,
    }))
    .filter((model): model is BaseLogisticsViewModel => model !== null)
    .sort((left, right) => left.baseName.localeCompare(right.baseName));
}
