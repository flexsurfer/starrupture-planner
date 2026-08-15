import type { RecipeAlternativePreset } from '../db';

const RECIPE_PRESETS_STORAGE_KEY = 'recipeAlternativePresets';
const RECIPE_PRESETS_SCHEMA_VERSION = 1 as const;

interface RecipePresetsStorageEnvelope {
    schemaVersion: number;
    presets: unknown;
}

function isRecipePresetsStorageEnvelope(value: unknown): value is RecipePresetsStorageEnvelope {
    if (typeof value !== 'object' || value === null) return false;

    const envelope = value as RecipePresetsStorageEnvelope;
    return typeof envelope.schemaVersion === 'number' && 'presets' in envelope;
}

/** Keeps only well-formed `outputItemId -> "${buildingId}:${recipeIndex}"` entries. */
function normalizeSelections(raw: unknown): Record<string, string> {
    if (typeof raw !== 'object' || raw === null) return {};

    const normalized: Record<string, string> = {};
    for (const [itemId, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof itemId !== 'string' || !itemId.trim()) continue;
        if (typeof value !== 'string') continue;
        if (!/^.+:\d+$/.test(value)) continue;
        normalized[itemId] = value;
    }

    return normalized;
}

export function normalizeRecipePresets(raw: unknown): RecipeAlternativePreset[] {
    if (!Array.isArray(raw)) return [];

    const presets: RecipeAlternativePreset[] = [];
    const seenIds = new Set<string>();

    for (const rawPreset of raw) {
        if (typeof rawPreset !== 'object' || rawPreset === null) continue;
        const preset = rawPreset as Partial<RecipeAlternativePreset>;
        if (typeof preset.id !== 'string' || typeof preset.name !== 'string') continue;

        const id = preset.id.trim();
        const name = preset.name.trim().replace(/\s+/g, ' ');
        if (!id || !name || seenIds.has(id)) continue;

        seenIds.add(id);
        presets.push({ id, name, selections: normalizeSelections(preset.selections) });
    }

    return presets;
}

export function writeRecipePresetsToStorage(presets: RecipeAlternativePreset[]) {
    const envelope: RecipePresetsStorageEnvelope = {
        schemaVersion: RECIPE_PRESETS_SCHEMA_VERSION,
        presets,
    };

    localStorage.setItem(RECIPE_PRESETS_STORAGE_KEY, JSON.stringify(envelope));
}

export function readRecipePresetsFromStorage(): RecipeAlternativePreset[] | null {
    const stored = localStorage.getItem(RECIPE_PRESETS_STORAGE_KEY);
    if (!stored) return null;

    const raw = JSON.parse(stored) as unknown;

    if (isRecipePresetsStorageEnvelope(raw)) {
        const presets = normalizeRecipePresets(raw.presets);
        const hasNormalizationChanges = JSON.stringify(raw.presets) !== JSON.stringify(presets);

        if (raw.schemaVersion !== RECIPE_PRESETS_SCHEMA_VERSION || hasNormalizationChanges) {
            writeRecipePresetsToStorage(presets);
        }

        return presets;
    }

    const presets = normalizeRecipePresets(raw);
    writeRecipePresetsToStorage(presets);
    return presets;
}
