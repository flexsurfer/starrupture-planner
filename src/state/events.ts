import { regEvent } from '@flexsurfer/reflex';
import { EVENT_IDS } from './event-ids';
import { EFFECT_IDS } from './effect-ids';
import type { TabType, DataVersion, Item, Building, Level } from './db';
import { buildItemsMap, buildLevelsMap, parseCorporations, extractCategories } from './data-utils';

// Common function to update draftDb with version data
function updateDraftDbWithVersionData(draftDb: any, version: DataVersion) {
    const data = draftDb.versionedData[version];
    const items = data.items as Item[];
    const buildings = data.buildings as Building[];
    const levels = data.levels as Level[];
    const corporations = parseCorporations(data.corporations);

    draftDb.dataVersion = version;
    draftDb.items = items;
    draftDb.itemsMap = buildItemsMap(items);
    draftDb.buildings = buildings;
    draftDb.corporations = corporations;
    draftDb.levels = levels;
    draftDb.levelsMap = buildLevelsMap(levels);
    draftDb.categories = extractCategories(items);
}

regEvent(EVENT_IDS.INIT_APP, ({ draftDb, localStoreTheme, localStoreDataVersion }) => {
    if (localStoreTheme) {
        draftDb.theme = localStoreTheme;
    }
    
    // Load saved data version if valid
    if (localStoreDataVersion && (localStoreDataVersion === 'earlyaccess' || localStoreDataVersion === 'playtest')) {
        updateDraftDbWithVersionData(draftDb, localStoreDataVersion);
    }
    
    return [[EFFECT_IDS.SET_THEME, draftDb.theme]];
}, [[EFFECT_IDS.GET_THEME], [EFFECT_IDS.GET_DATA_VERSION]]);

regEvent(EVENT_IDS.SET_CATEGORY, ({ draftDb }, category: string) => {
    draftDb.selectedCategory = category;
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

regEvent(EVENT_IDS.OPEN_ITEM_IN_PLANNER, ({ draftDb }, itemId: string) => {
    draftDb.selectedPlannerItem = itemId;
    draftDb.activeTab = 'planner';
});

regEvent(EVENT_IDS.SET_DATA_VERSION, ({ draftDb }, version: DataVersion) => {
    if (draftDb.dataVersion === version) return;

    updateDraftDbWithVersionData(draftDb, version);

    return [[EFFECT_IDS.SET_DATA_VERSION, version]];
});
