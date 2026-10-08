import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { PlannerRecipeSelector } from './PlannerRecipeSelector';
import { RecipeAlternativesSelector } from '@/features/production-plan-modal/ui/CreateProductionPlanModal/components/RecipeAlternativesSelector';
import { STANDARD_RECIPE_PRESET_ID, V2_RECIPE_PRESET_ID } from '@/features/planner/recipe-presets';

vi.mock('@/shared/ui', () => ({ BuildingImage: () => null, ItemImage: () => null, RecipeTypeIcon: () => null }));

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); runtimes.splice(0).forEach(runtime => runtime.dispose()); vi.unstubAllGlobals(); });

function setup(productionPlan = false, withUpgrade = false) {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    harness.restoreState({
        ...harness.getState(),
        itemsList: [{ id: 'plate', name: 'Plate', type: 'processed' }],
        buildingsList: [
            { id: 'smelter', name: 'Smelter', upgrade: withUpgrade ? 'smelter-v2' : undefined, recipes: [{ output: { id: 'plate', amount_per_minute: 60 }, inputs: [{ id: 'ore', amount_per_minute: 30 }] }] },
            { id: 'smelter-v2', name: 'Smelter v.2', recipes: [{ output: { id: 'plate', amount_per_minute: 180 }, inputs: [{ id: 'ore', amount_per_minute: 90 }] }] },
        ],
        productionPlanModalState: {
            ...harness.getState().productionPlanModalState, isOpen: true, selectedItemId: 'plate', targetAmount: 60,
        },
    });
    harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'current', 'Current', 'single']);
    harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'plate']);
    render(<UkladProvider runtime={runtime}>
        <dialog open aria-label="Parent plan">{productionPlan ? <RecipeAlternativesSelector /> : <PlannerRecipeSelector />}</dialog>
    </UkladProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Recipe alternatives:/ }));
    return harness;
}

