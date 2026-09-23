import type { AppState, BaseBuilding } from '@/app/uklad/model';
import { isBuildingAvailableForSection, isRawExtractor } from '@/features/bases/building-section';
import { createBaseBuilding, getLinkedInputBuildingTypeId, getOutputBuilding, linkInputToOutput, unlinkInputsLinkedToOutput } from '@/features/bases/building-operations';
import { PACKAGE_RECEIVER_BUILDING_ID } from '@/constants/buildingIds';
import { resolveOutputBuilding } from '@/utils/planOutputAllocations';
import { canUsePlanningOutput } from './planning-endpoints';

/** Create or reuse an input endpoint within the caller's state transaction. */
export function linkProductionPlanInput(
    draftState: AppState, targetBaseId: string, targetPlanId: string | null,
    sourceBaseId: string, sourceOutputBuildingId: string,
    targetBuildingTypeId?: string, name?: string, description?: string,
): BaseBuilding | undefined {
    const targetBase = draftState.basesList.find(base => base.id === targetBaseId);
    const sourceBase = draftState.basesList.find(base => base.id === sourceBaseId);
    if (!targetBase || !sourceBase) return;

    const sourceOutput = getOutputBuilding(sourceBase, sourceOutputBuildingId);
    if (!sourceOutput) return;
    const planning = draftState.basesMode === 'planning';
    const targetPlan = targetBase.productions.find(plan => plan.id === targetPlanId);
    if (planning && (!targetPlan || !canUsePlanningOutput(draftState.basesList, sourceBase, sourceOutput, targetBaseId, targetPlan))) return;

    const resolvedSourceOutput = resolveOutputBuilding(sourceOutput, sourceBase);
    if (!resolvedSourceOutput.selectedItemId || !resolvedSourceOutput.ratePerMinute || resolvedSourceOutput.ratePerMinute <= 0) {
        return;
    }

    const targetBuilding = targetBuildingTypeId
        ? draftState.buildingsList.find((building) => building.id === targetBuildingTypeId)
        : undefined;
    const inputBuildingTypeId = planning ? PACKAGE_RECEIVER_BUILDING_ID : targetBuilding &&
        isBuildingAvailableForSection(targetBuilding, 'inputs') &&
        !isRawExtractor(targetBuilding)
        ? targetBuilding.id
        : getLinkedInputBuildingTypeId(draftState.buildingsList);
    if (!inputBuildingTypeId || !draftState.buildingsList.some(building => building.id === inputBuildingTypeId)) return;

    const existingLinkedInput = targetBase.buildings.find((building) =>
        building.sectionType === 'inputs' &&
        building.buildingTypeId === inputBuildingTypeId &&
        building.linkedOutput?.baseId === sourceBaseId &&
        building.linkedOutput?.buildingId === sourceOutputBuildingId,
    );
    const linkedInput = existingLinkedInput || createBaseBuilding({
        buildingTypeId: inputBuildingTypeId,
        sectionType: 'inputs',
        name,
        description,
    });
    if (!existingLinkedInput) targetBase.buildings.push(linkedInput);
    if (planning && targetPlan) linkedInput.planningOwnerPlanId = targetPlan.id;

    const inputRef = { baseId: targetBaseId, buildingId: linkedInput.id };
    unlinkInputsLinkedToOutput(draftState as AppState, sourceBaseId, sourceOutputBuildingId, inputRef);
    linkInputToOutput(draftState as AppState, inputRef, sourceBaseId, sourceOutput, resolvedSourceOutput);

    return linkedInput;
}
