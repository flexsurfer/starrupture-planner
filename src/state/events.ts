import { regEvent, current } from '@flexsurfer/reflex';
import { EVENT_IDS } from './event-ids';
import { EFFECT_IDS } from './effect-ids';
import type {
    TabType,
    DataVersion,
    Item,
    Building,
    AppState,
    Base,
    BaseBuilding,
    Production,
    PlanRequiredBuilding,
    CorporationLevelSelection,
} from './db';
import { buildItemsMap, parseCorporations, extractCategories } from './data-utils';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import type { ProductionFlowResult } from '../components/planner/core/types';
import { getSectionTypeForBuilding, buildActivePlanOccupancy } from '../components/mybases/utils';
import { getProductionInputIds, getSelectedFlowInputBuildings } from '../utils/productionPlanInputs';

// Common function to update draftDb with version data
function updateDraftDbWithVersionData(draftDb: AppState, version: DataVersion) {
    const data = draftDb.appVersionedData[version];
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

// Helper function to set target amount to default output rate for an item
function setTargetAmountToDefault(draftDb: AppState, itemId: string) {
    // Find the default output rate for the item (same logic as usePlannerDefaultOutput)
    for (const building of draftDb.buildingsList) {
        for (const recipe of building.recipes || []) {
            if (recipe.output.id === itemId) {
                draftDb.plannerTargetAmount = recipe.output.amount_per_minute;
                return;
            }
        }
    }
    // fallback if not found
    draftDb.plannerTargetAmount = 60;
}

/**
 * Aggregates the building requirements from a production flow.
 * Stored on the plan so that subscriptions can check requirements
 * without recomputing the full flow.
 */
function computeRequiredBuildings(flow: ProductionFlowResult): PlanRequiredBuilding[] {
    const map = new Map<string, PlanRequiredBuilding>();
    flow.nodes.forEach(node => {
        if (node.isCustomInput) return;
        const existing = map.get(node.buildingId);
        if (existing) {
            existing.count += Math.ceil(node.buildingCount);
        } else {
            map.set(node.buildingId, {
                buildingId: node.buildingId,
                count: Math.ceil(node.buildingCount),
            });
        }
    });
    return Array.from(map.values());
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

/** Initialization event */
regEvent(EVENT_IDS.APP_INIT, ({ draftDb, localStoreTheme, localStoreDataVersion, localStoreBases }) => {
    if (localStoreTheme) {
        draftDb.uiTheme = localStoreTheme;
    }
    
    // Load saved data version if valid
    if (localStoreDataVersion && (localStoreDataVersion === 'earlyaccess' || localStoreDataVersion === 'playtest')) {
        updateDraftDbWithVersionData(draftDb as AppState, localStoreDataVersion);
    }
    
    draftDb.basesList = Array.isArray(localStoreBases) ? localStoreBases : [];

    return [[EFFECT_IDS.SET_THEME, draftDb.uiTheme]];
}, [[EFFECT_IDS.GET_THEME], [EFFECT_IDS.GET_DATA_VERSION], [EFFECT_IDS.GET_BASES]]);

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
    draftDb.uiActiveTab = 'planner';
    setTargetAmountToDefault(draftDb as AppState, itemId);
});

regEvent(EVENT_IDS.PLANNER_SET_SELECTED_ITEM, ({ draftDb }, itemId: string | null) => {
    draftDb.plannerSelectedItemId = itemId;
    // Reset corporation level when item changes
    draftDb.plannerSelectedCorporationLevel = null;
    setTargetAmountToDefault(draftDb as AppState, itemId || '');
});

regEvent(EVENT_IDS.PLANNER_SET_SELECTED_CORPORATION_LEVEL, ({ draftDb }, corporationLevel: CorporationLevelSelection | null) => {
    draftDb.plannerSelectedCorporationLevel = corporationLevel;
});

regEvent(EVENT_IDS.APP_SET_DATA_VERSION, ({ draftDb }, version: DataVersion) => {
    if (draftDb.appDataVersion === version) return;

    updateDraftDbWithVersionData(draftDb as AppState, version);

    return [[EFFECT_IDS.SET_DATA_VERSION, version]];
});

regEvent(EVENT_IDS.PLANNER_SET_TARGET_AMOUNT, ({ draftDb }, targetAmount: number) => {
    draftDb.plannerTargetAmount = targetAmount;
});

//===============================================
// Base management
//===============================================

regEvent(EVENT_IDS.BASES_CREATE_BASE, ({ draftDb }, name: string) => {
    //TODO there is "now" coeffect in reflex
    const baseId = `base_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newBase: Base = {
        id: baseId,
        name,
        buildings: [],
        productions: [],
    };
    
    draftDb.basesList.push(newBase);
    draftDb.basesSelectedBaseId = baseId;
    
    return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
});

regEvent(EVENT_IDS.BASES_UPDATE_BASE_NAME, ({ draftDb }, baseId: string, newName: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.name = newName;
        return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
    }
});

regEvent(EVENT_IDS.BASES_SET_CORE_LEVEL, ({ draftDb }, level: number) => {
    const baseId = draftDb.basesSelectedBaseId;
    if (!baseId) return;
    
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.coreLevel = level;
        return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
    }
});

regEvent(EVENT_IDS.BASES_DELETE_BASE, ({ draftDb }, baseId: string) => {
    draftDb.basesList = draftDb.basesList.filter((b: Base) => b.id !== baseId);
    if (draftDb.basesSelectedBaseId === baseId) {
        draftDb.basesSelectedBaseId = null;
    }
    return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
});

regEvent(EVENT_IDS.BASES_SET_SELECTED_BASE, ({ draftDb }, baseId: string | null) => {
    draftDb.basesSelectedBaseId = baseId;
});

/** Creates a new BaseBuilding object with a unique ID. */
function createBaseBuilding(buildingTypeId: string, sectionType: string): BaseBuilding {
    return {
        id: `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        buildingTypeId,
        sectionType,
    };
}

