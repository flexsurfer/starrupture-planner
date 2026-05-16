import { regEvent, current } from '@flexsurfer/reflex';
import { EVENT_IDS } from './event-ids';
import { EFFECT_IDS } from './effect-ids';
import type {
    TabType,
    DataVersion,
    Item,
    Building,
    AppState,
    AppVersionedGameData,
    Base,
    BaseBuilding,
    EnergyGroup,
    Production,
    PlanRequiredBuilding,
    CorporationLevelSelection,
} from './db';
import { buildItemsMap, parseCorporations, extractCategories } from './data-utils';
import { DEFAULT_DATA_VERSION, isValidDataVersion } from './gameDataVersion';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import type { ProductionFlowResult } from '../components/planner/core/types';
import type { BuildingSectionType } from '../components/mybases/types';
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

// Common function to update draftDb with version data
function updateDraftDbWithVersionData(draftDb: AppState, version: DataVersion) {
    const data = draftDb.appVersionedData[version];
    if (!data) {
        console.error(`[app] Missing game data for version "${version}"`);
        return;
    }
    const items = data.items as Item[];
    const buildings = data.buildings as Building[];
    const corporations = parseCorporations(data.corporations);

    draftDb.appDataVersion = version;
    draftDb.itemsList = items;
    draftDb.itemsById = buildItemsMap(items);
    draftDb.buildingsList = buildings;
    draftDb.corporationsList = corporations;
    draftDb.itemsCategories = extractCategories(items);
}

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

function normalizeEnergyGroupName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}

