import type { AppState, Base, BaseBuilding } from '@/app/uklad/model';
import type { LinkedInputReference } from '@/features/bases/types';
import { canConnectBuildings } from './connections';
import { PACKAGE_DISPATCHER_BUILDING_ID, PACKAGE_RECEIVER_BUILDING_ID } from '@/constants/buildingIds';

export function canDuplicateLogisticsBuilding(building: BaseBuilding): boolean {
    return (building.buildingTypeId === PACKAGE_RECEIVER_BUILDING_ID && building.sectionType === 'inputs') ||
        (building.buildingTypeId === PACKAGE_DISPATCHER_BUILDING_ID && building.sectionType === 'outputs');
}

function createBaseBuildingId(): string {
    return `building_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
}

interface CreateBaseBuildingOptions {
    id?: string;
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
    id,
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
        id: id || createBaseBuildingId(),
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

export function getOutputBuilding(base: Base, outputBuildingId: string): BaseBuilding | undefined {
    return base.buildings.find((building) =>
        building.id === outputBuildingId && building.sectionType === 'outputs'
    );
}

/** Manual endpoint edits release Planning ownership without rewriting saved plan snapshots. */
export function takeOverPlanningEndpoint(_base: Base, building: BaseBuilding): void {
    delete building.planningOwnerPlanId;
}

export function linkInputToOutput(
    draftState: AppState,
    inputRef: LinkedInputReference,
    sourceBaseId: string,
    sourceOutput: BaseBuilding,
    resolvedOutput: BaseBuilding
): boolean {
    const inputBase = getBaseById(draftState.basesList, inputRef.baseId);
    if (!inputBase) return false;

    const inputBuilding = inputBase.buildings.find((building) => building.id === inputRef.buildingId);
    if (!inputBuilding || !canConnectBuildings(draftState.basesList, draftState.buildingsList,
        sourceBaseId, sourceOutput, inputBase.id, inputBuilding)) return false;

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
    return true;
}
