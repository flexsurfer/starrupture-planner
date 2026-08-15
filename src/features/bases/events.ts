import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { AppState, Base, BaseCardSectionKey } from '@/app/uklad/model';
import { getDefaultBaseCardSectionCollapsed } from '@/features/bases/card-sections';
import {
    isBuildingAvailableForSection,
    isBuildingCountAvailable,
    isRawExtractor,
} from './building-section';
import {
    reconcileBaseBuildingSectionTypeCount,
    sanitizeBulkBuildingCount,
    sanitizeBuildingCount,
} from './building-counts';
import { getDefaultOutputCapacityPerMinute, resolveOutputBuilding } from '@/utils/planOutputAllocations';
import {
    createBaseBuilding,
    getOutputBuilding,
    linkInputToOutput,
    unlinkInputsLinkedToOutput,
} from './building-operations';

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
}

function createBaseId(): string {
    return `base_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const registerBasesEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.BASES_CREATE_BASE, ({ draftState }, name) => {
        const baseId = createBaseId();
        draftState.basesList.push({
            id: baseId,
            name,
            buildings: [],
            productions: [],
        });
        draftState.basesSelectedBaseId = baseId;
        draftState.basesSelectedDetailTab = 'base';
    });

    registrar.regEvent(appIds.events.BASES_UPDATE_BASE_NAME, ({ draftState }, baseId, name) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (base) base.name = name;
    });

    registrar.regEvent(appIds.events.BASES_SET_CORE_LEVEL, ({ draftState }, level) => {
        if (!draftState.basesSelectedBaseId) return;
        const base = getBaseById(draftState.basesList, draftState.basesSelectedBaseId);
        if (base) base.coreLevel = level;
    });

    registrar.regEvent(appIds.events.BASES_DELETE_BASE, ({ draftState }, baseId) => {
        draftState.basesList = draftState.basesList.filter((base) => base.id !== baseId);
        delete draftState.basesCardCollapsedSections[baseId];
        if (draftState.basesSelectedBaseId === baseId) {
            draftState.basesSelectedBaseId = null;
            draftState.basesSelectedDetailTab = 'base';
        }
    });

    registrar.regEvent(appIds.events.BASES_OPEN_BASE, ({ draftState }, baseId, tab = 'base') => {
        draftState.basesSelectedBaseId = baseId;
        draftState.basesSelectedDetailTab = tab;
    });

    registrar.regEvent(appIds.events.BASES_SET_SELECTED_BASE, ({ draftState }, baseId) => {
        draftState.basesSelectedBaseId = baseId;
        draftState.basesSelectedDetailTab = 'base';
    });

    registrar.regEvent(appIds.events.BASES_SET_DETAIL_TAB, ({ draftState }, tab) => {
        draftState.basesSelectedDetailTab = tab;
    });

    registrar.regEvent(appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED, ({ draftState }, baseId, section) => {
        if (!getBaseById(draftState.basesList, baseId)) return;

        const baseSections = draftState.basesCardCollapsedSections[baseId] || {};
        const currentValue = baseSections[section as BaseCardSectionKey]
            ?? getDefaultBaseCardSectionCollapsed(section as BaseCardSectionKey);
        draftState.basesCardCollapsedSections[baseId] = {
            ...baseSections,
            [section]: !currentValue,
        };
    });

    registrar.regEvent(appIds.events.BASES_SET_ENERGY_GROUP, ({ draftState }, baseId, groupId) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        if (!groupId) {
            if (base.energyGroupId) delete base.energyGroupId;
            return;
        }

        const groupExists = draftState.energyGroups.some((group) => group.id === groupId);
        if (groupExists && base.energyGroupId !== groupId) {
            base.energyGroupId = groupId;
        }
    });

    registrar.regEvent(appIds.events.BASES_ADD_BUILDING, ({ draftState }, baseId, buildingTypeId, sectionType, name, description) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        base.buildings.push(createBaseBuilding({
            buildingTypeId,
            sectionType,
            name,
            description,
        }));
    });

    registrar.regEvent(
        appIds.events.BASES_ADD_BUILDINGS,
        (
            { draftState },
            baseId,
            buildingTypeId,
            sectionType,
            count,
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
            linkedInputRef,
        ) => {
            const base = getBaseById(draftState.basesList, baseId);
            if (!base) return;
            const building = draftState.buildingsList.find((candidate) => candidate.id === buildingTypeId);

            const normalizedCount = building && isBuildingCountAvailable(building)
                ? sanitizeBulkBuildingCount(count)
                : 1;
            const normalizedRatePerMinute = typeof ratePerMinute === 'number' && ratePerMinute > 0
                ? ratePerMinute
                : undefined;
            const normalizedLinkedOutput = linkedOutput || undefined;
            const sourcePlan = sectionType === 'outputs' && sourceProductionId
                ? base.productions.find((plan) => plan.id === sourceProductionId)
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
                        : base.buildings.filter((candidate) =>
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
                    unlinkInputsLinkedToOutput(draftState as AppState, baseId, newBuilding.id, normalizedLinkedInputRef);
                    linkInputToOutput(draftState as AppState, normalizedLinkedInputRef, baseId, newBuilding, resolvedNewOutput);
                }

                if (sectionType === 'inputs' && normalizedLinkedOutput) {
                    unlinkInputsLinkedToOutput(
                        draftState as AppState,
                        normalizedLinkedOutput.baseId,
                        normalizedLinkedOutput.buildingId,
                        { baseId, buildingId: newBuilding.id },
                    );
                }
            }
        },
    );

    registrar.regEvent(
        appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
        ({ draftState }, baseId, buildingTypeId, sectionType, rawTargetCount) => {
            const base = getBaseById(draftState.basesList, baseId);
            if (!base) return;

            const building = draftState.buildingsList.find((candidate) => candidate.id === buildingTypeId);
            if (!building || building.id === 'base_core') return;
            if (sectionType !== 'energy' && sectionType !== 'production') return;
            if (!isBuildingAvailableForSection(building, sectionType)) return;

            const targetCount = sanitizeBuildingCount(rawTargetCount);
            const nextBuildings = reconcileBaseBuildingSectionTypeCount({
                base,
                buildingTypeId,
                sectionType,
                targetCount,
                createId: () => `building_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
            });

            if (nextBuildings !== base.buildings) base.buildings = nextBuildings;
        },
    );

    registrar.regEvent(appIds.events.BASES_REMOVE_BUILDING, ({ draftState }, buildingId) => {
        const baseId = draftState.basesSelectedBaseId;
        if (!baseId) return;

        const base = getBaseById(draftState.basesList, baseId);
        if (base) base.buildings = base.buildings.filter((building) => building.id !== buildingId);
    });

    registrar.regEvent(
        appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
        ({ draftState }, baseId, buildingId, itemId, ratePerMinute) => {
            const base = getBaseById(draftState.basesList, baseId);
            const building = base?.buildings.find((candidate) => candidate.id === buildingId);
            if (!building) return;

            if (itemId && ratePerMinute) {
                building.selectedItemId = itemId;
                building.ratePerMinute = ratePerMinute;
            } else {
                delete building.selectedItemId;
                delete building.ratePerMinute;
            }
            delete building.linkedOutput;
            delete building.sourceProductionId;
            delete building.allocationMode;
            delete building.requestedRatePerMinute;
            delete building.capacityPerMinute;
            delete building.priority;
        },
    );

    registrar.regEvent(
        appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
        ({ draftState }, baseId, buildingId, sourceBaseId, sourceOutputBuildingId) => {
            const base = getBaseById(draftState.basesList, baseId);
            const sourceBase = getBaseById(draftState.basesList, sourceBaseId);
            if (!base || !sourceBase) return;

            const inputBuilding = base.buildings.find((building) => building.id === buildingId);
            if (!inputBuilding || inputBuilding.sectionType !== 'inputs') return;

            const inputBuildingType = draftState.buildingsList.find((building) => building.id === inputBuilding.buildingTypeId);
            if (!inputBuildingType || isRawExtractor(inputBuildingType)) return;

            const sourceOutput = getOutputBuilding(sourceBase, sourceOutputBuildingId);
            if (!sourceOutput) return;

            const inputRef = { baseId, buildingId };
            const resolvedSourceOutput = resolveOutputBuilding(sourceOutput, sourceBase);
            unlinkInputsLinkedToOutput(draftState as AppState, sourceBaseId, sourceOutputBuildingId, inputRef);
            linkInputToOutput(draftState as AppState, inputRef, sourceBaseId, sourceOutput, resolvedSourceOutput);
        },
    );

    registrar.regEvent(
        appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
        ({ draftState }, baseId, buildingId, payload) => {
            const base = getBaseById(draftState.basesList, baseId);
            if (!base) return;

            const output = base.buildings.find((building) => building.id === buildingId);
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

            const sourcePlan = base.productions.find((plan) => plan.id === sourceProductionId);
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
                output.capacityPerMinute = getDefaultOutputCapacityPerMinute(output.buildingTypeId);
            }

            const priority = payload.priority;
            if (typeof priority === 'number' && Number.isFinite(priority) && priority >= 0) {
                output.priority = priority;
            } else if (typeof output.priority !== 'number') {
                output.priority = base.buildings.filter((building) =>
                    building.sectionType === 'outputs' && building.sourceProductionId === sourceProductionId
                ).length;
            }

            output.selectedItemId = sourcePlan.selectedItemId;
        },
    );
};
