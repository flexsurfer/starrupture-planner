import { createUkladRuntime } from '@ukladjs/core/vanilla';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { describe, expect, it } from 'vitest';
import { createAppState } from '@/app/uklad/initial-state';
import { PERSIST_KEYS } from './persistence';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { createV2RecipePreset, STANDARD_RECIPE_PRESET_ID } from '@/features/planner/recipe-presets';

const PERSIST_PREFIX = 'persistence-config-test';

describe('persistence configuration', () => {
    it('restores an explicitly selected empty preset as the default and can switch back to Standard recipes', () => {
        const storage = memoryStorageAdapter();
        const runtime = createAppRuntime();
        runtime.registerModule(registerApplicationModules);
        const persistence = persist(runtime, { storage, prefix: PERSIST_PREFIX, keys: PERSIST_KEYS });
        persistence.hydrate();
        const harness = createUkladTestHarness(runtime);
        harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Standard machines', {}, true]);
        persistence.dispose();
        runtime.dispose();

        const reloaded = createAppRuntime();
        reloaded.registerModule(registerApplicationModules);
        const restoredPersistence = persist(reloaded, { storage, prefix: PERSIST_PREFIX, keys: PERSIST_KEYS });
        restoredPersistence.hydrate();
        const restored = createUkladTestHarness(reloaded);
        expect(restored.getSubscriptionValue([appIds.subscriptions.PLANNER_RECIPE_PRESET_STATE])).toMatchObject({
            defaultPreset: { name: 'Standard machines', isDefault: true, selections: {} }, hasDefault: true,
        });
        restored.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULT_PRESET, STANDARD_RECIPE_PRESET_ID]);
        expect(restored.getSubscriptionValue([appIds.subscriptions.PLANNER_RECIPE_PRESET_STATE])).toMatchObject({ defaultPreset: { id: STANDARD_RECIPE_PRESET_ID }, hasDefault: true });
        restored.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
        expect(restored.getSubscriptionValue([appIds.subscriptions.PLANNER_RECIPE_PRESET_STATE])).toMatchObject({ defaultPreset: { id: STANDARD_RECIPE_PRESET_ID }, hasDefault: true });
        restoredPersistence.dispose();
        reloaded.dispose();
    });

    it.each([
        { presets: [], expectedName: 'My default recipes', expectedCount: 3 },
        { presets: [{ id: 'old', name: 'My machines', selections: { plate: 'smelter:0' } }], expectedName: 'My machines', expectedCount: 3 },
        { presets: [{ id: 'other', name: 'my default recipes', selections: {} }], expectedName: 'My default recipes (2)', expectedCount: 4 },
    ])('migrates legacy defaults into $expectedName once and preserves them after rename and reload', ({ presets, expectedName, expectedCount }) => {
        const selections = { plate: 'smelter:0' };
        const storage = memoryStorageAdapter({
            [`${PERSIST_PREFIX}/pinnedRecipeSelections`]: JSON.stringify({ v: 1, data: selections }),
            [`${PERSIST_PREFIX}/recipeAlternativePresets`]: JSON.stringify({ v: 1, data: presets }),
        });
        const runtime = createAppRuntime();
        runtime.registerModule(registerApplicationModules);
        const persistence = persist(runtime, { storage, prefix: PERSIST_PREFIX, keys: PERSIST_KEYS });
        persistence.hydrate();
        const harness = createUkladTestHarness(runtime);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'existing', 'Existing plan', 'single']);
        harness.dispatchSync([appIds.events.PLANNER_SET_RECIPE_SELECTIONS, { plate: 'other:0' }]);
        harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
        const migrated = harness.getState();
        const currentDefault = migrated.recipeAlternativePresets.find(preset => preset.isDefault)!;
        expect(currentDefault).toMatchObject({ name: expectedName, selections });
        expect(migrated.recipeAlternativePresets).toHaveLength(expectedCount);
        expect(migrated.recipeAlternativePresets[0]).toEqual({ id: STANDARD_RECIPE_PRESET_ID, name: 'Standard recipes', selections: {} });
        expect(migrated.pinnedRecipeSelections).toEqual(selections);
        expect(migrated.plannerTabs[0].recipeSelections).toEqual({ plate: 'other:0' });
        harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_RENAME_PRESET, currentDefault.id, 'My preferred machines']);
        persistence.dispose();
        runtime.dispose();

        const reloaded = createAppRuntime();
        reloaded.registerModule(registerApplicationModules);
        const restoredPersistence = persist(reloaded, { storage, prefix: PERSIST_PREFIX, keys: PERSIST_KEYS });
        restoredPersistence.hydrate();
        const restored = createUkladTestHarness(reloaded);
        restored.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
        expect(restored.getState().recipeAlternativePresets).toHaveLength(expectedCount);
        expect(restored.getState().recipeAlternativePresets.find(preset => preset.isDefault)).toEqual({ ...currentDefault, name: 'My preferred machines' });
        expect(restored.getState().pinnedRecipeSelections).toEqual(selections);
        expect(restored.getState().plannerTabs[0].recipeSelections).toEqual({ plate: 'other:0' });
        restoredPersistence.dispose();
        reloaded.dispose();
    });

    it.each([false, true])('restores Standard recipes when old settings have no default (built-in exists: %s)', builtInExists => {
        const storage = memoryStorageAdapter({
            [`${PERSIST_PREFIX}/recipeAlternativePresets`]: JSON.stringify({ v: 1, data: builtInExists ? [{ id: STANDARD_RECIPE_PRESET_ID, name: 'Standard recipes', selections: {} }] : [] }),
        });
        const runtime = createAppRuntime();
        runtime.registerModule(registerApplicationModules);
        const persistence = persist(runtime, { storage, prefix: PERSIST_PREFIX, keys: PERSIST_KEYS });
        persistence.hydrate();
        const harness = createUkladTestHarness(runtime);
        harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
        expect(harness.getState().recipeAlternativePresets).toEqual([{ id: STANDARD_RECIPE_PRESET_ID, name: 'Standard recipes', selections: {}, isDefault: true }, createV2RecipePreset()]);
        persistence.dispose();
        runtime.dispose();
    });

    it.each(['delete', 'replace'] as const)('persists Standard recipes after %s of the current default without changing existing plans', operation => {
        const storage = memoryStorageAdapter();
        const runtime = createAppRuntime();
        runtime.registerModule(registerApplicationModules);
        const persistence = persist(runtime, { storage, prefix: PERSIST_PREFIX, keys: PERSIST_KEYS });
        persistence.hydrate();
        const harness = createUkladTestHarness(runtime);
        const selections = { plate: 'smelter:0' };
        harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'My machines', selections, true]);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'existing', 'Existing plan', 'single']);
        const presetId = harness.getState().recipeAlternativePresets.find(preset => preset.name === 'My machines')!.id;
        if (operation === 'delete') harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, presetId]);
        else harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'My machines', { plate: 'other:0' }, false]);
        expect(harness.getState().recipeAlternativePresets.filter(preset => preset.isDefault).map(preset => preset.id)).toEqual([STANDARD_RECIPE_PRESET_ID]);
        expect(harness.getState().pinnedRecipeSelections).toEqual({});
        expect(harness.getState().plannerTabs[0].recipeSelections).toEqual(selections);
        persistence.dispose();
        runtime.dispose();

        const reloaded = createAppRuntime();
        reloaded.registerModule(registerApplicationModules);
        const restoredPersistence = persist(reloaded, { storage, prefix: PERSIST_PREFIX, keys: PERSIST_KEYS });
        restoredPersistence.hydrate();
        const restored = createUkladTestHarness(reloaded);
        restored.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
        expect(restored.getSubscriptionValue([appIds.subscriptions.PLANNER_RECIPE_PRESET_STATE])).toMatchObject({ defaultPreset: { id: STANDARD_RECIPE_PRESET_ID }, hasDefault: true });
        restored.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'next', 'Next', 'single']);
        expect(restored.getState().plannerTabs.find(tab => tab.id === 'next')?.recipeSelections).toEqual({});
        restoredPersistence.dispose();
        reloaded.dispose();
    });

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
                    glass: 'furnacetier2:glass',
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
                            glass: 'furnacetier2:glass',
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
        const runtime = createUkladRuntime({ initialState: createAppState() });
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
        expect(state.pinnedRecipeSelections).toEqual({
            iron_ingot: 'smelter:0',
            glass: 'furnacetier2:glass',
        });
        expect(state.recipeAlternativePresets).toEqual([{
            id: 'preset-1',
            name: 'Default set',
            selections: {
                iron_ingot: 'smelter:0',
                glass: 'furnacetier2:glass',
            },
        }]);

        runtime.dispose();
    });
});
