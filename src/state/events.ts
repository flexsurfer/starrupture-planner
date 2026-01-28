import { regEvent, current } from '@flexsurfer/reflex';
import { EVENT_IDS } from './event-ids';
import { EFFECT_IDS } from './effect-ids';
import type { TabType, DataVersion, Item, Building, AppState, Base, BaseBuilding, Core, ProductionPlanSection } from './db';
import { buildItemsMap, parseCorporations, extractCategories } from './data-utils';
import { buildProductionFlow } from '../components/planner/core/productionFlowBuilder';
import type { Building as PlannerBuilding } from '../components/planner/core/types';
import { getSectionTypeForBuilding } from '../components/mybases/utils';

// Common function to update draftDb with version data
function updateDraftDbWithVersionData(draftDb: AppState, version: DataVersion) {
    const data = draftDb.versionedData[version];
    const items = data.items as Item[];
    const buildings = data.buildings as Building[];
    const corporations = parseCorporations(data.corporations);

    draftDb.dataVersion = version;
    draftDb.items = items;
    draftDb.itemsMap = buildItemsMap(items);
    draftDb.buildings = buildings;
    draftDb.corporations = corporations;
    draftDb.categories = extractCategories(items);
}

// Helper function to set target amount to default output rate for an item
function setTargetAmountToDefault(draftDb: AppState, itemId: string) {
    // Find the default output rate for the item (same logic as usePlannerDefaultOutput)
    for (const building of draftDb.buildings) {
        for (const recipe of building.recipes || []) {
            if (recipe.output.id === itemId) {
                draftDb.targetAmount = recipe.output.amount_per_minute;
                return;
            }
        }
    }
    // fallback if not found
    draftDb.targetAmount = 60;
}

/**
 * Validates and normalizes bases data loaded from localStorage.
 * 
 * WHY THIS IS NEEDED:
 * Even though our app always saves valid data, we cannot trust localStorage because:
 * 1. **Untrusted External Storage**: localStorage can be modified by:
 *    - Browser extensions
 *    - Users via DevTools
 *    - Browser bugs or corruption
 *    - Other tabs/scripts
 *    - Storage quota issues
 * 
 * 2. **No Runtime Type Safety**: TypeScript types are erased at runtime.
 *    JSON.parse() returns `any`, so there's no guarantee the parsed data
 *    matches our Base type structure.
 * 
 * 3. **Schema Evolution**: If the Base type structure changes over time,
 *    old localStorage data may not match the new structure.
 * 
 * 4. **Defensive Programming**: Validating external data prevents crashes
 *    from unexpected data shapes and provides graceful degradation.
 * 
 * HOW IT WORKS:
 * 1. Uses a type guard function to validate each base object structure
 * 2. Checks for required fields (id, name, core, buildings)
 * 3. Validates nested core object structure
 * 4. Ensures buildings is an array
 * 5. Normalizes timestamps (adds missing createdAt/updatedAt with fallback)
 * 6. Filters out any invalid bases, returning only valid ones
 * 
 * @param rawBases - Raw data from localStorage (unknown type, could be anything)
 * @returns Array of validated and normalized Base objects
 */
function validateAndNormalizeBases(rawBases: unknown): Base[] {
    if (!Array.isArray(rawBases)) {
        return [];
    }

    const now = Date.now();
    
    // Type guard: validates that an unknown value is a valid Base structure
    const isValidBase = (base: unknown): base is Base => {
        // Basic structure checks
        if (typeof base !== 'object' || base === null) {
            return false;
        }
        
        // Check required top-level fields exist
        if (!('id' in base) || !('name' in base) || !('core' in base) || !('buildings' in base)) {
            return false;
        }
        
        // Validate id and name are strings
        if (typeof (base as Base).id !== 'string' || typeof (base as Base).name !== 'string') {
            return false;
        }
        
        // Validate core is a non-null object with required fields
        const core = (base as Base).core;
        if (typeof core !== 'object' || core === null) {
            return false;
        }
        if (!('id' in core) || !('baseId' in core)) {
            return false;
        }
        if (typeof (core as Core).id !== 'string' || typeof (core as Core).baseId !== 'string') {
            return false;
        }
        
        // Validate buildings is an array
        if (!Array.isArray((base as Base).buildings)) {
            return false;
        }
        
        return true;
    };
    
    // Filter valid bases and normalize timestamps and productionPlanSections
    return rawBases
        .filter(isValidBase)
        .map((base) => ({
            ...base,
            // Ensure timestamps exist - use current time as fallback for missing values
            // This handles data migration scenarios where timestamps were added later
            createdAt: typeof base.createdAt === 'number' ? base.createdAt : now,
            updatedAt: typeof base.updatedAt === 'number' ? base.updatedAt : now,
            // Ensure productionPlanSections exists - use empty array as fallback for migration
            productionPlanSections: Array.isArray(base.productionPlanSections) ? base.productionPlanSections : [],
        }));
}

