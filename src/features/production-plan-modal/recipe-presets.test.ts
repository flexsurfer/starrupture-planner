import { afterEach, describe, expect, it } from 'vitest';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { V2_RECIPE_PRESET_ID } from '@/features/planner/recipe-presets';
import type { Building } from '@/app/uklad/model';

const buildings: Building[] = [
    { id: 'smelter', name: 'Smelter', upgrade: 'smelter-v2', recipes: [
        { output: { id: 'plate', amount_per_minute: 60 }, inputs: [] },
        { output: { id: 'glass', amount_per_minute: 60 }, inputs: [] },
    ] },
    { id: 'smelter-v2', name: 'Smelter v.2', recipes: [
        { output: { id: 'plate', amount_per_minute: 120 }, inputs: [] },
        { output: { id: 'glass', amount_per_minute: 120 }, inputs: [] },
    ] },
    { id: 'factory', name: 'Factory', upgrade: 'factory-v2', recipes: [
        { output: { id: 'product', amount_per_minute: 60 }, inputs: [{ id: 'plate', amount_per_minute: 60 }] },
    ] },
    { id: 'factory-v2', name: 'Factory v.2', recipes: [
        { output: { id: 'product', amount_per_minute: 120 }, inputs: [{ id: 'plate', amount_per_minute: 120 }] },
    ] },
];
const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => runtimes.splice(0).forEach(runtime => runtime.dispose()));

describe('production plan recipe preset matching', () => {
    it.each(['built-in', 'saved'])('matches an applied %s preset with external inputs and preserves off-chain choices', kind => {
        const runtime = createAppRuntime();
        runtimes.push(runtime);
        runtime.registerModule(registerApplicationModules);
        const harness = createUkladTestHarness(runtime);
        harness.restoreState({
            ...harness.getState(),
            buildingsList: buildings,
            basesSelectedBaseId: 'base',
            basesList: [{ id: 'base', name: 'Base', productions: [], buildings: [
                { id: 'plate-input', buildingTypeId: 'storage', sectionType: 'inputs', selectedItemId: 'plate', ratePerMinute: 60 },
            ] }],
        });
        harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
        const upgraded = harness.getState().recipeAlternativePresets.find(preset => preset.id === V2_RECIPE_PRESET_ID)!;
        if (kind === 'saved') {
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'My machines', { ...upgraded.selections }, true]);
        } else {
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULT_PRESET, upgraded.id]);
        }
        const presets = harness.getState().recipeAlternativePresets;
        const preset = presets.find(entry => entry.isDefault)!;
        const defaults = harness.getState().pinnedRecipeSelections;
        const presetState = () => harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_PRESET_STATE]);

        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'product']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, 'plate-input']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS, { ...preset.selections }]);

        expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS]).map(entry => entry.itemId)).toEqual(['product']);
        expect(presetState().matchingPresets).toContain(preset);
        expect(presetState().defaultPreset).toBe(preset);
        expect(presetState().selections).toEqual({ product: 'factory-v2:0', glass: 'smelter-v2:1' });
        expect(harness.getState().productionPlanModalState.recipeSelections).toEqual(presetState().selections);
        expect(harness.getState().recipeAlternativePresets).toBe(presets);
        expect(harness.getState().pinnedRecipeSelections).toBe(defaults);

        // Unrelated choices remain significant even though they aren't in this chain.
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, 'glass', 'smelter:1']);
        expect(presetState().matchingPresets).toEqual([]);
        expect(presetState().selections.glass).toBe('smelter:1');
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS, { ...preset.selections }]);
        expect(presetState().matchingPresets).toContain(preset);

        // Once the input is removed, its recipe choice must participate again.
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, 'plate-input']);
        expect(presetState().matchingPresets).toEqual([]);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION, 'plate', 'smelter-v2:0']);
        expect(presetState().matchingPresets).toContain(preset);
    });
});
