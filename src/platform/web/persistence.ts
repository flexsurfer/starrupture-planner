import type { PersistKey } from '@ukladjs/persist';
import type { AppState } from '@/app/uklad/model';
import { stateKeys } from '@/app/uklad/catalog';
import { normalizePlannerActiveTabId, normalizePlannerTabs } from './planner-tabs-storage';
import { normalizeBases } from './legacy-storage/bases-storage';
import { normalizePinnedRecipeSelections } from './legacy-storage/pinned-recipes-storage';
import { normalizeRecipePresets } from './legacy-storage/recipe-presets-storage';

/** Durable roots and their boundary validation for Uklad persistence. */
export const PERSIST_KEYS = [
    { key: stateKeys.basesDetailsExpanded, deserialize: (value: unknown) => typeof value === 'boolean' ? value : true },
    { key: stateKeys.plannerTabs, deserialize: normalizePlannerTabs },
    { key: stateKeys.plannerActiveTabId, deserialize: normalizePlannerActiveTabId },
    'uiTheme',
    'appDataVersion',
    {
        key: 'basesList',
        deserialize: normalizeBases,
    },
    'energyGroups',
    {
        key: 'pinnedRecipeSelections',
        deserialize: normalizePinnedRecipeSelections,
    },
    {
        key: 'recipeAlternativePresets',
        deserialize: normalizeRecipePresets,
    },
] as const satisfies readonly PersistKey<AppState>[];
