const PINNED_RECIPES_STORAGE_KEY = 'pinnedRecipeSelections';
const PINNED_RECIPES_SCHEMA_VERSION = 1 as const;

interface PinnedRecipesStorageEnvelope {
    schemaVersion: number;
    pinnedRecipeSelections: unknown;
}

function isPinnedRecipesStorageEnvelope(value: unknown): value is PinnedRecipesStorageEnvelope {
    if (typeof value !== 'object' || value === null) return false;

    const envelope = value as PinnedRecipesStorageEnvelope;
    return typeof envelope.schemaVersion === 'number' && 'pinnedRecipeSelections' in envelope;
}

/**
 * Keeps only well-formed `outputItemId -> "${buildingId}:${recipeIndex}"` entries.
 * Stale keys that no longer match current game data are harmless: they are
 * ignored when building recipe options (see `buildRecipeOptionsForOutputItems`).
 */
function normalizePinnedRecipeSelections(raw: unknown): Record<string, string> {
    if (typeof raw !== 'object' || raw === null) return {};

    const normalized: Record<string, string> = {};
    for (const [itemId, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof itemId !== 'string' || !itemId.trim()) continue;
        if (typeof value !== 'string') continue;
        // Expect "buildingId:recipeIndex" with a numeric recipe index.
        if (!/^.+:\d+$/.test(value)) continue;
        normalized[itemId] = value;
    }

    return normalized;
}

export function writePinnedRecipesToStorage(pinnedRecipeSelections: Record<string, string>) {
    const envelope: PinnedRecipesStorageEnvelope = {
        schemaVersion: PINNED_RECIPES_SCHEMA_VERSION,
        pinnedRecipeSelections,
    };

    localStorage.setItem(PINNED_RECIPES_STORAGE_KEY, JSON.stringify(envelope));
}

export function readPinnedRecipesFromStorage(): Record<string, string> | null {
    const stored = localStorage.getItem(PINNED_RECIPES_STORAGE_KEY);
    if (!stored) return null;

    const raw = JSON.parse(stored) as unknown;

    if (isPinnedRecipesStorageEnvelope(raw)) {
        const selections = normalizePinnedRecipeSelections(raw.pinnedRecipeSelections);
        const hasNormalizationChanges =
            JSON.stringify(raw.pinnedRecipeSelections) !== JSON.stringify(selections);

        if (raw.schemaVersion !== PINNED_RECIPES_SCHEMA_VERSION || hasNormalizationChanges) {
            writePinnedRecipesToStorage(selections);
        }

        return selections;
    }

    const selections = normalizePinnedRecipeSelections(raw);
    writePinnedRecipesToStorage(selections);
    return selections;
}
