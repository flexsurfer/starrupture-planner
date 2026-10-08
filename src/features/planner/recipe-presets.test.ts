import { afterEach, describe, expect, it } from 'vitest';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import type { Building } from '@/app/uklad/model';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { createStandardRecipePreset, createV2RecipePreset, initializeRecipePresets, V2_RECIPE_PRESET_ID } from './recipe-presets';

const buildings: Building[] = [
    { id: 'furnace', name: 'Furnace', upgrade: 'furnace-v2', recipes: [
        { output: { id: 'glass', amount_per_minute: 40 }, inputs: [] },
        { output: { id: 'plate', amount_per_minute: 60 }, inputs: [] },
    ] },
    { id: 'furnace-v2', name: 'Furnace v.2', recipes: [
        { id: 'alternative', variant: 'alternative', output: { id: 'glass', amount_per_minute: 320 }, inputs: [] },
        { id: 'regular', output: { id: 'glass', amount_per_minute: 80 }, inputs: [] },
    ] },
];
const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => runtimes.splice(0).forEach(runtime => runtime.dispose()));

describe('built-in V2 recipe preset', () => {
    it('selects regular upgrade recipes with stable keys and falls back for items without upgrades', () => {
        expect(createV2RecipePreset(buildings)).toEqual({
            id: V2_RECIPE_PRESET_ID, name: 'Upgraded recipes', selections: { glass: 'furnace-v2:regular' },
        });
        expect(createV2RecipePreset([buildings[0]]).selections).toEqual({});
    });

    it('preserves a hydrated V2 default before loading data and initializes idempotently', () => {
        const v2 = { ...createV2RecipePreset(buildings), isDefault: true };
        const initialized = initializeRecipePresets([createStandardRecipePreset(), v2], v2.selections);
        expect(initialized.find(preset => preset.isDefault)).toEqual(v2);
        expect(initializeRecipePresets(initialized, v2.selections)).toEqual(initialized);
    });

    it('refreshes V2 defaults with catalog changes, preserves existing plans, and restores upgrades when available again', () => {
        const runtime = createAppRuntime();
        runtimes.push(runtime);
        runtime.registerModule(registerApplicationModules);
        const harness = createUkladTestHarness(runtime);
        const load = (catalog: Building[]) => harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'earlyaccess', {
            buildings: catalog, items: [], corporations: {},
        }]);
        load(buildings);
        harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULT_PRESET, V2_RECIPE_PRESET_ID]);
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'existing', 'Existing', 'single']);
        expect(harness.getState().plannerTabs[0].recipeSelections).toEqual({ glass: 'furnace-v2:regular' });
        load([buildings[0]]);
        expect(harness.getState().pinnedRecipeSelections).toEqual({});
        expect(harness.getState().recipeAlternativePresets.find(preset => preset.isDefault)?.id).toBe(V2_RECIPE_PRESET_ID);
        expect(harness.getState().plannerTabs[0].recipeSelections).toEqual({ glass: 'furnace-v2:regular' });
        load(buildings);
        expect(harness.getState().pinnedRecipeSelections).toEqual({ glass: 'furnace-v2:regular' });
        expect(harness.getState().recipeAlternativePresets).toHaveLength(2);
    });
});