regEvent(EVENT_IDS.BASES_ADD_BUILDING, ({ draftDb }, baseId: string, buildingTypeId: string, sectionType: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.buildings.push(createBaseBuilding(buildingTypeId, sectionType));
        return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
    }
});

regEvent(EVENT_IDS.BASES_REMOVE_BUILDING, ({ draftDb }, buildingId: string) => {
    const baseId = draftDb.basesSelectedBaseId;
    if (!baseId) return;
    
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.buildings = base.buildings.filter((b: BaseBuilding) => b.id !== buildingId);
        return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
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
            } else {
                building.selectedItemId = undefined;
                building.ratePerMinute = undefined;
            }
            return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
        }
    }
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

    return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_DEACTIVATE_SECTION, ({ draftDb }, baseId: string, sectionId: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        const section = base.productions.find((s: Production) => s.id === sectionId);
        if (section) {
            section.active = false;
            section.status = 'inactive';
            return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
        }
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_DELETE_SECTION, ({ draftDb }, baseId: string, sectionId: string) => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (base) {
        base.productions = base.productions.filter((s: Production) => s.id !== sectionId);
        return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, ({ draftDb }, baseId: string, planId: string, flag: 'all' | 'missing') => {
    const base = getBaseById(draftDb.basesList, baseId);
    if (!base) return;

    const plan = base.productions.find((s: Production) => s.id === planId);
    if (!plan) return;

    const requiredBuildings = plan.requiredBuildings || [];
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
        const newBuilding = createBaseBuilding(buildingId, sectionType);
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

    return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
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
    const selectedInputBuildings = getSelectedFlowInputBuildings(base, modal.selectedInputIds || []);
    
    const flow = buildProductionFlow(
        { 
            targetItemId: selectedItemId, 
            targetAmount: validAmount, 
            inputBuildings: selectedInputBuildings,
            rawProductionDisabled: true,
            includeLauncher
        },
        draftDb.buildingsList
    );
    
    // Extract used inputs from the production flow nodes
    const usedInputIdSet = new Set<string>();
    flow.nodes.forEach(node => {
        if (node.isCustomInput && node.baseBuildingId) {
            usedInputIdSet.add(node.baseBuildingId);
        }
    });
    const usedInputSnapshots: BaseBuilding[] = [];
    const baseBuildingsById = new Map<string, BaseBuilding>(
        base.buildings.map((building: BaseBuilding) => [building.id, building])
    );
    const selectedInputBuildingsById = new Map<string, BaseBuilding>(
        selectedInputBuildings.map((building: BaseBuilding) => [building.id, building])
    );
    usedInputIdSet.forEach((baseBuildingId) => {
        const baseBuilding = baseBuildingsById.get(baseBuildingId) || selectedInputBuildingsById.get(baseBuildingId);
        if (baseBuilding) {
            usedInputSnapshots.push({ ...baseBuilding });
        }
    });
    
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
        }
    } else {
        // Create new section
        const sectionId = `pps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        };
        base.productions.push(newSection);
    }

    return [[EFFECT_IDS.SET_BASES, current(draftDb.basesList)]];
});

/** Production Plan Modal Form events */

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_NAME, ({ draftDb }, name: string) => {
    draftDb.productionPlanModalState.name = name;
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, ({ draftDb }, itemId: string) => {
    draftDb.productionPlanModalState.selectedItemId = itemId;
    // Reset corporation level when item changes
    draftDb.productionPlanModalState.selectedCorporationLevel = null;
    
    // Set target amount to default output rate for the item
    if (itemId) {
        for (const building of draftDb.buildingsList) {
            for (const recipe of building.recipes || []) {
                if (recipe.output.id === itemId) {
                    const rate = recipe.output.amount_per_minute;
                    draftDb.productionPlanModalState.targetAmount = rate;
                    return;
                }
            }
        }
    }
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, ({ draftDb }, amount: number) => {
    draftDb.productionPlanModalState.targetAmount = amount;
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL, ({ draftDb }, level: CorporationLevelSelection | null) => {
    draftDb.productionPlanModalState.selectedCorporationLevel = level;
});

regEvent(EVENT_IDS.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, ({ draftDb }, baseBuildingId: string) => {
    const selectedInputIds = draftDb.productionPlanModalState.selectedInputIds;
    const index = selectedInputIds.indexOf(baseBuildingId);
    if (index >= 0) {
        selectedInputIds.splice(index, 1);
    } else {
        selectedInputIds.push(baseBuildingId);
    }
});
