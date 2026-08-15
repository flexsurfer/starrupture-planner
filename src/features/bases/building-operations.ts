import type { Building, AppState, Base, BaseBuilding } from '@/app/uklad/model';
import type { LinkedInputReference } from '@/components/mybases/types';
import { isBuildingAvailableForSection, isRawExtractor } from '@/components/mybases/utils';
import { PACKAGE_RECEIVER_BUILDING_ID } from '@/constants/buildingIds';

function createBaseBuildingId(): string {
    return `building_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
}

interface CreateBaseBuildingOptions {
    buildingTypeId: string;
    sectionType: string;
    name?: string;
    description?: string;
    selectedItemId?: string;
    ratePerMinute?: number;
    linkedOutput?: BaseBuilding['linkedOutput'];
    sourceProductionId?: string;
    allocationMode?: BaseBuilding['allocationMode'];
    requestedRatePerMinute?: number;
    capacityPerMinute?: number;
    priority?: number;
}

/** Creates a base-building instance with the same normalization used by all base workflows. */
export function createBaseBuilding({
    buildingTypeId,
    sectionType,
    name,
    description,
    selectedItemId,
    ratePerMinute,
    linkedOutput,
    sourceProductionId,
    allocationMode,
    requestedRatePerMinute,
    capacityPerMinute,
    priority,
}: CreateBaseBuildingOptions): BaseBuilding {
    return {
        id: createBaseBuildingId(),
        buildingTypeId,
        sectionType,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        ...(selectedItemId ? { selectedItemId } : {}),
        ...(ratePerMinute && ratePerMinute > 0 ? { ratePerMinute } : {}),
        ...(linkedOutput ? { linkedOutput } : {}),
        ...(sourceProductionId ? { sourceProductionId } : {}),
        ...(allocationMode ? { allocationMode } : {}),
        ...(requestedRatePerMinute && requestedRatePerMinute > 0 ? { requestedRatePerMinute } : {}),
        ...(capacityPerMinute && capacityPerMinute > 0 ? { capacityPerMinute } : {}),
        ...(typeof priority === 'number' && Number.isFinite(priority) && priority >= 0 ? { priority } : {}),
    };
}

export function getLinkedInputBuildingTypeId(buildings: Building[]): string | undefined {
    const packageReceiver = buildings.find((building) => building.id === PACKAGE_RECEIVER_BUILDING_ID);
    if (packageReceiver) return packageReceiver.id;

    const fallback = buildings.find((building) =>
        isBuildingAvailableForSection(building, 'inputs') && !isRawExtractor(building)
    );
    return fallback?.id;
}

export function getOutputBuilding(base: Base, outputBuildingId: string): BaseBuilding | undefined {
    return base.buildings.find((building) =>
        building.id === outputBuildingId && building.sectionType === 'outputs'
    );
}

export function unlinkInputsLinkedToOutput(
    draftState: AppState,
    sourceBaseId: string,
    sourceOutputBuildingId: string,
    exceptInputRef?: LinkedInputReference
): void {
    draftState.basesList.forEach((base) => {
        base.buildings.forEach((building) => {
            if (building.sectionType !== 'inputs') return;
            if (building.linkedOutput?.baseId !== sourceBaseId) return;
            if (building.linkedOutput?.buildingId !== sourceOutputBuildingId) return;
            if (exceptInputRef?.baseId === base.id && exceptInputRef.buildingId === building.id) return;

            delete building.linkedOutput;
        });
    });
}

export function linkInputToOutput(
    draftState: AppState,
    inputRef: LinkedInputReference,
    sourceBaseId: string,
    sourceOutput: BaseBuilding,
    resolvedOutput: BaseBuilding
): void {
    const inputBase = getBaseById(draftState.basesList, inputRef.baseId);
    if (!inputBase) return;

    const inputBuilding = inputBase.buildings.find((building) => building.id === inputRef.buildingId);
    if (!inputBuilding || inputBuilding.sectionType !== 'inputs') return;

    const inputBuildingType = draftState.buildingsList.find((building) => building.id === inputBuilding.buildingTypeId);
    if (!inputBuildingType || isRawExtractor(inputBuildingType)) return;

    if (resolvedOutput.selectedItemId && resolvedOutput.ratePerMinute && resolvedOutput.ratePerMinute > 0) {
        inputBuilding.selectedItemId = resolvedOutput.selectedItemId;
        inputBuilding.ratePerMinute = resolvedOutput.ratePerMinute;
    }

    const nextLinkedOutput: BaseBuilding['linkedOutput'] = {
        baseId: sourceBaseId,
        buildingId: sourceOutput.id,
    };

    const snapshotItemId = resolvedOutput.selectedItemId || inputBuilding.selectedItemId;
    const snapshotRatePerMinute = resolvedOutput.ratePerMinute && resolvedOutput.ratePerMinute > 0
        ? resolvedOutput.ratePerMinute
        : inputBuilding.ratePerMinute;

    if (snapshotItemId) nextLinkedOutput.itemIdSnapshot = snapshotItemId;
    if (snapshotRatePerMinute && snapshotRatePerMinute > 0) {
        nextLinkedOutput.ratePerMinuteSnapshot = snapshotRatePerMinute;
    }

    inputBuilding.linkedOutput = nextLinkedOutput;
}