function findEnergyGroupByName(groups: EnergyGroup[], name: string): EnergyGroup | undefined {
    const normalizedName = normalizeEnergyGroupName(name).toLowerCase();
    if (!normalizedName) return undefined;

    return groups.find((group) => normalizeEnergyGroupName(group.name).toLowerCase() === normalizedName);
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

/** Returns a SET_BASES effect tuple that persists bases. */
function persistBasesEffect(draftDb: AppState): [string, Base[]] {
    return [EFFECT_IDS.SET_BASES, current(draftDb.basesList)];
}

/** Returns a SET_ENERGY_GROUPS effect tuple that persists energy groups. */
function persistEnergyGroupsEffect(draftDb: AppState): [string, EnergyGroup[]] {
    return [EFFECT_IDS.SET_ENERGY_GROUPS, current(draftDb.energyGroups)];
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

function setTargetAmountToDefault(draftDb: AppState, itemId: string) {
    draftDb.plannerTargetAmount = getSlowestOutputRateForItem(draftDb.buildingsList, itemId);
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

regEvent(EVENT_IDS.UI_SET_THEME, ({ draftDb }, newTheme: 'light' | 'dark') => {
    draftDb.uiTheme = newTheme;
    return [[EFFECT_IDS.SET_THEME, newTheme]];
});

regEvent(EVENT_IDS.UI_SHOW_CONFIRMATION_DIALOG, ({ draftDb }, title: string, message: string, onConfirm: () => void, options?: { confirmLabel?: string; cancelLabel?: string; confirmButtonClass?: string; onCancel?: () => void }) => {
    draftDb.uiConfirmationDialog = {
        isOpen: true,
        title,
        message,
        confirmLabel: options?.confirmLabel || 'Confirm',
        cancelLabel: options?.cancelLabel || 'Cancel',
        confirmButtonClass: options?.confirmButtonClass || 'btn-primary',
        onConfirm,
        onCancel: options?.onCancel,
    };
});

regEvent(EVENT_IDS.UI_CLOSE_CONFIRMATION_DIALOG, ({ draftDb }) => {
    draftDb.uiConfirmationDialog = {};
});

function resolveDataVersionFromCoeffect(raw: string | null | undefined): DataVersion {
    if (isValidDataVersion(raw)) {
        return raw;
    }
    return DEFAULT_DATA_VERSION;
}

/** Initialization event */
regEvent(EVENT_IDS.APP_INIT, ({ draftDb, localStoreTheme, localStoreDataVersion, localStoreBases, localStoreEnergyGroups }) => {
    if (localStoreTheme) {
        draftDb.uiTheme = localStoreTheme;
    }

    const dataVersion = resolveDataVersionFromCoeffect(localStoreDataVersion);
    draftDb.appDataVersion = dataVersion;

    draftDb.basesList = Array.isArray(localStoreBases) ? localStoreBases : [];
    draftDb.energyGroups = Array.isArray(localStoreEnergyGroups) ? localStoreEnergyGroups : [];

    return [
        [EFFECT_IDS.SET_THEME, draftDb.uiTheme],
        [EFFECT_IDS.LOAD_GAME_DATA, dataVersion],
    ];
}, [[EFFECT_IDS.GET_THEME], [EFFECT_IDS.GET_DATA_VERSION], [EFFECT_IDS.GET_BASES], [EFFECT_IDS.GET_ENERGY_GROUPS]]);

regEvent(EVENT_IDS.ITEMS_SET_SELECTED_CATEGORY, ({ draftDb }, category: string) => {
    draftDb.itemsSelectedCategory = category;
});

regEvent(EVENT_IDS.ITEMS_SET_SELECTED_BUILDING, ({ draftDb }, building: string) => {
    draftDb.itemsSelectedBuilding = building;
});

regEvent(EVENT_IDS.ITEMS_SET_SEARCH_TERM, ({ draftDb }, searchTerm: string) => {
    draftDb.itemsSearchTerm = searchTerm;
});

regEvent(EVENT_IDS.UI_SET_ACTIVE_TAB, ({ draftDb }, newTab: TabType) => {
    draftDb.uiActiveTab = newTab;
});

regEvent(EVENT_IDS.PLANNER_OPEN_ITEM, ({ draftDb }, itemId: string, corporationLevel?: CorporationLevelSelection) => {
    draftDb.plannerSelectedItemId = itemId;
    draftDb.plannerSelectedCorporationLevel = corporationLevel || null;
    draftDb.plannerRecipeSelections = {};
    draftDb.uiActiveTab = 'planner';
    setTargetAmountToDefault(draftDb as AppState, itemId);
});

regEvent(EVENT_IDS.PLANNER_SET_SELECTED_ITEM, ({ draftDb }, itemId: string | null) => {
    draftDb.plannerSelectedItemId = itemId;
    // Reset corporation level when item changes
    draftDb.plannerSelectedCorporationLevel = null;
    draftDb.plannerRecipeSelections = {};
    setTargetAmountToDefault(draftDb as AppState, itemId || '');
});

regEvent(EVENT_IDS.PLANNER_SET_SELECTED_CORPORATION_LEVEL, ({ draftDb }, corporationLevel: CorporationLevelSelection | null) => {
    draftDb.plannerSelectedCorporationLevel = corporationLevel;
});

regEvent(EVENT_IDS.PLANNER_SET_RECIPE_SELECTION, ({ draftDb }, itemId: string, recipeKey: string | null) => {
    if (!itemId) return;
    if (!recipeKey) {
        delete draftDb.plannerRecipeSelections[itemId];
        return;
    }
    draftDb.plannerRecipeSelections[itemId] = recipeKey;
});

regEvent(EVENT_IDS.APP_REQUEST_LOAD_GAME_DATA, ({ draftDb }, version: DataVersion) => {
    if (version === draftDb.appDataVersion) return;
    if (draftDb.uiGameDataLoadPending) return;

    draftDb.uiGameDataLoadPending = true;
    return [[EFFECT_IDS.LOAD_GAME_DATA, version]];
});

regEvent(EVENT_IDS.APP_GAME_DATA_LOAD_FAILED, ({ draftDb }) => {
    draftDb.uiGameDataLoadPending = false;
});

regEvent(EVENT_IDS.APP_SET_DATA_VERSION, ({ draftDb }, version: DataVersion, bundle?: AppVersionedGameData) => {
    if (bundle) {
        draftDb.appVersionedData[version] = bundle;
    }

    if (!draftDb.appVersionedData[version]) {
        return;
    }

    const versionChanged = draftDb.appDataVersion !== version;
    updateDraftDbWithVersionData(draftDb as AppState, version);

    if (bundle !== undefined) {
        draftDb.uiGameDataLoadPending = false;
    }

    // Persist when switching version, or when hydrating (bundle present) so first visit writes localStorage.
    if (versionChanged || bundle !== undefined) {
        return [[EFFECT_IDS.SET_DATA_VERSION, version]];
    }
    return undefined;
});

regEvent(EVENT_IDS.PLANNER_SET_TARGET_AMOUNT, ({ draftDb }, targetAmount: number) => {
    draftDb.plannerTargetAmount = targetAmount;
});

//===============================================
// Base management
//===============================================

regEvent(EVENT_IDS.BASES_CREATE_BASE, ({ draftDb }, name: string) => {
    const baseId = createEntityId('base');
    
    const newBase: Base = {
        id: baseId,
        name,
        buildings: [],
        productions: [],
    };
    
    draftDb.basesList.push(newBase);
    draftDb.basesSelectedBaseId = baseId;
    
    return [persistBasesEffect(draftDb as AppState)];
});

regEvent(EVENT_IDS.BASES_UPDATE_BASE_NAME, ({ draftDb }, baseId: string, newName: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.name = newName;
        return [persistBasesEffect(draftDb as AppState)];
    }
});

regEvent(EVENT_IDS.BASES_SET_CORE_LEVEL, ({ draftDb }, level: number) => {
    const baseId = draftDb.basesSelectedBaseId;
    if (!baseId) return;
    
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.coreLevel = level;
        return [persistBasesEffect(draftDb as AppState)];
    }
});

regEvent(EVENT_IDS.BASES_DELETE_BASE, ({ draftDb }, baseId: string) => {
    draftDb.basesList = draftDb.basesList.filter((b: Base) => b.id !== baseId);
    if (draftDb.basesSelectedBaseId === baseId) {
        draftDb.basesSelectedBaseId = null;
    }
    return [persistBasesEffect(draftDb as AppState)];
});

regEvent(EVENT_IDS.BASES_SET_SELECTED_BASE, ({ draftDb }, baseId: string | null) => {
    draftDb.basesSelectedBaseId = baseId;
});

interface CreateBaseBuildingOptions {
    buildingTypeId: string;
    sectionType: string;
    name?: string;
    description?: string;
    selectedItemId?: string;
    ratePerMinute?: number;
    linkedOutput?: BaseBuilding['linkedOutput'];
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
    };
}

