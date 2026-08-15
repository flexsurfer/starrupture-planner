import type { UkladRegistrar } from '@ukladjs/core/vanilla';
import type { AppContracts } from '@/app/uklad/contracts';
import { EVENT_IDS } from './event-ids';
import type {
    Building,
    AppState,
    Base,
    BaseBuilding,
    Production,
    PlanRequiredBuilding,
} from './db';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import type { ProductionFlowResult } from '../components/planner/core/types';
import {
    getSectionTypeForBuilding,
    isBuildingAvailableForSection,
    isRawExtractor,
    buildActivePlanOccupancy,
} from '../components/mybases/utils';
import {
    computeRequiredBuildings,
    getFlowInputBuildings,
    getProductionInputIds,
    getSelectedFlowInputBuildings,
    sanitizeRecipeSelectionsForInputItems,
} from '../utils/productionPlanInputs';
import { calculateMaxTargetFromInputs } from '../utils/matchInputsCalculation';
import { resolveOutputBuilding } from '../utils/planOutputAllocations';
import { ORBITAL_CARGO_LAUNCHER_BUILDING_ID } from '../constants/buildingIds';
import {
    createBaseBuilding,
    getLinkedInputBuildingTypeId,
    getOutputBuilding,
    linkInputToOutput,
    unlinkInputsLinkedToOutput,
} from '@/features/bases/building-operations';

export const registerEvents = (registrar: UkladRegistrar<AppContracts>) => {

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    for (const base of bases) {
        if (base.id === baseId) {
            return base;
        }
    }
    return undefined;
}

function createEntityId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/** Recalculates and sets targetAmount when matchInputs is enabled. */
function applyMatchInputs(draftDb: AppState): void {
    if (!draftDb.productionPlanModalState.matchInputs) return;

    const { selectedItemId, selectedInputIds, baseId, selectedCorporationLevel, recipeSelections } =
        draftDb.productionPlanModalState;
    if (!selectedItemId || !baseId || !selectedInputIds?.length) return;

    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    const maxAmount = calculateMaxTargetFromInputs({
        selectedItemId,
        inputBuildings: getSelectedFlowInputBuildings(base, selectedInputIds, draftDb.basesList),
        buildings: draftDb.buildingsList,
        includeLauncher: selectedCorporationLevel !== null,
        recipeSelections,
    });
    if (maxAmount !== null && maxAmount > 0) {
        draftDb.productionPlanModalState.targetAmount = maxAmount;
    }
}

/** Slowest `amount_per_minute` among all recipes that output `itemId` (matches production-flow default). */
function getSlowestOutputRateForItem(buildings: Building[], itemId: string): number {
    let bestRate: number | null = null;
    for (const building of buildings) {
        for (const recipe of building.recipes || []) {
            if (recipe.output.id === itemId) {
                const rate = recipe.output.amount_per_minute;
                if (bestRate === null || rate < bestRate) {
                    bestRate = rate;
                }
            }
        }
    }
    if (bestRate !== null) return bestRate;
    return 60;
}

/** Keeps only input snapshots that are actually consumed by the provided flow. */
function computeUsedInputSnapshots(flow: ProductionFlowResult, inputBuildings: BaseBuilding[] = []): BaseBuilding[] {
    const usedInputIdSet = new Set<string>();
    flow.nodes.forEach(node => {
        if (node.nodeType === 'input' && node.baseBuildingId) {
            usedInputIdSet.add(node.baseBuildingId);
        }
    });

    if (usedInputIdSet.size === 0) return [];
    return inputBuildings.filter((inputBuilding) => usedInputIdSet.has(inputBuilding.id));
}

function buildTotalBuildingCountByType(base: Base): Map<string, number> {
    const counts = new Map<string, number>();
    for (const baseBuilding of base.buildings) {
        const count = counts.get(baseBuilding.buildingTypeId) || 0;
        counts.set(baseBuilding.buildingTypeId, count + 1);
    }
    return counts;
}

