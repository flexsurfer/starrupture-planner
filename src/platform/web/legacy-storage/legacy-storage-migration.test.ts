import { afterEach, describe, expect, it, vi } from 'vitest';
import { migrateLegacyStorage } from './legacy-storage-migration';

const PERSIST_PREFIX = 'legacy-storage-migration-test';

function getPersistedRoot(rootKey: string): unknown {
    const stored = localStorage.getItem(`${PERSIST_PREFIX}/${rootKey}`);
    return stored ? JSON.parse(stored) : null;
}

afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
});

describe('migrateLegacyStorage', () => {
    it('migrates valid roots when a different legacy root is malformed', () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        localStorage.setItem('bases', '{malformed json');
        localStorage.setItem('energyGroups', JSON.stringify([{ id: 'group-1', name: 'Grid 1' }]));
        localStorage.setItem('pinnedRecipeSelections', JSON.stringify({ iron_ingot: 'smelter:0' }));
        localStorage.setItem('recipeAlternativePresets', JSON.stringify([{
            id: 'preset-1',
            name: 'Default',
            selections: { iron_ingot: 'smelter:0' },
        }]));

        migrateLegacyStorage(PERSIST_PREFIX);

        expect(getPersistedRoot('basesList')).toBeNull();
        expect(getPersistedRoot('energyGroups')).toEqual({
            v: 1,
            data: [{ id: 'group-1', name: 'Grid 1' }],
        });
        expect(getPersistedRoot('pinnedRecipeSelections')).toEqual({
            v: 1,
            data: { iron_ingot: 'smelter:0' },
        });
        expect(getPersistedRoot('recipeAlternativePresets')).toEqual({
            v: 1,
            data: [{
                id: 'preset-1',
                name: 'Default',
                selections: { iron_ingot: 'smelter:0' },
            }],
        });
    });
});
