import { regSub } from '@flexsurfer/reflex';
import { SUB_IDS } from './sub-ids';
import type { Item } from './db';

// Root subscriptions
regSub(SUB_IDS.ITEMS);
regSub(SUB_IDS.ITEMS_MAP);
regSub(SUB_IDS.SELECTED_CATEGORY);
regSub(SUB_IDS.CATEGORIES);
regSub(SUB_IDS.BUILDINGS);
regSub(SUB_IDS.THEME);
regSub(SUB_IDS.ACTIVE_TAB);

// Computed subscriptions
regSub(SUB_IDS.FILTERED_ITEMS,
    (category, items) => {
        return category === 'all'
            ? items
            : items.filter((item: Item) => item.type === category);
    },
    () => [[SUB_IDS.SELECTED_CATEGORY], [SUB_IDS.ITEMS]]);