function getLinkedInputBuildingTypeId(buildings: Building[]): string | undefined {
    const packageReceiver = buildings.find((building) => building.id === 'package_receiver');
    if (packageReceiver) return packageReceiver.id;

    const fallback = buildings.find((building) =>
        isBuildingAvailableForSection(building, 'inputs') && !isRawExtractor(building)
    );
    return fallback?.id;
}

function getConfiguredOutputBuilding(base: Base, outputBuildingId: string): BaseBuilding | undefined {
    return base.buildings.find((building: BaseBuilding) =>
        building.id === outputBuildingId &&
        building.sectionType === 'outputs' &&
        !!building.selectedItemId &&
        !!building.ratePerMinute &&
        building.ratePerMinute > 0
    );
}

regEvent(EVENT_IDS.BASES_ADD_BUILDING, ({ draftDb }, baseId: string, buildingTypeId: string, sectionType: string, name?: string, description?: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.buildings.push(createBaseBuilding({ buildingTypeId, sectionType, name, description }));
        return [persistBasesEffect(draftDb as AppState)];
    }
});

regEvent(
    EVENT_IDS.BASES_ADD_BUILDINGS,
    (
        { draftDb },
        baseId: string,
        buildingTypeId: string,
        sectionType: string,
        count: number,
        name?: string,
        description?: string,
        selectedItemId?: string | null,
        ratePerMinute?: number | null,
        linkedOutput?: BaseBuilding['linkedOutput'] | null
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

        for (let index = 0; index < normalizedCount; index += 1) {
            base.buildings.push(
                createBaseBuilding({
                    buildingTypeId,
                    sectionType,
                    name,
                    description,
                    selectedItemId: selectedItemId || undefined,
                    ratePerMinute: normalizedRatePerMinute,
                    linkedOutput: normalizedLinkedOutput,
                })
            );
        }

        return [persistBasesEffect(draftDb as AppState)];
    }
);

regEvent(EVENT_IDS.BASES_SET_BUILDING_SECTION_TYPE_COUNT, ({ draftDb }, baseId: string, buildingTypeId: string, sectionType: BuildingSectionType, rawTargetCount: number) => {
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

    return [persistBasesEffect(draftDb as AppState)];
});

regEvent(EVENT_IDS.BASES_REMOVE_BUILDING, ({ draftDb }, buildingId: string) => {
    const baseId = draftDb.basesSelectedBaseId;
    if (!baseId) return;
    
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.buildings = base.buildings.filter((b: BaseBuilding) => b.id !== buildingId);
        return [persistBasesEffect(draftDb as AppState)];
    }
});

regEvent(EVENT_IDS.BASES_UPDATE_BUILDING_ITEM_SELECTION, ({ draftDb }, baseId: string, buildingId: string, itemId: string | null, ratePerMinute: number | null) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        const building = base.buildings.find((b: BaseBuilding) => b.id === buildingId);
        if (building) {
            if (itemId && ratePerMinute) {
                building.selectedItemId = itemId;
                building.ratePerMinute = ratePerMinute;
                building.linkedOutput = undefined;
            } else {
                building.selectedItemId = undefined;
                building.ratePerMinute = undefined;
                building.linkedOutput = undefined;
            }
            return [persistBasesEffect(draftDb as AppState)];
        }
    }
});

