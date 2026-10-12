import { normalizeLocale } from '@/shared/i18n/locales';
import type { PersistData, PersistKey } from '@ukladjs/persist';
import type { AppState } from '@/app/uklad/model';
import { stateKeys } from '@/app/uklad/catalog';
import { normalizePlannerActiveTabId, normalizePlannerTabs } from './planner-tabs-storage';
import { normalizeBases } from './legacy-storage/bases-storage';
import { normalizePinnedRecipeSelections } from './legacy-storage/pinned-recipes-storage';
import { normalizeRecipePresets } from './legacy-storage/recipe-presets-storage';
import { assertSaveStorageLimits, normalizeSaveWorkspaces, normalizeSavesOrder, normalizeSavesActiveId, normalizeSavesSelections } from '@/features/saves/storage-schema';

export const SAVES_PERSIST_ROOTS = [stateKeys.savesWorkspaces, stateKeys.savesWorkspaceOrder, stateKeys.savesActiveWorkspaceId, stateKeys.savesSelections] as const;

/** Durable roots and their boundary validation for Uklad persistence. */
export const PERSIST_KEYS = [
    { key: stateKeys.savesWorkspaces, deserialize: normalizeSaveWorkspaces, serialize: value => {
        assertSaveStorageLimits(value);
        return value as unknown as PersistData;
    } },
    { key: stateKeys.savesWorkspaceOrder, deserialize: normalizeSavesOrder },
    { key: stateKeys.savesActiveWorkspaceId, deserialize: normalizeSavesActiveId },
    { key: stateKeys.savesSelections, deserialize: normalizeSavesSelections },
    { key: stateKeys.uiLocale, deserialize: normalizeLocale },
    { key: stateKeys.basesMode, deserialize: (value: unknown) => value === 'planning' || value === 'advanced' ? value : null },
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
        key: stateKeys.pinnedRecipeSelections,
        deserialize: normalizePinnedRecipeSelections,
    },
    {
        key: stateKeys.recipeAlternativePresets,
        deserialize: normalizeRecipePresets,
    },
] as const satisfies readonly PersistKey<AppState>[];
