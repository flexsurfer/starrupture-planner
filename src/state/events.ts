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
import type { BuildingSectionType, LinkedInputReference } from '../components/mybases/types';
import {
    getSectionTypeForBuilding,
    isBuildingAvailableForSection,
    isBuildingCountAvailable,
    isRawExtractor,
    buildActivePlanOccupancy,
    reconcileBaseBuildingSectionTypeCount,
    sanitizeBulkBuildingCount,
    sanitizeBuildingCount,
} from '../components/mybases/utils';
import {
    computeRequiredBuildings,
    getFlowInputBuildings,
    getProductionInputIds,
    getSelectedFlowInputBuildings,
    sanitizeRecipeSelectionsForInputItems,
} from '../utils/productionPlanInputs';
import { calculateMaxTargetFromInputs } from '../utils/matchInputsCalculation';
import { getDefaultOutputCapacityPerMinute, resolveOutputBuilding } from '../utils/planOutputAllocations';
import {
    ORBITAL_CARGO_LAUNCHER_BUILDING_ID,
    PACKAGE_RECEIVER_BUILDING_ID,
} from '../constants/buildingIds';

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

/** Creates a new BaseBuilding object with a unique ID. */
function createBaseBuilding({
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
        id: createEntityId('building'),
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

function getLinkedInputBuildingTypeId(buildings: Building[]): string | undefined {
    const packageReceiver = buildings.find((building) => building.id === PACKAGE_RECEIVER_BUILDING_ID);
    if (packageReceiver) return packageReceiver.id;

    const fallback = buildings.find((building) =>
        isBuildingAvailableForSection(building, 'inputs') && !isRawExtractor(building)
    );
    return fallback?.id;
}

function getOutputBuilding(base: Base, outputBuildingId: string): BaseBuilding | undefined {
    return base.buildings.find((building: BaseBuilding) =>
        building.id === outputBuildingId &&
        building.sectionType === 'outputs'
    );
}

function unlinkInputsLinkedToOutput(
    draftDb: AppState,
    sourceBaseId: string,
    sourceOutputBuildingId: string,
    exceptInputRef?: LinkedInputReference
): void {
    draftDb.basesList.forEach((base: Base) => {
        base.buildings.forEach((building: BaseBuilding) => {
            if (building.sectionType !== 'inputs') return;
            if (building.linkedOutput?.baseId !== sourceBaseId) return;
            if (building.linkedOutput?.buildingId !== sourceOutputBuildingId) return;
            if (exceptInputRef?.baseId === base.id && exceptInputRef.buildingId === building.id) return;

            delete building.linkedOutput;
        });
    });
}

function linkInputToOutput(
    draftDb: AppState,
    inputRef: LinkedInputReference,
    sourceBaseId: string,
    sourceOutput: BaseBuilding,
    resolvedOutput: BaseBuilding
): void {
    const inputBase = getBaseById(draftDb.basesList, inputRef.baseId);
    if (!inputBase) return;

    const inputBuilding = inputBase.buildings.find((building: BaseBuilding) => building.id === inputRef.buildingId);
    if (!inputBuilding || inputBuilding.sectionType !== 'inputs') return;

    const inputBuildingType = draftDb.buildingsList.find((building: Building) => building.id === inputBuilding.buildingTypeId);
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

    if (snapshotItemId) {
        nextLinkedOutput.itemIdSnapshot = snapshotItemId;
    }
    if (snapshotRatePerMinute && snapshotRatePerMinute > 0) {
        nextLinkedOutput.ratePerMinuteSnapshot = snapshotRatePerMinute;
    }

    inputBuilding.linkedOutput = nextLinkedOutput;
}

registrar.regEvent(EVENT_IDS.BASES_ADD_BUILDING, ({ draftState: draftDb }, baseId: string, buildingTypeId: string, sectionType: string, name?: string, description?: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.buildings.push(createBaseBuilding({ buildingTypeId, sectionType, name, description }));
        return;
    }
});

registrar.regEvent(
    EVENT_IDS.BASES_ADD_BUILDINGS,
    (
        { draftState: draftDb },
        baseId: string,
        buildingTypeId: string,
        sectionType: string,
        count: number,
        name?: string,
        description?: string,
        selectedItemId?: string | null,
        ratePerMinute?: number | null,
        linkedOutput?: BaseBuilding['linkedOutput'] | null,
        sourceProductionId?: string | null,
        allocationMode?: BaseBuilding['allocationMode'] | null,
        requestedRatePerMinute?: number | null,
        capacityPerMinute?: number | null,
        priority?: number | null,
        linkedInputRef?: LinkedInputReference | null
    ) => {
        const base = getBaseById(draftDb.basesList, baseId);
        if (!base) return;
        const building = draftDb.buildingsList.find((candidate: Building) => candidate.id === buildingTypeId);

        const normalizedCount = building && isBuildingCountAvailable(building)
            ? sanitizeBulkBuildingCount(count)
            : 1;
        const normalizedRatePerMinute = typeof ratePerMinute === 'number' && ratePerMinute > 0
            ? ratePerMinute
            : undefined;
        const normalizedLinkedOutput = linkedOutput || undefined;
        const sourcePlan = sectionType === 'outputs' && sourceProductionId
            ? base.productions.find((plan: Production) => plan.id === sourceProductionId)
            : undefined;
        const normalizedSourceProductionId = sourcePlan?.id;
        const normalizedAllocationMode = normalizedSourceProductionId
            ? (allocationMode === 'fixed' ? 'fixed' : 'auto')
            : undefined;
        const normalizedRequestedRatePerMinute = normalizedAllocationMode === 'fixed' &&
            typeof requestedRatePerMinute === 'number' &&
            Number.isFinite(requestedRatePerMinute) &&
            requestedRatePerMinute > 0
            ? requestedRatePerMinute
            : undefined;
        const normalizedCapacityPerMinute = normalizedSourceProductionId
            ? (
                typeof capacityPerMinute === 'number' &&
                Number.isFinite(capacityPerMinute) &&
                capacityPerMinute > 0
                    ? capacityPerMinute
                    : getDefaultOutputCapacityPerMinute(buildingTypeId)
            )
            : undefined;
        const normalizedPriority = normalizedSourceProductionId
            ? (
                typeof priority === 'number' && Number.isFinite(priority) && priority >= 0
                    ? priority
                    : base.buildings.filter((candidate: BaseBuilding) =>
                        candidate.sectionType === 'outputs' &&
                        candidate.sourceProductionId === normalizedSourceProductionId
                    ).length
            )
            : undefined;
        const normalizedLinkedInputRef = sectionType === 'outputs' && linkedInputRef?.baseId && linkedInputRef?.buildingId
            ? linkedInputRef
            : null;

        for (let index = 0; index < normalizedCount; index += 1) {
            const newBuilding = createBaseBuilding({
                buildingTypeId,
                sectionType,
                name,
                description,
                selectedItemId: sourcePlan?.selectedItemId || selectedItemId || undefined,
                ratePerMinute: normalizedSourceProductionId ? undefined : normalizedRatePerMinute,
                linkedOutput: normalizedSourceProductionId ? undefined : normalizedLinkedOutput,
                sourceProductionId: normalizedSourceProductionId,
                allocationMode: normalizedAllocationMode,
                requestedRatePerMinute: normalizedRequestedRatePerMinute,
                capacityPerMinute: normalizedCapacityPerMinute,
                priority: typeof normalizedPriority === 'number' ? normalizedPriority + index : undefined,
            });

            base.buildings.push(newBuilding);

            if (normalizedLinkedInputRef) {
                const resolvedNewOutput = resolveOutputBuilding(newBuilding, base);
                unlinkInputsLinkedToOutput(draftDb as AppState, baseId, newBuilding.id, normalizedLinkedInputRef);
                linkInputToOutput(draftDb as AppState, normalizedLinkedInputRef, baseId, newBuilding, resolvedNewOutput);
            }

            if (sectionType === 'inputs' && normalizedLinkedOutput) {
                // Enforce 1:1: a freshly linked input takes over the source output,
                // detaching any other input previously bound to it.
                unlinkInputsLinkedToOutput(
                    draftDb as AppState,
                    normalizedLinkedOutput.baseId,
                    normalizedLinkedOutput.buildingId,
                    { baseId, buildingId: newBuilding.id }
                );
            }
        }

        return;
    }
);

registrar.regEvent(EVENT_IDS.BASES_SET_BUILDING_SECTION_TYPE_COUNT, ({ draftState: draftDb }, baseId: string, buildingTypeId: string, sectionType: BuildingSectionType, rawTargetCount: number) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    const building = draftDb.buildingsList.find((candidate: Building) => candidate.id === buildingTypeId);
    if (!building || building.id === 'base_core') return;
    if (sectionType !== 'energy' && sectionType !== 'production') return;
    if (!isBuildingAvailableForSection(building, sectionType)) return;

    const targetCount = sanitizeBuildingCount(rawTargetCount);
    const nextBuildings = reconcileBaseBuildingSectionTypeCount({
        base,
        buildingTypeId,
        sectionType,
        targetCount,
        createId: () => createEntityId('building'),
    });

    if (nextBuildings === base.buildings) return;
    base.buildings = nextBuildings;

    return;
});