describe('recipe preset controls', () => {
    it.each([false, true])('loads built-in Upgraded recipes and allows making them the default (production plan: %s)', async productionPlan => {
        const harness = setup(productionPlan, true);
        fireEvent.change(screen.getByRole('combobox', { name: 'Selected preset' }), { target: { value: V2_RECIPE_PRESET_ID } });
        await waitFor(() => expect(screen.getByTitle('Smelter v.2 - 180/min')).toHaveAttribute('aria-pressed', 'true'));
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Manage presets' }));
        const dialog = within(screen.getByRole('dialog', { name: 'Manage presets' }));
        expect(dialog.queryByRole('button', { name: 'Rename "Upgraded recipes"' })).not.toBeInTheDocument();
        expect(dialog.queryByRole('button', { name: 'Delete "Upgraded recipes"' })).not.toBeInTheDocument();
        fireEvent.change(dialog.getByRole('combobox', { name: 'Default for new plans' }), { target: { value: V2_RECIPE_PRESET_ID } });
        await waitFor(() => expect(harness.getState().pinnedRecipeSelections).toEqual({ plate: 'smelter-v2:0' }));
        fireEvent.click(dialog.getByRole('button', { name: 'Done' }));
        expect(screen.getByRole('combobox', { name: 'Selected preset' })).toHaveDisplayValue('Upgraded recipes (Default)');
    });

    it.each([false, true])('saves through a dialog, matches live recipe choices, and defaults only new plans (production plan: %s)', async productionPlan => {
        const harness = setup(productionPlan);
        expect(screen.getByRole('combobox', { name: 'Selected preset' })).toHaveDisplayValue('Standard recipes (Default)');
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        expect(within(screen.getByRole('combobox', { name: 'Selected preset' })).getByRole('option', { name: 'Standard recipes (Default)' })).toBeInTheDocument();
        fireEvent.click(screen.getByTitle('Smelter v.2 - 180/min'));
        await waitFor(() => expect(screen.getByTitle('Smelter v.2 - 180/min')).toHaveAttribute('aria-pressed', 'true'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        const dialog = screen.getByRole('dialog', { name: 'Save preset' });
        expect(screen.getByRole('dialog', { name: 'Parent plan' })).toContainElement(dialog);
        expect(within(dialog).getByRole('button', { name: 'Save' })).toBeDisabled();
        fireEvent.click(within(dialog).getByLabelText('Make default for new plans'));
        fireEvent.change(within(dialog).getByLabelText('Preset name'), { target: { value: 'Fast machines' } });
        expect(within(dialog).getByLabelText('Make default for new plans')).toBeChecked();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
        await screen.findByText('Preset: Fast machines');
        expect(harness.getState().pinnedRecipeSelections).toEqual({ plate: 'smelter-v2:0' });
        expect(harness.getState().recipeAlternativePresets.find(preset => preset.name === 'Fast machines')?.isDefault).toBe(true);
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
        expect(screen.queryByText(/New plans start with/)).not.toBeInTheDocument();

        fireEvent.click(screen.getByTitle('Smelter - 60/min'));
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Selected preset' })).toHaveDisplayValue('Standard recipes'));
        expect(within(screen.getByRole('combobox', { name: 'Selected preset' })).getByRole('option', { name: 'Fast machines (Default)' })).toBeInTheDocument();
        expect(harness.getState().pinnedRecipeSelections).toEqual({ plate: 'smelter-v2:0' });
        fireEvent.click(screen.getByTitle('Smelter v.2 - 180/min'));
        await screen.findByText('Preset: Fast machines');
        act(() => harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'next', 'Next', 'single']));
        expect(harness.getState().plannerTabs.find(tab => tab.id === 'next')?.recipeSelections).toEqual({ plate: 'smelter-v2:0' });
    });

    it('loads the selected name, changes defaults, and falls back to Standard recipes after deleting the default', async () => {
        const harness = setup();
        act(() => {
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Basic', {}]);
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Fast', { plate: 'smelter-v2:0' }]);
        });
        const fastId = harness.getState().recipeAlternativePresets.find(preset => preset.name === 'Fast')!.id;
        fireEvent.change(screen.getByRole('combobox', { name: 'Selected preset' }), { target: { value: fastId } });
        await screen.findByText('Preset: Fast');
        fireEvent.click(screen.getByRole('button', { name: 'Manage presets' }));
        let dialog = screen.getByRole('dialog', { name: 'Manage presets' });
        expect(within(dialog).queryByRole('option', { name: 'No default preset' })).not.toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: 'Delete "Standard recipes"' })).not.toBeInTheDocument();
        expect(within(dialog).queryByRole('button', { name: 'Rename "Standard recipes"' })).not.toBeInTheDocument();
        const basicId = harness.getState().recipeAlternativePresets.find(preset => preset.name === 'Basic')!.id;
        fireEvent.change(within(dialog).getByRole('combobox', { name: 'Default for new plans' }), { target: { value: basicId } });
        await waitFor(() => expect(harness.getState().recipeAlternativePresets.find(preset => preset.name === 'Basic')?.isDefault).toBe(true));
        expect(harness.getState().plannerTabs[0].recipeSelections).toEqual({ plate: 'smelter-v2:0' });
        fireEvent.change(within(dialog).getByRole('combobox', { name: 'Default for new plans' }), { target: { value: STANDARD_RECIPE_PRESET_ID } });
        await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Default for new plans' })).toHaveDisplayValue('Standard recipes'));
        fireEvent.change(within(dialog).getByRole('combobox', { name: 'Default for new plans' }), { target: { value: fastId } });
        await waitFor(() => expect(harness.getState().pinnedRecipeSelections).toEqual({ plate: 'smelter-v2:0' }));
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete "Fast"' }));
        dialog = screen.getByRole('dialog', { name: 'Delete preset' });
        expect(within(dialog).getByText('New plans will use "Standard recipes".')).toBeVisible();
        fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
        await waitFor(() => expect(harness.getState().recipeAlternativePresets).toHaveLength(3));
        expect(harness.getState().pinnedRecipeSelections).toEqual({});
        expect(screen.getByRole('combobox', { name: 'Default for new plans' })).toHaveDisplayValue('Standard recipes');
        expect(harness.getState().recipeAlternativePresets.filter(preset => preset.isDefault).map(preset => preset.id)).toEqual([STANDARD_RECIPE_PRESET_ID]);
        expect(harness.getState().plannerTabs[0].recipeSelections).toEqual({ plate: 'smelter-v2:0' });
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(screen.getByRole('combobox', { name: 'Selected preset' })).toHaveDisplayValue('Custom recipes (unsaved)');
        act(() => harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'next', 'Next', 'single']));
        expect(harness.getState().plannerTabs.find(tab => tab.id === 'next')?.recipeSelections).toEqual({});
    });

    it('preserves off-screen choices, identifies duplicate presets by the loaded name, and exposes replacement before saving', async () => {
        const harness = setup();
        const selections = { plate: 'smelter-v2:0', other: 'other-machine:0' };
        act(() => {
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'First', selections]);
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Second', selections]);
        });
        const secondId = harness.getState().recipeAlternativePresets.find(preset => preset.name === 'Second')!.id;
        fireEvent.change(screen.getByRole('combobox', { name: 'Selected preset' }), { target: { value: secondId } });
        await screen.findByText('Preset: Second');
        fireEvent.click(screen.getByTitle('Smelter - 60/min'));
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Selected preset' })).toHaveDisplayValue('Custom recipes (unsaved)'));
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        fireEvent.change(screen.getByLabelText('Preset name'), { target: { value: 'Second' } });
        expect(screen.getByText('Saving will replace "Second".')).toBeVisible();
        fireEvent.click(screen.getByRole('button', { name: 'Replace preset' }));
        await screen.findByText('Preset: Second');
        expect(harness.getState().recipeAlternativePresets.find(preset => preset.name === 'Second')?.selections).toEqual({ other: 'other-machine:0' });
        expect(harness.getState().recipeAlternativePresets.find(preset => preset.name === 'First')?.selections).toEqual(selections);
    });

    it('traps dialog focus and closes only the top dialog on Escape', async () => {
        setup();
        fireEvent.click(screen.getByTitle('Smelter v.2 - 180/min'));
        const save = screen.getByRole('button', { name: 'Save' });
        await waitFor(() => expect(save).toBeEnabled());
        fireEvent.click(save);
        const input = screen.getByLabelText('Preset name');
        expect(input).toHaveFocus();
        const close = within(screen.getByRole('dialog', { name: 'Save preset' })).getByRole('button', { name: 'Close' });
        close.focus();
        fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
        expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
        fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
        expect(close).toHaveFocus();
        fireEvent.keyDown(close, { key: 'Escape' });
        expect(screen.queryByRole('dialog', { name: 'Save preset' })).not.toBeInTheDocument();
        expect(screen.getByRole('dialog', { name: 'Parent plan' })).toHaveAttribute('open');
        expect(save).toHaveFocus();
        expect(screen.getByRole('combobox', { name: 'Selected preset' })).toHaveDisplayValue('Custom recipes (unsaved)');
    });

    it('renames a selected default preset without losing its identity, selections, or default status', async () => {
        const harness = setup();
        act(() => {
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Fast', { plate: 'smelter-v2:0' }, true]);
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Same choices', { plate: 'smelter-v2:0' }]);
        });
        const fast = harness.getState().recipeAlternativePresets.find(preset => preset.name === 'Fast')!;
        fireEvent.change(screen.getByRole('combobox', { name: 'Selected preset' }), { target: { value: fast.id } });
        await screen.findByText('Preset: Fast');
        fireEvent.click(screen.getByRole('button', { name: 'Manage presets' }));
        fireEvent.click(screen.getByRole('button', { name: 'Rename "Fast"' }));
        const rename = within(screen.getByRole('dialog', { name: 'Rename preset' }));
        expect(rename.getByRole('button', { name: 'Save' })).toBeDisabled();
        fireEvent.change(rename.getByLabelText('Preset name'), { target: { value: ' standard recipes ' } });
        expect(rename.getByRole('alert')).toHaveTextContent('A preset with this name already exists.');
        expect(rename.getByRole('button', { name: 'Save' })).toBeDisabled();
        fireEvent.change(rename.getByLabelText('Preset name'), { target: { value: 'Upgraded machines' } });
        fireEvent.click(rename.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(screen.getByRole('combobox', { name: 'Default for new plans' })).toHaveDisplayValue('Upgraded machines'));
        expect(harness.getState().recipeAlternativePresets.find(preset => preset.id === fast.id)).toEqual({ ...fast, name: 'Upgraded machines' });
        expect(harness.getState().pinnedRecipeSelections).toEqual(fast.selections);
        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(screen.getByRole('combobox', { name: 'Selected preset' })).toHaveDisplayValue('Upgraded machines (Default)');
        expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    });

    it.each([[STANDARD_RECIPE_PRESET_ID, 'Standard recipes'], [V2_RECIPE_PRESET_ID, 'Upgraded recipes']])('protects built-in %s from overwrite, rename, and deletion', (id, name) => {
        const harness = setup();
        const before = harness.getState().recipeAlternativePresets;
        act(() => {
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, name, { plate: 'smelter-v2:0' }, true]);
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_RENAME_PRESET, id, 'Changed']);
            harness.dispatchSync([appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, id]);
        });
        expect(harness.getState().recipeAlternativePresets).toEqual(before);
        expect(harness.getState().pinnedRecipeSelections).toEqual({});
    });
});