regEvent(EVENT_IDS.INIT_APP, ({ draftDb, localStoreTheme, localStoreDataVersion, localStoreBases }) => {
    if (localStoreTheme) {
        draftDb.theme = localStoreTheme;
    }
    
    // Load saved data version if valid
    if (localStoreDataVersion && (localStoreDataVersion === 'earlyaccess' || localStoreDataVersion === 'playtest')) {
        updateDraftDbWithVersionData(draftDb as AppState, localStoreDataVersion);
    }
    
    // Load saved bases if valid
    if (localStoreBases) {
        try {
            // Validate and normalize bases data from localStorage
            // Invalid bases are filtered out, ensuring we only load valid data
            draftDb.bases = validateAndNormalizeBases(localStoreBases);
        } catch (e) {
            console.error('Error loading bases from local storage:', e);
            // On error, keep empty array (don't use potentially corrupted data)
            draftDb.bases = [];
        }
    } else {
        // If no saved bases, ensure we start with empty array
        draftDb.bases = [];
    }
    
    return [[EFFECT_IDS.SET_THEME, draftDb.theme]];
}, [[EFFECT_IDS.GET_THEME], [EFFECT_IDS.GET_DATA_VERSION], [EFFECT_IDS.GET_BASES]]);

regEvent(EVENT_IDS.SET_CATEGORY, ({ draftDb }, category: string) => {
    draftDb.selectedCategory = category;
});

regEvent(EVENT_IDS.SET_SELECTED_BUILDING, ({ draftDb }, building: string) => {
    draftDb.selectedBuilding = building;
});

regEvent(EVENT_IDS.SET_SEARCH_TERM, ({ draftDb }, searchTerm: string) => {
    draftDb.searchTerm = searchTerm;
});

regEvent(EVENT_IDS.SET_THEME, ({ draftDb }, newTheme: 'light' | 'dark') => {
    draftDb.theme = newTheme;
    return [[EFFECT_IDS.SET_THEME, newTheme]];
});

regEvent(EVENT_IDS.SET_ACTIVE_TAB, ({ draftDb }, newTab: TabType) => {
    draftDb.activeTab = newTab;
});

regEvent(EVENT_IDS.OPEN_ITEM_IN_PLANNER, ({ draftDb }, itemId: string, corporationLevel?: { corporationId: string; level: number }) => {
    draftDb.selectedPlannerItem = itemId;
    draftDb.selectedPlannerCorporationLevel = corporationLevel || null;
    draftDb.activeTab = 'planner';
    setTargetAmountToDefault(draftDb as AppState, itemId);
});

regEvent(EVENT_IDS.SET_PLANNER_ITEM, ({ draftDb }, itemId: string | null) => {
    draftDb.selectedPlannerItem = itemId;
    // Reset corporation level when item changes
    draftDb.selectedPlannerCorporationLevel = null;
    setTargetAmountToDefault(draftDb as AppState, itemId || '');
});

regEvent(EVENT_IDS.SET_PLANNER_CORPORATION_LEVEL, ({ draftDb }, corporationLevel: { corporationId: string; level: number } | null) => {
    draftDb.selectedPlannerCorporationLevel = corporationLevel;
});

regEvent(EVENT_IDS.SET_DATA_VERSION, ({ draftDb }, version: DataVersion) => {
    if (draftDb.dataVersion === version) return;

    updateDraftDbWithVersionData(draftDb as AppState, version);

    return [[EFFECT_IDS.SET_DATA_VERSION, version]];
});

regEvent(EVENT_IDS.SET_TARGET_AMOUNT, ({ draftDb }, targetAmount: number) => {
    draftDb.targetAmount = targetAmount;
});

// Base management events
regEvent(EVENT_IDS.CREATE_BASE, ({ draftDb }, name: string) => {
    //TODO there is now coeffect in reflex
    const now = Date.now();
    const baseId = `base_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const coreId = `core_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newBase: Base = {
        id: baseId,
        name,
        core: {
            id: coreId,
            baseId: baseId,
        },
        buildings: [],
        productionPlanSections: [],
        createdAt: now,
        updatedAt: now,
    };
    
    draftDb.bases.push(newBase);
    draftDb.selectedBaseId = baseId;
    
    return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
});

regEvent(EVENT_IDS.UPDATE_BASE_NAME, ({ draftDb }, baseId: string, newName: string) => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (base) {
        base.name = newName;
        base.updatedAt = Date.now();
        return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
    }
});

