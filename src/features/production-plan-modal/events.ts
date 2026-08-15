import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { AppState, Base, BaseBuilding, Building, Production } from '@/app/uklad/model';
import { buildProductionFlow } from '@/components/planner/core/productionFlowBuilder';
import type { ProductionFlowResult } from '@/components/planner/core/types';
import { isBuildingAvailableForSection, isRawExtractor } from '@/components/mybases/utils';
import {
    computeRequiredBuildings,
    getProductionInputIds,
    getSelectedFlowInputBuildings,
    sanitizeRecipeSelectionsForInputItems,
} from '@/utils/productionPlanInputs';
import { calculateMaxTargetFromInputs } from '@/utils/matchInputsCalculation';
import { resolveOutputBuilding } from '@/utils/planOutputAllocations';
import {
    createBaseBuilding,
    getLinkedInputBuildingTypeId,
    getOutputBuilding,
    linkInputToOutput,
    unlinkInputsLinkedToOutput,
} from '@/features/bases/building-operations';
import { createProductionPlanModalFeatureState } from './state';

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
}

function createProductionPlanId(): string {
    return `pps_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function applyMatchInputs(draftState: AppState): void {
    if (!draftState.productionPlanModalState.matchInputs) return;

    const { selectedItemId, selectedInputIds, baseId, selectedCorporationLevel, recipeSelections } =
        draftState.productionPlanModalState;
    if (!selectedItemId || !baseId || !selectedInputIds?.length) return;

    const base = getBaseById(draftState.basesList, baseId);
    if (!base) return;

    const maxAmount = calculateMaxTargetFromInputs({
        selectedItemId,
        inputBuildings: getSelectedFlowInputBuildings(base, selectedInputIds, draftState.basesList),
        buildings: draftState.buildingsList,
        includeLauncher: selectedCorporationLevel !== null,
        recipeSelections,
    });
    if (maxAmount !== null && maxAmount > 0) {
        draftState.productionPlanModalState.targetAmount = maxAmount;
    }
}

function getSlowestOutputRateForItem(buildings: Building[], itemId: string): number {
    let bestRate: number | null = null;
    for (const building of buildings) {
        for (const recipe of building.recipes || []) {
            if (recipe.output.id !== itemId) continue;
            if (bestRate === null || recipe.output.amount_per_minute < bestRate) {
                bestRate = recipe.output.amount_per_minute;
            }
        }
    }
    return bestRate ?? 60;
}

function computeUsedInputSnapshots(flow: ProductionFlowResult, inputBuildings: BaseBuilding[] = []): BaseBuilding[] {
    const usedInputIdSet = new Set<string>();
    flow.nodes.forEach((node) => {
        if (node.nodeType === 'input' && node.baseBuildingId) {
            usedInputIdSet.add(node.baseBuildingId);
        }
    });

    return usedInputIdSet.size === 0
        ? []
        : inputBuildings.filter((inputBuilding) => usedInputIdSet.has(inputBuilding.id));
}

export const registerProductionPlanModalEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_CLOSE, ({ draftState }) => {
        draftState.productionPlanModalState = createProductionPlanModalFeatureState().productionPlanModalState;
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, ({ draftState }, name) => {
        draftState.productionPlanModalState.name = name;
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, ({ draftState }, amount) => {
        if (!draftState.productionPlanModalState.matchInputs) {
            draftState.productionPlanModalState.targetAmount = amount;
        }
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, ({ draftState }, level) => {
        draftState.productionPlanModalState.selectedCorporationLevel = level;
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_OPEN, ({ draftState }, editSectionId) => {
        const baseId = draftState.basesSelectedBaseId;
        if (!baseId) return;

        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        const editSection = base.productions.find((section) => section.id === editSectionId);
        draftState.productionPlanModalState = editSection
            ? {
                isOpen: true,
                baseId,
                editSectionId: editSectionId || null,
                name: editSection.name,
                selectedItemId: editSection.selectedItemId,
                targetAmount: editSection.targetAmount,
                selectedCorporationLevel: editSection.corporationLevel || null,
                selectedInputIds: getProductionInputIds(editSection.inputs),
                recipeSelections: { ...(editSection.recipeSelections || {}) },
                matchInputs: false,
            }
            : {
                isOpen: true,
                baseId,
                editSectionId: null,
                name: '',
                selectedItemId: '',
                targetAmount: 60,
                selectedCorporationLevel: null,
                selectedInputIds: [],
                recipeSelections: { ...draftState.pinnedRecipeSelections },
                matchInputs: false,
            };
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT, ({ draftState }) => {
        const modal = draftState.productionPlanModalState;
        const { baseId, editSectionId, name, selectedItemId, targetAmount, selectedCorporationLevel } = modal;
        if (!baseId || !name.trim() || !selectedItemId || targetAmount <= 0) return;

        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        const selectedInputBuildings = getSelectedFlowInputBuildings(base, modal.selectedInputIds || [], draftState.basesList);
        const recipeSelections = sanitizeRecipeSelectionsForInputItems(modal.recipeSelections, selectedInputBuildings);
        const flow = buildProductionFlow(
            {
                targetItemId: selectedItemId,
                targetAmount: targetAmount > 0 ? targetAmount : 1,
                inputBuildings: selectedInputBuildings,
                rawProductionDisabled: true,
                includeLauncher: selectedCorporationLevel !== null,
                recipeSelections,
            },
            draftState.buildingsList,
        );
        const usedInputSnapshots = computeUsedInputSnapshots(flow, selectedInputBuildings).map((input) => ({ ...input }));
        const requiredBuildings = computeRequiredBuildings(flow);

        if (editSectionId) {
            const section = base.productions.find((candidate) => candidate.id === editSectionId);
            if (!section) return;

            section.name = name.trim();
            section.selectedItemId = selectedItemId;
            section.targetAmount = targetAmount;
            section.corporationLevel = selectedCorporationLevel;
            section.inputs = usedInputSnapshots;
            section.requiredBuildings = requiredBuildings;
            section.recipeSelections = { ...recipeSelections };
            return;
        }

        const newSection: Production = {
            id: createProductionPlanId(),
            name: name.trim(),
            selectedItemId,
            targetAmount,
            active: false,
            corporationLevel: selectedCorporationLevel,
            inputs: usedInputSnapshots,
            status: 'inactive',
            requiredBuildings,
            recipeSelections: { ...recipeSelections },
        };
        base.productions.push(newSection);
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, ({ draftState }, itemId) => {
        const modalState = draftState.productionPlanModalState;
        modalState.selectedItemId = itemId;
        modalState.selectedCorporationLevel = null;
        modalState.recipeSelections = { ...draftState.pinnedRecipeSelections };

        if (itemId) {
            modalState.targetAmount = getSlowestOutputRateForItem(draftState.buildingsList, itemId);
            applyMatchInputs(draftState as AppState);
        }
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, ({ draftState }, itemId, recipeKey) => {
        if (!itemId) return;

        const modalState = draftState.productionPlanModalState;
        const base = modalState.baseId ? getBaseById(draftState.basesList, modalState.baseId) : undefined;
        const selectedInputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds || [], draftState.basesList);
        const inputItemIds = new Set(
            selectedInputBuildings
                .map((input) => input.selectedItemId)
                .filter((id): id is string => !!id),
        );
        if (inputItemIds.has(itemId)) return;

        if (recipeKey) {
            modalState.recipeSelections[itemId] = recipeKey;
        } else {
            delete modalState.recipeSelections[itemId];
        }
        applyMatchInputs(draftState as AppState);
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS, ({ draftState }, selections) => {
        const modalState = draftState.productionPlanModalState;
        const base = modalState.baseId ? getBaseById(draftState.basesList, modalState.baseId) : undefined;
        const selectedInputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds || [], draftState.basesList);
        modalState.recipeSelections = sanitizeRecipeSelectionsForInputItems({ ...(selections || {}) }, selectedInputBuildings);
        applyMatchInputs(draftState as AppState);
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, ({ draftState }, enabled) => {
        draftState.productionPlanModalState.matchInputs = enabled;
        if (enabled) applyMatchInputs(draftState as AppState);
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, ({ draftState }, baseBuildingId) => {
        const modalState = draftState.productionPlanModalState;
        const index = modalState.selectedInputIds.indexOf(baseBuildingId);
        if (index >= 0) {
            modalState.selectedInputIds.splice(index, 1);
        } else {
            modalState.selectedInputIds.push(baseBuildingId);
        }

        const base = modalState.baseId ? getBaseById(draftState.basesList, modalState.baseId) : undefined;
        const selectedInputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds, draftState.basesList);
        modalState.recipeSelections = sanitizeRecipeSelectionsForInputItems(modalState.recipeSelections, selectedInputBuildings);
        applyMatchInputs(draftState as AppState);
    });

    registrar.regEvent(
        appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
        ({ draftState }, sourceBaseId, sourceOutputBuildingId, targetBuildingTypeId, name, description) => {
            const modalState = draftState.productionPlanModalState;
            const targetBaseId = modalState.baseId;
            if (!targetBaseId || !sourceBaseId || !sourceOutputBuildingId) return;

            const targetBase = getBaseById(draftState.basesList, targetBaseId);
            const sourceBase = getBaseById(draftState.basesList, sourceBaseId);
            if (!targetBase || !sourceBase) return;

            const sourceOutput = getOutputBuilding(sourceBase, sourceOutputBuildingId);
            if (!sourceOutput) return;

            const resolvedSourceOutput = resolveOutputBuilding(sourceOutput, sourceBase);
            if (!resolvedSourceOutput.selectedItemId || !resolvedSourceOutput.ratePerMinute || resolvedSourceOutput.ratePerMinute <= 0) {
                return;
            }

            const targetBuilding = targetBuildingTypeId
                ? draftState.buildingsList.find((building) => building.id === targetBuildingTypeId)
                : undefined;
            const inputBuildingTypeId = targetBuilding &&
                isBuildingAvailableForSection(targetBuilding, 'inputs') &&
                !isRawExtractor(targetBuilding)
                ? targetBuilding.id
                : getLinkedInputBuildingTypeId(draftState.buildingsList);
            if (!inputBuildingTypeId) return;

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

            const inputRef = { baseId: targetBaseId, buildingId: linkedInput.id };
            unlinkInputsLinkedToOutput(draftState as AppState, sourceBaseId, sourceOutputBuildingId, inputRef);
            linkInputToOutput(draftState as AppState, inputRef, sourceBaseId, sourceOutput, resolvedSourceOutput);

            if (!modalState.selectedInputIds.includes(linkedInput.id)) {
                modalState.selectedInputIds.push(linkedInput.id);
            }

            const selectedInputBuildings = getSelectedFlowInputBuildings(targetBase, modalState.selectedInputIds, draftState.basesList);
            modalState.recipeSelections = sanitizeRecipeSelectionsForInputItems(modalState.recipeSelections, selectedInputBuildings);
            applyMatchInputs(draftState as AppState);
        },
    );
};
