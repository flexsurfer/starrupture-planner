import { regEvent } from '@flexsurfer/reflex';
import { EVENT_IDS } from './event-ids';
import { EFFECT_IDS } from './effect-ids';

regEvent(EVENT_IDS.INIT_APP, ({ draftDb, localStoreTheme }) => {
    if (localStoreTheme) {
        draftDb.theme = localStoreTheme;
    }
    return [[EFFECT_IDS.SET_THEME, draftDb.theme]];
}, [[EFFECT_IDS.GET_THEME]]);

regEvent(EVENT_IDS.SET_CATEGORY, ({ draftDb }, category: string) => {
    draftDb.selectedCategory = category;
});

regEvent(EVENT_IDS.SET_THEME, ({ draftDb }, newTheme: 'light' | 'dark') => {
    draftDb.theme = newTheme;
    return [[EFFECT_IDS.SET_THEME, newTheme]];
});

regEvent(EVENT_IDS.SET_ACTIVE_TAB, ({ draftDb }, newTab: 'items' | 'buildings' | 'recipes' | 'planner') => {
    draftDb.activeTab = newTab;
});