regEvent(EVENT_IDS.BASES_UPDATE_BUILDING_LINKED_OUTPUT, ({ draftDb }, baseId: string, buildingId: string, sourceBaseId: string, sourceOutputBuildingId: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    const sourceBase = getBaseById(draftDb.basesList, sourceBaseId);
    if (!base || !sourceBase) return;

    const inputBuilding = base.buildings.find((building: BaseBuilding) => building.id === buildingId);
    if (!inputBuilding || inputBuilding.sectionType !== 'inputs') return;

    const inputBuildingType = draftDb.buildingsList.find((building: Building) => building.id === inputBuilding.buildingTypeId);
    if (!inputBuildingType || isRawExtractor(inputBuildingType)) return;

    const sourceOutput = getConfiguredOutputBuilding(sourceBase, sourceOutputBuildingId);
    if (!sourceOutput?.selectedItemId || !sourceOutput.ratePerMinute) return;

    inputBuilding.selectedItemId = sourceOutput.selectedItemId;
    inputBuilding.ratePerMinute = sourceOutput.ratePerMinute;
    inputBuilding.linkedOutput = {
        baseId: sourceBaseId,
        buildingId: sourceOutputBuildingId,
        itemIdSnapshot: sourceOutput.selectedItemId,
        ratePerMinuteSnapshot: sourceOutput.ratePerMinute,
    };

    return [persistBasesEffect(draftDb as AppState)];
});

//===============================================
// Energy Groups
//===============================================

regEvent(EVENT_IDS.ENERGY_GROUP_CREATE, ({ draftDb }, rawName: string, assignBaseId?: string) => {
    const normalizedName = normalizeEnergyGroupName(rawName);
    if (!normalizedName) return;

    const existingGroup = findEnergyGroupByName(draftDb.energyGroups, normalizedName);
    const targetGroup = existingGroup ?? {
        id: createEntityId('eg'),
        name: normalizedName,
    };

    let changed = false;
    if (!existingGroup) {
        draftDb.energyGroups.push(targetGroup);
        changed = true;
    }

    if (!assignBaseId) {
        return changed ? [persistEnergyGroupsEffect(draftDb as AppState)] : undefined;
    }

    const base = getBaseById(draftDb.basesList, assignBaseId);
    if (!base) {
        return changed ? [persistEnergyGroupsEffect(draftDb as AppState)] : undefined;
    }

    if (base.energyGroupId !== targetGroup.id) {
        base.energyGroupId = targetGroup.id;
        changed = true;
    }

    return changed
        ? (existingGroup ? [persistBasesEffect(draftDb as AppState)] : [persistBasesEffect(draftDb as AppState), persistEnergyGroupsEffect(draftDb as AppState)])
        : undefined;
});

regEvent(EVENT_IDS.ENERGY_GROUP_DELETE, ({ draftDb }, groupId: string) => {
    const hasGroup = draftDb.energyGroups.some((group: EnergyGroup) => group.id === groupId);
    if (!hasGroup) return;

    draftDb.energyGroups = draftDb.energyGroups.filter((g: EnergyGroup) => g.id !== groupId);

    draftDb.basesList.forEach((base: Base) => {
        if (base.energyGroupId === groupId) {
            base.energyGroupId = undefined;
        }
    });

    return [persistBasesEffect(draftDb as AppState), persistEnergyGroupsEffect(draftDb as AppState)];
});

regEvent(EVENT_IDS.ENERGY_GROUP_RENAME, ({ draftDb }, groupId: string, rawName: string) => {
    const group = draftDb.energyGroups.find((g: EnergyGroup) => g.id === groupId);
    if (!group) return;

    const normalizedName = normalizeEnergyGroupName(rawName);
    if (!normalizedName) return;

    const duplicateByName = draftDb.energyGroups.find((candidate: EnergyGroup) => {
        return candidate.id !== groupId && normalizeEnergyGroupName(candidate.name).toLowerCase() === normalizedName.toLowerCase();
    });
    if (duplicateByName) return;

    if (group.name === normalizedName) return;
    group.name = normalizedName;
    return [persistEnergyGroupsEffect(draftDb as AppState)];
});

regEvent(EVENT_IDS.BASES_SET_ENERGY_GROUP, ({ draftDb }, baseId: string, groupId: string | null) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    if (!groupId) {
        if (!base.energyGroupId) return;
        base.energyGroupId = undefined;
        return [persistBasesEffect(draftDb as AppState)];
    }

    const groupExists = draftDb.energyGroups.some((group: EnergyGroup) => group.id === groupId);
    if (!groupExists || base.energyGroupId === groupId) return;

    base.energyGroupId = groupId;
    return [persistBasesEffect(draftDb as AppState)];
});