regEvent(EVENT_IDS.DELETE_BASE, ({ draftDb }, baseId: string) => {
    draftDb.bases = draftDb.bases.filter((b: Base) => b.id !== baseId);
    if (draftDb.selectedBaseId === baseId) {
        draftDb.selectedBaseId = null;
    }
    return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
});

regEvent(EVENT_IDS.SET_SELECTED_BASE, ({ draftDb }, baseId: string | null) => {
    draftDb.selectedBaseId = baseId;
    // Reset to plans tab when switching bases
    if (baseId) {
        draftDb.baseDetailActiveTab = 'plans';
    }
});

regEvent(EVENT_IDS.SET_BASE_DETAIL_ACTIVE_TAB, ({ draftDb }, tab: 'plans' | 'buildings') => {
    draftDb.baseDetailActiveTab = tab;
});

regEvent(EVENT_IDS.ADD_BUILDING_TO_BASE, ({ draftDb }, baseId: string, buildingTypeId: string, sectionType: string) => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (base) {
        const buildingId = `building_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newBuilding: BaseBuilding = {
            id: buildingId,
            baseId: baseId,
            buildingTypeId: buildingTypeId,
            sectionType: sectionType,
        };
        base.buildings.push(newBuilding);
        base.updatedAt = Date.now();
        return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
    }
});

regEvent(EVENT_IDS.REMOVE_BUILDING_FROM_BASE, ({ draftDb }, buildingId: string) => {
    const baseId = draftDb.selectedBaseId;
    if (!baseId) return;
    
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (base) {
        base.buildings = base.buildings.filter((b: BaseBuilding) => b.id !== buildingId);
        base.updatedAt = Date.now();
        return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
    }
});

regEvent(EVENT_IDS.UPDATE_BUILDING_ITEM_SELECTION, ({ draftDb }, baseId: string, buildingId: string, itemId: string | null, ratePerMinute: number | null) => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
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
            base.updatedAt = Date.now();
            return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
        }
    }
});

// Confirmation dialog events
regEvent(EVENT_IDS.SHOW_CONFIRMATION_DIALOG, ({ draftDb }, title: string, message: string, onConfirm: () => void, options?: { confirmLabel?: string; cancelLabel?: string; confirmButtonClass?: string; onCancel?: () => void }) => {
    draftDb.confirmationDialog = {
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

regEvent(EVENT_IDS.CLOSE_CONFIRMATION_DIALOG, ({ draftDb }) => {
    draftDb.confirmationDialog = {};
});

// Production Plan Section events
regEvent(EVENT_IDS.CREATE_PRODUCTION_PLAN_SECTION, ({ draftDb }, baseId: string, name: string, selectedItemId: string, targetAmount: number, corporationLevel?: { corporationId: string; level: number } | null) => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (base) {
        const sectionId = `pps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newSection: ProductionPlanSection = {
            id: sectionId,
            name,
            selectedItemId,
            targetAmount,
            active: false,
            corporationLevel: corporationLevel || null,
        };
        base.productionPlanSections.push(newSection);
        base.updatedAt = Date.now();
        return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
    }
});

regEvent(EVENT_IDS.UPDATE_PRODUCTION_PLAN_SECTION, ({ draftDb }, baseId: string, sectionId: string, name: string, selectedItemId: string, targetAmount: number, corporationLevel?: { corporationId: string; level: number } | null) => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (base) {
        const section = base.productionPlanSections.find((s: ProductionPlanSection) => s.id === sectionId);
        if (section) {
            section.name = name;
            section.selectedItemId = selectedItemId;
            section.targetAmount = targetAmount;
            section.corporationLevel = corporationLevel || null;
            base.updatedAt = Date.now();
            return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
        }
    }
});

regEvent(EVENT_IDS.DELETE_PRODUCTION_PLAN_SECTION, ({ draftDb }, baseId: string, sectionId: string) => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (base) {
        base.productionPlanSections = base.productionPlanSections.filter((s: ProductionPlanSection) => s.id !== sectionId);
        base.updatedAt = Date.now();
        return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
    }
});

regEvent(EVENT_IDS.SHOW_ACTIVATE_PLAN_DIALOG, ({ draftDb }, planName: string, baseId: string, sectionId: string, allRequirementsSatisfied: boolean) => {
    draftDb.activatePlanDialog = {
        isOpen: true,
        planName,
        baseId,
        sectionId,
        allRequirementsSatisfied,
    };
});

regEvent(EVENT_IDS.CLOSE_ACTIVATE_PLAN_DIALOG, ({ draftDb }) => {
    draftDb.activatePlanDialog = {
        isOpen: false,
        planName: '',
        baseId: undefined,
        sectionId: undefined,
    };
});