registrar.regEvent(EVENT_IDS.BASES_REMOVE_BUILDING, ({ draftState: draftDb }, buildingId: string) => {
    const baseId = draftDb.basesSelectedBaseId;
    if (!baseId) return;
    
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.buildings = base.buildings.filter((b: BaseBuilding) => b.id !== buildingId);
        return;
    }
});

registrar.regEvent(EVENT_IDS.BASES_UPDATE_BUILDING_ITEM_SELECTION, ({ draftState: draftDb }, baseId: string, buildingId: string, itemId: string | null, ratePerMinute: number | null) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        const building = base.buildings.find((b: BaseBuilding) => b.id === buildingId);
        if (building) {
            if (itemId && ratePerMinute) {
                building.selectedItemId = itemId;
                building.ratePerMinute = ratePerMinute;
                delete building.linkedOutput;
                delete building.sourceProductionId;
                delete building.allocationMode;
                delete building.requestedRatePerMinute;
                delete building.capacityPerMinute;
                delete building.priority;
            } else {
                delete building.selectedItemId;
                delete building.ratePerMinute;
                delete building.linkedOutput;
                delete building.sourceProductionId;
                delete building.allocationMode;
                delete building.requestedRatePerMinute;
                delete building.capacityPerMinute;
                delete building.priority;
            }
            return;
        }
    }
});

