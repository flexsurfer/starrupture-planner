import { createUkladRuntime } from '@ukladjs/core/vanilla';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { describe, expect, it } from 'vitest';
import { initialAppState } from './db';
import { PERSIST_KEYS } from './persistence-config';

const PERSIST_PREFIX = 'persistence-config-test';

describe('persistence configuration', () => {
    it('normalizes persisted recipe selections during hydration', () => {
        const storage = memoryStorageAdapter({
            [`${PERSIST_PREFIX}/basesList`]: JSON.stringify({
                v: 1,
                data: [
                    {
                        id: 'base-1',
                        name: 'Base 1',
                        coreLevel: 9,
                        buildings: [
                            { id: 'building-1', buildingTypeId: 'smelter', sectionType: 'production' },
                            { id: 'broken-building', buildingTypeId: 42, sectionType: 'production' },
                        ],
                        productions: [],
                    },
                    { id: 'broken-base', buildings: [], productions: [] },
                ],
            }),
            [`${PERSIST_PREFIX}/pinnedRecipeSelections`]: JSON.stringify({
                v: 1,
                data: {
                    iron_ingot: 'smelter:0',
                    broken_selection: 'not-a-recipe-key',
                },
            }),
            [`${PERSIST_PREFIX}/recipeAlternativePresets`]: JSON.stringify({
                v: 1,
                data: [
                    {
                        id: 'preset-1',
                        name: '  Default   set  ',
                        selections: {
                            iron_ingot: 'smelter:0',
                            broken_selection: 'not-a-recipe-key',
                        },
                    },
                    {
                        id: 'preset-1',
                        name: 'Duplicate',
                        selections: {},
                    },
                    { id: '', name: 'Missing ID', selections: {} },
                ],
            }),
        });
        const runtime = createUkladRuntime({ initialState: { ...initialAppState } });
        const persistence = persist(runtime, {
            storage,
            prefix: PERSIST_PREFIX,
            keys: PERSIST_KEYS,
        });

        persistence.hydrate();

        const state = createUkladTestHarness(runtime).getState();
        expect(state.basesList).toEqual([{
            id: 'base-1',
            name: 'Base 1',
            coreLevel: 0,
            buildings: [{ id: 'building-1', buildingTypeId: 'smelter', sectionType: 'production' }],
            productions: [],
        }]);
        expect(state.pinnedRecipeSelections).toEqual({ iron_ingot: 'smelter:0' });
        expect(state.recipeAlternativePresets).toEqual([{
            id: 'preset-1',
            name: 'Default set',
            selections: { iron_ingot: 'smelter:0' },
        }]);

        runtime.dispose();
    });
});