regEvent(EVENT_IDS.ACTIVATE_PRODUCTION_PLAN_SECTION, ({ draftDb }, baseId: string, sectionId: string, flag: 'addall' | 'missing' | 'dontadd') => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (!base) return;

    const section = base.productionPlanSections.find((s: ProductionPlanSection) => s.id === sectionId);
    if (!section) return;

    // Mark as active first - this happens regardless of flag
    section.active = true;

    // For 'dontadd' flag, skip building addition
    if (flag === 'dontadd') {
        base.updatedAt = Date.now();
        return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
    }

    // Build production flow to determine required buildings
    const validAmount = section.targetAmount > 0 ? section.targetAmount : 1;
    const includeLauncher = section.corporationLevel !== null && section.corporationLevel !== undefined;
    const productionFlow = buildProductionFlow(
        { targetItemId: section.selectedItemId, targetAmount: validAmount },
        draftDb.buildings as PlannerBuilding[],
        draftDb.corporations,
        includeLauncher
    );

    // Build list of required building instances from flow nodes
    // Filter out special nodes (recipeIndex < 0, e.g., orbital_cargo_launcher)
    const requiredBuildings: Array<{ buildingTypeId: string; outputItem: string; outputAmount: number }> = [];
    for (const node of productionFlow.nodes) {
        
        const buildingCount = Math.ceil(node.buildingCount);
        for (let i = 0; i < buildingCount; i++) {
            requiredBuildings.push({
                buildingTypeId: node.buildingId,
                outputItem: node.outputItem,
                outputAmount: node.outputAmount,
            });
        }
    }

    // Helper to create a BaseBuilding with unique ID
    // Uses counter to ensure uniqueness when creating multiple buildings in same millisecond
    let buildingCounter = 0;
    const createBaseBuilding = (
        buildingTypeId: string,
        outputItem: string,
        outputAmount: number
    ): BaseBuilding => {
        const building = draftDb.buildings.find((b: Building) => b.id === buildingTypeId);
        const sectionType = building ? getSectionTypeForBuilding(building) : 'production';
        const buildingId = `building_${Date.now()}_${buildingCounter++}_${Math.random().toString(36).substr(2, 9)}`;
        return {
            id: buildingId,
            baseId,
            buildingTypeId,
            sectionType,
            selectedItemId: outputItem,
            ratePerMinute: outputAmount,
        };
    };

    if (flag === 'addall') {
        // Add all required buildings
        for (const { buildingTypeId, outputItem, outputAmount } of requiredBuildings) {
            base.buildings.push(createBaseBuilding(buildingTypeId, outputItem, outputAmount));
        }
    } else if (flag === 'missing') {
        // Count existing buildings by type
        const existingCountByType = new Map<string, number>();
        for (const baseBuilding of base.buildings) {
            const count = existingCountByType.get(baseBuilding.buildingTypeId) || 0;
            existingCountByType.set(baseBuilding.buildingTypeId, count + 1);
        }

        // Count how many of each building type we need
        const requiredCountByType = new Map<string, number>();
        for (const { buildingTypeId } of requiredBuildings) {
            const count = requiredCountByType.get(buildingTypeId) || 0;
            requiredCountByType.set(buildingTypeId, count + 1);
        }

        // Calculate how many of each type are missing
        const missingCountByType = new Map<string, number>();
        for (const [buildingTypeId, requiredCount] of requiredCountByType) {
            const existingCount = existingCountByType.get(buildingTypeId) || 0;
            const missingCount = Math.max(0, requiredCount - existingCount);
            if (missingCount > 0) {
                missingCountByType.set(buildingTypeId, missingCount);
            }
        }

        // Add only the missing buildings, tracking how many we've added
        const addedCountByType = new Map<string, number>();
        for (const { buildingTypeId, outputItem, outputAmount } of requiredBuildings) {
            const missingCount = missingCountByType.get(buildingTypeId) || 0;
            const addedCount = addedCountByType.get(buildingTypeId) || 0;

            // Only add if we still have missing buildings of this type
            if (addedCount < missingCount) {
                base.buildings.push(createBaseBuilding(buildingTypeId, outputItem, outputAmount));
                addedCountByType.set(buildingTypeId, addedCount + 1);
            }
        }
    }

    base.updatedAt = Date.now();
    return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
});

regEvent(EVENT_IDS.DEACTIVATE_PRODUCTION_PLAN_SECTION, ({ draftDb }, baseId: string, sectionId: string) => {
    const base = draftDb.bases.find((b: Base) => b.id === baseId);
    if (base) {
        const section = base.productionPlanSections.find((s: ProductionPlanSection) => s.id === sectionId);
        if (section) {
            section.active = false;
            base.updatedAt = Date.now();
            return [[EFFECT_IDS.SET_BASES, current(draftDb.bases)]];
        }
    }
});