registrar.regEvent(EVENT_IDS.BASES_UPDATE_BUILDING_LINKED_OUTPUT, ({ draftState: draftDb }, baseId: string, buildingId: string, sourceBaseId: string, sourceOutputBuildingId: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    const sourceBase = getBaseById(draftDb.basesList, sourceBaseId);
    if (!base || !sourceBase) return;

    const inputBuilding = base.buildings.find((building: BaseBuilding) => building.id === buildingId);
    if (!inputBuilding || inputBuilding.sectionType !== 'inputs') return;

    const inputBuildingType = draftDb.buildingsList.find((building: Building) => building.id === inputBuilding.buildingTypeId);
    if (!inputBuildingType || isRawExtractor(inputBuildingType)) return;

    const sourceOutput = getOutputBuilding(sourceBase, sourceOutputBuildingId);
    if (!sourceOutput) return;

    const inputRef = { baseId, buildingId };
    const resolvedSourceOutput = resolveOutputBuilding(sourceOutput, sourceBase);
    unlinkInputsLinkedToOutput(draftDb as AppState, sourceBaseId, sourceOutputBuildingId, inputRef);
    linkInputToOutput(draftDb as AppState, inputRef, sourceBaseId, sourceOutput, resolvedSourceOutput);

    return;
});

interface UpdateOutputPlanLinkPayload {
    sourceProductionId?: string | null;
    allocationMode?: BaseBuilding['allocationMode'];
    requestedRatePerMinute?: number | null;
    capacityPerMinute?: number | null;
    priority?: number | null;
}

registrar.regEvent(EVENT_IDS.BASES_UPDATE_OUTPUT_PLAN_LINK, ({ draftState: draftDb }, baseId: string, buildingId: string, payload: UpdateOutputPlanLinkPayload) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    const output = base.buildings.find((building: BaseBuilding) => building.id === buildingId);
    if (!output || output.sectionType !== 'outputs') return;

    const sourceProductionId = payload?.sourceProductionId || null;
    if (!sourceProductionId) {
        delete output.sourceProductionId;
        delete output.allocationMode;
        delete output.requestedRatePerMinute;
        delete output.capacityPerMinute;
        delete output.priority;
        return;
    }

    const sourcePlan = base.productions.find((plan: Production) => plan.id === sourceProductionId);
    if (!sourcePlan) return;

    output.sourceProductionId = sourceProductionId;
    output.allocationMode = payload.allocationMode === 'fixed' ? 'fixed' : 'auto';

    const requestedRatePerMinute = payload.requestedRatePerMinute;
    if (typeof requestedRatePerMinute === 'number' && Number.isFinite(requestedRatePerMinute) && requestedRatePerMinute > 0) {
        output.requestedRatePerMinute = requestedRatePerMinute;
    } else if (output.allocationMode !== 'fixed') {
        delete output.requestedRatePerMinute;
    }

    const capacityPerMinute = payload.capacityPerMinute;
    if (typeof capacityPerMinute === 'number' && Number.isFinite(capacityPerMinute) && capacityPerMinute > 0) {
        output.capacityPerMinute = capacityPerMinute;
    } else if (!output.capacityPerMinute) {
        const defaultCapacity = getDefaultOutputCapacityPerMinute(output.buildingTypeId);
        output.capacityPerMinute = defaultCapacity;
    }

    const priority = payload.priority;
    if (typeof priority === 'number' && Number.isFinite(priority) && priority >= 0) {
        output.priority = priority;
    } else if (typeof output.priority !== 'number') {
        const linkedOutputsCount = base.buildings.filter((building: BaseBuilding) =>
            building.sectionType === 'outputs' &&
            building.sourceProductionId === sourceProductionId
        ).length;
        output.priority = linkedOutputsCount;
    }

    output.selectedItemId = sourcePlan.selectedItemId;

    return;
});

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
