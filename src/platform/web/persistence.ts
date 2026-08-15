import type { PersistKey } from '@ukladjs/persist';
import type { AppState } from '@/app/uklad/model';
import { normalizeBases } from './legacy-storage/bases-storage';
import { normalizePinnedRecipeSelections } from './legacy-storage/pinned-recipes-storage';
import { normalizeRecipePresets } from './legacy-storage/recipe-presets-storage';

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