//===============================================
//  PRODUCTION PLAN SECTIONS
//===============================================

/** Production Plan Section events */

regEvent(EVENT_IDS.PRODUCTION_PLAN_ACTIVATE_SECTION, ({ draftDb }, baseId: string, sectionId: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    const section = base.productions.find((s: Production) => s.id === sectionId);
    if (!section) return;

    section.active = true;
    section.status = 'active';

    return [persistBasesEffect(draftDb as AppState)];
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_DEACTIVATE_SECTION, ({ draftDb }, baseId: string, sectionId: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        const section = base.productions.find((s: Production) => s.id === sectionId);
        if (section) {
            section.active = false;
            section.status = 'inactive';
            return [persistBasesEffect(draftDb as AppState)];
        }
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_DELETE_SECTION, ({ draftDb }, baseId: string, sectionId: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.productions = base.productions.filter((s: Production) => s.id !== sectionId);
        return [persistBasesEffect(draftDb as AppState)];
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, ({ draftDb }, baseId: string, planId: string, flag: 'all' | 'missing') => {
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
        if (buildingId === 'orbital_cargo_launcher' && plan.selectedItemId) {
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

    return [persistBasesEffect(draftDb as AppState)];
});

/** Create Production Plan Modal events */

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_OPEN, ({ draftDb }, editSectionId?: string | null) => {
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
            recipeSelections: {},
            matchInputs: false,
        };
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_CLOSE, ({ draftDb }) => {
    draftDb.productionPlanModalState = {
        isOpen: false,
        baseId: null,
        editSectionId: null,
        name: '',
        selectedItemId: '',
        targetAmount: 60,
        selectedCorporationLevel: null,
        selectedInputIds: [],
        recipeSelections: {},
        matchInputs: false,
    };
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SUBMIT, ({ draftDb }) => {
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

    return [persistBasesEffect(draftDb as AppState)];
});

/** Production Plan Modal Form events */

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_NAME, ({ draftDb }, name: string) => {
    draftDb.productionPlanModalState.name = name;
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, ({ draftDb }, itemId: string) => {
    draftDb.productionPlanModalState.selectedItemId = itemId;
    draftDb.productionPlanModalState.selectedCorporationLevel = null;
    draftDb.productionPlanModalState.recipeSelections = {};

    if (itemId) {
        draftDb.productionPlanModalState.targetAmount = getSlowestOutputRateForItem(
            draftDb.buildingsList,
            itemId
        );
        applyMatchInputs(draftDb as AppState);
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, ({ draftDb }, itemId: string, recipeKey: string | null) => {
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

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, ({ draftDb }, amount: number) => {
    if (draftDb.productionPlanModalState.matchInputs) return;
    draftDb.productionPlanModalState.targetAmount = amount;
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, ({ draftDb }, enabled: boolean) => {
    draftDb.productionPlanModalState.matchInputs = enabled;
    if (enabled) {
        applyMatchInputs(draftDb as AppState);
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, ({ draftDb }, level: CorporationLevelSelection | null) => {
    draftDb.productionPlanModalState.selectedCorporationLevel = level;
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, ({ draftDb }, baseBuildingId: string) => {
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

regEvent(
    EVENT_IDS.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    (
        { draftDb },
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

    const sourceOutput = getConfiguredOutputBuilding(sourceBase, sourceOutputBuildingId);
    if (!sourceOutput?.selectedItemId || !sourceOutput.ratePerMinute) return;

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
        selectedItemId: sourceOutput.selectedItemId,
        ratePerMinute: sourceOutput.ratePerMinute,
        linkedOutput: {
            baseId: sourceBaseId,
            buildingId: sourceOutputBuildingId,
            itemIdSnapshot: sourceOutput.selectedItemId,
            ratePerMinuteSnapshot: sourceOutput.ratePerMinute,
        },
    });

    if (!existingLinkedInput) {
        targetBase.buildings.push(linkedInput);
    }

    if (!modalState.selectedInputIds.includes(linkedInput.id)) {
        modalState.selectedInputIds.push(linkedInput.id);
    }

    const selectedInputBuildings = getSelectedFlowInputBuildings(targetBase, modalState.selectedInputIds || [], draftDb.basesList);
    modalState.recipeSelections = sanitizeRecipeSelectionsForInputItems(modalState.recipeSelections, selectedInputBuildings);
    applyMatchInputs(draftDb as AppState);

    return [persistBasesEffect(draftDb as AppState)];
});
