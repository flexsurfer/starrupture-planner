import { regEvent } from '@flexsurfer/reflex';
import { EVENT_IDS } from './event-ids';
import { EFFECT_IDS } from './effect-ids';
import type { TabType, DataVersion, Item, Building, AppState } from './db';
import { buildItemsMap, parseCorporations, extractCategories } from './data-utils';

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
        for (const recipe of building.recipes) {
            if (recipe.output.id === itemId) {
                draftDb.targetAmount = recipe.output.amount_per_minute;
                return;
            }
        }
    }
    // fallback if not found
    draftDb.targetAmount = 60;
}

regEvent(EVENT_IDS.INIT_APP, ({ draftDb, localStoreTheme, localStoreDataVersion }) => {
    if (localStoreTheme) {
        draftDb.theme = localStoreTheme;
    }
    
    // Load saved data version if valid
    if (localStoreDataVersion && (localStoreDataVersion === 'earlyaccess' || localStoreDataVersion === 'playtest')) {
        updateDraftDbWithVersionData(draftDb as AppState, localStoreDataVersion);
    }
    
    return [[EFFECT_IDS.SET_THEME, draftDb.theme]];
}, [[EFFECT_IDS.GET_THEME], [EFFECT_IDS.GET_DATA_VERSION]]);

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
