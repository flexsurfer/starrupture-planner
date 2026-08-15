import type { PersistKey } from '@ukladjs/persist';
import type { AppState } from './db';
import { normalizeBases } from './legacy/bases-storage';
import { normalizePinnedRecipeSelections } from './legacy/pinned-recipes-storage';
import { normalizeRecipePresets } from './legacy/recipe-presets-storage';

/** Durable roots and their boundary validation for Uklad persistence. */
export const PERSIST_KEYS = [
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