function buildAvailableBuildingCountByType(base: Base, excludePlanId?: string | null): Map<string, number> {
    const totals = buildTotalBuildingCountByType(base);
    const occupied = buildActivePlanOccupancy(base, { excludePlanId }).occupiedBuildingTypeCounts;
    const available = new Map<string, number>();

    totals.forEach((totalCount, buildingTypeId) => {
        const occupiedCount = occupied.get(buildingTypeId) || 0;
        available.set(buildingTypeId, Math.max(0, totalCount - occupiedCount));
    });

    return available;
}

//===============================================
// Base management
//===============================================

//===============================================
//  PRODUCTION PLAN SECTIONS
//===============================================

registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, ({ draftState: draftDb }, baseId: string, planId: string, flag: 'all' | 'missing') => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    const plan = base.productions.find((s: Production) => s.id === planId);
    if (!plan) return;

    const planInputBuildings = getFlowInputBuildings(plan.inputs || [], draftDb.basesList);
    const recipeSelections = sanitizeRecipeSelectionsForInputItems(plan.recipeSelections || {}, planInputBuildings);
    const flow = buildProductionFlow(
        {
            targetItemId: plan.selectedItemId,
            targetAmount: plan.targetAmount > 0 ? plan.targetAmount : 1,
            inputBuildings: planInputBuildings,
            rawProductionDisabled: true,
            includeLauncher: plan.corporationLevel !== null && plan.corporationLevel !== undefined,
            recipeSelections,
        },
        draftDb.buildingsList
    );
    const requiredBuildings = computeRequiredBuildings(flow);
    if (requiredBuildings.length === 0) return;

    const existingCountByType = flag === 'missing'
        ? buildAvailableBuildingCountByType(base, plan.id)
        : new Map<string, number>();

    const buildingCountsToAdd: PlanRequiredBuilding[] = [];

    for (const { buildingId, count: requiredCount } of requiredBuildings) {
        if (requiredCount <= 0) continue;

        const existingCount = flag === 'missing' ? (existingCountByType.get(buildingId) || 0) : 0;
        const countToAdd = flag === 'missing'
            ? Math.max(0, requiredCount - existingCount)
            : requiredCount;
        if (countToAdd === 0) continue;

        buildingCountsToAdd.push({ buildingId, count: countToAdd });
        existingCountByType.set(buildingId, existingCount + countToAdd);
    }

    if (buildingCountsToAdd.length === 0) return;

    // Build a lookup for building type data only when additions are needed.
    const buildingsById = new Map(
        (draftDb.buildingsList as Building[]).map((b: Building) => [b.id, b])
    );
    const resolveSectionType = (buildingId: string): string => {
        const building = buildingsById.get(buildingId);
        return building ? getSectionTypeForBuilding(building) : 'production';
    };

    const newBuildings: BaseBuilding[] = [];
    const createPlanBuilding = (buildingId: string, sectionType: string): BaseBuilding => {
        const newBuilding = createBaseBuilding({ buildingTypeId: buildingId, sectionType });
        if (buildingId === ORBITAL_CARGO_LAUNCHER_BUILDING_ID && plan.selectedItemId) {
            newBuilding.selectedItemId = plan.selectedItemId;
            newBuilding.ratePerMinute = 10;
        }
        return newBuilding;
    };
    for (const { buildingId, count } of buildingCountsToAdd) {
        const sectionType = resolveSectionType(buildingId);
        for (let i = 0; i < count; i++) {
            newBuildings.push(createPlanBuilding(buildingId, sectionType));
        }
    }

    base.buildings.push(...newBuildings);

    return;
});

/** Create Production Plan Modal events */

registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_OPEN, ({ draftState: draftDb }, editSectionId?: string | null) => {
    const baseId = draftDb.basesSelectedBaseId;
    if (!baseId) return; // No selected base, cannot open modal
    
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return; // Base not found
    
    const editSection = base.productions?.find((p: Production) => p.id === editSectionId);
    
    // Initialize form state from edit section or defaults
    if (editSection) {
        draftDb.productionPlanModalState = {
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
        };
    } else {
        draftDb.productionPlanModalState = {
            isOpen: true,
            baseId,
            editSectionId: null,
            name: '',
            selectedItemId: '',
            targetAmount: 60,
            selectedCorporationLevel: null,
            selectedInputIds: [],
            recipeSelections: { ...draftDb.pinnedRecipeSelections },
            matchInputs: false,
        };
    }
});

registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SUBMIT, ({ draftState: draftDb }) => {
    const modal = draftDb.productionPlanModalState;
    const { baseId, editSectionId, name, selectedItemId, targetAmount, selectedCorporationLevel } = modal;
    
    if (!baseId || !name.trim() || !selectedItemId || targetAmount <= 0) {
        return;
    }
    
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    // Get production flow to extract used inputs
    const validAmount = targetAmount > 0 ? targetAmount : 1;
    const includeLauncher = selectedCorporationLevel !== null;
    const selectedInputBuildings = getSelectedFlowInputBuildings(base, modal.selectedInputIds || [], draftDb.basesList);
    const recipeSelections = sanitizeRecipeSelectionsForInputItems(modal.recipeSelections, selectedInputBuildings);
    
    const flow = buildProductionFlow(
        { 
            targetItemId: selectedItemId, 
            targetAmount: validAmount, 
            inputBuildings: selectedInputBuildings,
            rawProductionDisabled: true,
            includeLauncher,
            recipeSelections,
        },
        draftDb.buildingsList
    );
    
    const usedInputSnapshots = computeUsedInputSnapshots(flow, selectedInputBuildings).map((input) => ({ ...input }));
    
    const requiredBuildings = computeRequiredBuildings(flow);

    if (editSectionId) {
        // Update existing section
        const section = base.productions.find((s: Production) => s.id === editSectionId);
        if (section) {
            section.name = name.trim();
            section.selectedItemId = selectedItemId;
            section.targetAmount = targetAmount;
            section.corporationLevel = selectedCorporationLevel;
            section.inputs = usedInputSnapshots;
            section.requiredBuildings = requiredBuildings;
            section.recipeSelections = { ...recipeSelections };
        }
    } else {
        // Create new section
        const sectionId = createEntityId('pps');
        const newSection: Production = {
            id: sectionId,
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
    }

    return;
});

/** Production Plan Modal Form events */

registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, ({ draftState: draftDb }, itemId: string) => {
    draftDb.productionPlanModalState.selectedItemId = itemId;
    draftDb.productionPlanModalState.selectedCorporationLevel = null;
    draftDb.productionPlanModalState.recipeSelections = { ...draftDb.pinnedRecipeSelections };

    if (itemId) {
        draftDb.productionPlanModalState.targetAmount = getSlowestOutputRateForItem(
            draftDb.buildingsList,
            itemId
        );
        applyMatchInputs(draftDb as AppState);
    }
});

registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, ({ draftState: draftDb }, itemId: string, recipeKey: string | null) => {
    if (!itemId) return;

    const modalState = draftDb.productionPlanModalState;
    const base = modalState.baseId ? getBaseById(draftDb.basesList, modalState.baseId) : undefined;
    const selectedInputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds || [], draftDb.basesList);
    const inputItemIds = new Set(
        selectedInputBuildings
            .map((input) => input.selectedItemId)
            .filter((id): id is string => !!id)
    );
    if (inputItemIds.has(itemId)) return;

    if (!recipeKey) {
        delete modalState.recipeSelections[itemId];
    } else {
        modalState.recipeSelections[itemId] = recipeKey;
    }
    applyMatchInputs(draftDb as AppState);
});

/** Replaces the whole modal recipe-alternative selection (used when loading a saved set). */
registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS, ({ draftState: draftDb }, selections: Record<string, string>) => {
    const modalState = draftDb.productionPlanModalState;
    const base = modalState.baseId ? getBaseById(draftDb.basesList, modalState.baseId) : undefined;
    const selectedInputBuildings = getSelectedFlowInputBuildings(base, modalState.selectedInputIds || [], draftDb.basesList);
    // Drop selections for items provided as external inputs (mirrors the per-item event).
    modalState.recipeSelections = sanitizeRecipeSelectionsForInputItems({ ...(selections || {}) }, selectedInputBuildings);
    applyMatchInputs(draftDb as AppState);
});

registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, ({ draftState: draftDb }, enabled: boolean) => {
    draftDb.productionPlanModalState.matchInputs = enabled;
    if (enabled) {
        applyMatchInputs(draftDb as AppState);
    }
});

registrar.regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, ({ draftState: draftDb }, baseBuildingId: string) => {
    const modalState = draftDb.productionPlanModalState;
    const selectedInputIds = modalState.selectedInputIds;
    const index = selectedInputIds.indexOf(baseBuildingId);
    if (index >= 0) {
        selectedInputIds.splice(index, 1);
    } else {
        selectedInputIds.push(baseBuildingId);
    }
    const base = modalState.baseId ? getBaseById(draftDb.basesList, modalState.baseId) : undefined;
    const selectedInputBuildings = getSelectedFlowInputBuildings(base, selectedInputIds || [], draftDb.basesList);
    const sanitizedRecipeSelections = sanitizeRecipeSelectionsForInputItems(modalState.recipeSelections, selectedInputBuildings);
    modalState.recipeSelections = sanitizedRecipeSelections;
    applyMatchInputs(draftDb as AppState);
});

registrar.regEvent(
    EVENT_IDS.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    (
        { draftState: draftDb },
        sourceBaseId: string,
        sourceOutputBuildingId: string,
        targetBuildingTypeId?: string,
        name?: string,
        description?: string
    ) => {
    const modalState = draftDb.productionPlanModalState;
    const targetBaseId = modalState.baseId;
    if (!targetBaseId || !sourceBaseId || !sourceOutputBuildingId) return;

    const targetBase = getBaseById(draftDb.basesList, targetBaseId);
    const sourceBase = getBaseById(draftDb.basesList, sourceBaseId);
    if (!targetBase || !sourceBase) return;

    const sourceOutput = getOutputBuilding(sourceBase, sourceOutputBuildingId);
    if (!sourceOutput) return;

    const resolvedSourceOutput = resolveOutputBuilding(sourceOutput, sourceBase);
    if (
        !resolvedSourceOutput.selectedItemId ||
        !resolvedSourceOutput.ratePerMinute ||
        resolvedSourceOutput.ratePerMinute <= 0
    ) {
        return;
    }

    const targetBuilding = targetBuildingTypeId
        ? draftDb.buildingsList.find((building: Building) => building.id === targetBuildingTypeId)
        : undefined;
    const inputBuildingTypeId = (targetBuilding &&
        isBuildingAvailableForSection(targetBuilding, 'inputs') &&
        !isRawExtractor(targetBuilding))
        ? targetBuilding.id
        : getLinkedInputBuildingTypeId(draftDb.buildingsList);
    if (!inputBuildingTypeId) return;

    const existingLinkedInput = targetBase.buildings.find((building: BaseBuilding) =>
        building.sectionType === 'inputs' &&
        building.buildingTypeId === inputBuildingTypeId &&
        building.linkedOutput?.baseId === sourceBaseId &&
        building.linkedOutput?.buildingId === sourceOutputBuildingId
    );

    const linkedInput = existingLinkedInput || createBaseBuilding({
        buildingTypeId: inputBuildingTypeId,
        sectionType: 'inputs',
        name,
        description,
    });

    if (!existingLinkedInput) {
        targetBase.buildings.push(linkedInput);
    }

    // Reuse the shared 1:1 helpers: detach any input previously bound to this
    // output (in any base), then bind it to the plan's input.
    const inputRef = { baseId: targetBaseId, buildingId: linkedInput.id };
    unlinkInputsLinkedToOutput(draftDb as AppState, sourceBaseId, sourceOutputBuildingId, inputRef);
    linkInputToOutput(draftDb as AppState, inputRef, sourceBaseId, sourceOutput, resolvedSourceOutput);

    if (!modalState.selectedInputIds.includes(linkedInput.id)) {
        modalState.selectedInputIds.push(linkedInput.id);
    }

    const selectedInputBuildings = getSelectedFlowInputBuildings(targetBase, modalState.selectedInputIds || [], draftDb.basesList);
    modalState.recipeSelections = sanitizeRecipeSelectionsForInputItems(modalState.recipeSelections, selectedInputBuildings);
    applyMatchInputs(draftDb as AppState);

    return;
});
};
