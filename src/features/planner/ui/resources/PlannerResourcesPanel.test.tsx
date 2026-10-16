import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { TEST_GAME_DATA } from '@/platform/headless/e2e-support';
import type { SaveSnapshot } from '@/features/saves/snapshot';
import { createSaveWorkspace } from '@/features/saves/workspace';
import { PlannerResourcesPanel } from './PlannerResourcesPanel';
import { PlannerStatsModal } from '../stats/PlannerStatsModal';

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(() => {
    cleanup();
    runtimes.splice(0).forEach(runtime => runtime.dispose());
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

function ClearableResourcesPanel({ initialItemId }: { initialItemId?: string }) {
    const [focusItemId, setFocusItemId] = useState(initialItemId);
    return <PlannerResourcesPanel focusItemId={focusItemId} onClearNodeSelection={() => setFocusItemId(undefined)} />;
}

function setup(focusItemId?: string) {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', structuredClone(TEST_GAME_DATA)]);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'resource-plan', 'Resource plan', 'single']);
    harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'iron-plate']);
    const view = render(<UkladProvider runtime={runtime}><ClearableResourcesPanel initialItemId={focusItemId} /></UkladProvider>);
    return { harness, runtime, view };
}

async function addSave(harness: ReturnType<typeof setup>['harness']) {
    const revision = `sha256:${'a'.repeat(64)}`;
    const shared = { powerNetworkId: null, position: { x: 0, y: 0, z: 0 } };
    const snapshot: SaveSnapshot = {
        schemaVersion: 4, gameData: { version: 'playtest', revision }, savedAt: '20261015120000', cores: [
            { ...shared, id: 1, spawnTimeSeconds: 1, name: 'North', level: 0, bounds: null, buildings: [
                { ...shared, id: 10, name: 'North drill', buildingTypeId: 'ore_excavator', configuration: { kind: 'extractor', itemId: 'iron-ore', nodePurity: 'normal' } },
                { ...shared, id: 11, name: 'Spare drill', buildingTypeId: 'ore_excavator', configuration: { kind: 'extractor', itemId: 'iron-ore', nodePurity: 'normal' } },
                { ...shared, id: 12, name: 'Copper drill', buildingTypeId: 'ore_excavator', configuration: { kind: 'extractor', itemId: 'copper-ore', nodePurity: 'normal' } },
            ] },
            { ...shared, id: 2, spawnTimeSeconds: 2, name: 'South', level: 0, bounds: null, buildings: [
                { ...shared, id: 20, name: 'South drill', buildingTypeId: 'ore_excavator', configuration: { kind: 'extractor', itemId: 'iron-ore', nodePurity: 'pure' } },
                { ...shared, id: 21, name: 'South smelter', buildingTypeId: 'smelter', configuration: { kind: 'production', recipeId: null } },
            ] },
        ],
    };
    await act(async () => {
        harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', {
            ...structuredClone(TEST_GAME_DATA), saveBuildingCatalog: {
                revision, kinds: { ore_excavator: 'extractor', smelter: 'production' },
                extractionRates: { 'ore_excavator:iron-ore:normal': 60, 'ore_excavator:iron-ore:pure': 120, 'ore_excavator:copper-ore:normal': 45 },
            },
        }]);
        harness.restoreState({ ...harness.getState(), savesWorkspaces: { world: createSaveWorkspace('world', 'World', snapshot) }, savesWorkspaceOrder: ['world'] });
    });
}

it('offers inline manual entry without any core or save controls when no save is loaded', async () => {
    const { harness } = setup('iron-ore');
    expect(screen.getByRole('heading', { name: 'Resources' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'or add from Factory Map' })).not.toBeInTheDocument();
    expect(screen.queryByText('Compare buildings')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Choose a save')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add resource' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Item')).toHaveValue('iron-ore');
    fireEvent.change(screen.getByLabelText('Amount / min'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByRole('heading', { name: 'Iron Ore' });
    expect(screen.getByRole('form', { name: 'Add manual resource' })).toBeVisible();
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 90 });
    const amount = screen.getByLabelText('Resource amount for Iron Ore');
    fireEvent.change(amount, { target: { value: '45' } });
    fireEvent.blur(amount);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 45 }));
    fireEvent.click(screen.getByLabelText('Enable resource Iron Ore'));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({}));
    fireEvent.click(screen.getByLabelText('Remove resource Iron Ore'));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES])).toEqual([]));
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(screen.queryByText('Resource removed.')).not.toBeInTheDocument();
});

it('retains positive allocations on invalid edit and Escape cancels an uncommitted edit', async () => {
    const { harness } = setup();
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'iron-ore', 80]));
    fireEvent.click(screen.getByRole('heading', { name: 'Iron Ore' }));
    const amount = screen.getByLabelText('Resource amount for Iron Ore');
    fireEvent.change(amount, { target: { value: '-10' } });
    fireEvent.blur(amount);
    expect(amount).toHaveValue(80);
    fireEvent.change(amount, { target: { value: '900' } });
    fireEvent.keyDown(amount, { key: 'Escape' });
    fireEvent.blur(amount);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 80 });
    expect(amount).toHaveValue(80);
});

it('only offers items in the current plan, excludes all targets, and rejects a selection that leaves the plan', async () => {
    const { harness } = setup();
    const itemSelect = screen.getByLabelText('Item');
    const options = () => within(itemSelect).getAllByRole('option').map(option => (option as HTMLOptionElement).value);
    expect(options()).toEqual(['', 'iron-ore']);
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'copper-ore', 30]));
    expect(options()).toEqual(['', 'iron-ore']);

    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'steel-plate']));
    expect(options()).toEqual(['', 'iron-ore', 'copper-ore', 'iron-plate', 'copper-wire']);
    fireEvent.change(itemSelect, { target: { value: 'iron-plate' } });
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled();
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'copper-wire']));
    expect(options()).toEqual(['', 'copper-ore']);
    expect(itemSelect).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();

    await act(async () => {
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'multi-plan', 'Multi', 'multi']);
        harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'iron-plate']);
        harness.dispatchSync([appIds.events.PLANNER_ADD_TARGET, 'copper-wire']);
    });
    const multiSelect = screen.getByLabelText('Item');
    expect(within(multiSelect).getAllByRole('option').map(option => (option as HTMLOptionElement).value))
        .toEqual(['', 'iron-ore', 'copper-ore']);
    fireEvent.change(multiSelect, { target: { value: 'iron-ore' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 60 }));
    expect(within(multiSelect).getByRole('option', { name: 'Iron Ore' })).toBeInTheDocument();
});

it('shows a one-click target fit only when applicable and different from the current target', async () => {
    const { harness } = setup();
    expect(screen.queryByRole('button', { name: 'Fit target' })).not.toBeInTheDocument();
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'iron-ore', 90]));
    expect(screen.getByText('90', { selector: 'strong' })).toBeVisible();
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TARGET_AMOUNT])).toBe(60);
    fireEvent.click(screen.getByRole('button', { name: 'Fit target' }));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_TARGET_AMOUNT])).toBe(90));
    expect(screen.queryByRole('button', { name: 'Fit target' })).not.toBeInTheDocument();
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'multi-plan', 'Multi', 'multi']));
    expect(screen.queryByRole('button', { name: 'Fit target' })).not.toBeInTheDocument();
});

it('lets each resource fold independently in regular resources mode', async () => {
    const { harness } = setup();
    await act(async () => {
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'iron-ore', 60]);
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'copper-ore', 30]);
    });
    expect(screen.getByLabelText('Resource amount for Iron Ore')).not.toBeVisible();
    expect(screen.getByLabelText('Resource amount for Copper Ore')).not.toBeVisible();
    fireEvent.click(screen.getByRole('heading', { name: 'Copper Ore' }));
    expect(screen.getByRole('heading', { name: 'Iron Ore' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Copper Ore' })).toBeVisible();
    expect(screen.getByLabelText('Resource amount for Copper Ore')).toBeVisible();
    expect(screen.getByLabelText('Resource amount for Iron Ore')).not.toBeVisible();
    fireEvent.click(screen.getByRole('heading', { name: 'Iron Ore' }));
    expect(screen.getByLabelText('Resource amount for Iron Ore')).toBeVisible();
    fireEvent.click(screen.getByRole('heading', { name: 'Copper Ore' }));
    expect(screen.getByLabelText('Resource amount for Copper Ore')).not.toBeVisible();
    expect(screen.getByLabelText('Resource amount for Iron Ore')).toBeVisible();
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 60, 'copper-ore': 30 });
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
});

it('clears the node filter inside the core picker without losing selected allocations', async () => {
    const { harness } = setup('iron-ore');
    await addSave(harness);
    fireEvent.click(screen.getByRole('button', { name: 'or add from Factory Map' }));
    expect(screen.getByText('Selected node')).toBeVisible();
    expect(screen.queryByLabelText('Select Copper Ore from Copper drill')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select Iron Ore from North drill'));
    fireEvent.change(screen.getByLabelText('Amount for Iron Ore from North drill'), { target: { value: '40' } });

    fireEvent.click(screen.getByRole('button', { name: 'Clear node selection' }));
    expect(screen.queryByText('Selected node')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add from Factory Map' })).toBeVisible();
    expect(screen.getByLabelText('Select Copper Ore from Copper drill')).toBeVisible();
    expect(screen.getByLabelText('Select Iron Ore from North drill')).toBeChecked();
    expect(screen.getByLabelText('Amount for Iron Ore from North drill')).toHaveValue(40);
    fireEvent.click(screen.getByLabelText('Select Copper Ore from Copper drill'));
    fireEvent.click(screen.getByRole('button', { name: /Add selected resources/ }));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 40, 'copper-ore': 45 }));
    expect(screen.getByRole('form', { name: 'Add manual resource' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Iron Ore' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Copper Ore' })).toBeVisible();
});

it('shows an empty filtered list until the node selection is cleared', async () => {
    const { harness } = setup('copper-ore');
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'iron-ore', 60]));
    expect(screen.getByText('No matching resources.')).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Iron Ore' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear node selection' }));
    expect(screen.queryByText('No matching resources.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Iron Ore' })).toBeVisible();
    expect(screen.getByLabelText('Item')).toHaveValue('');
    expect(screen.getByLabelText('Item')).toBeEnabled();
});

it('adds buildings across cores directly without save selection, metadata, or replacement', async () => {
    const { harness } = setup();
    await addSave(harness);
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'iron-ore', 5]));
    fireEvent.click(screen.getByRole('button', { name: 'or add from Factory Map' }));
    expect(screen.queryByRole('combobox', { name: 'Choose a save' })).not.toBeInTheDocument();
    expect(screen.queryByText('World')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Select Iron Ore from North drill'));
    expect(screen.getByLabelText('Select all in North')).toBePartiallyChecked();
    fireEvent.change(screen.getByLabelText('Amount for Iron Ore from North drill'), { target: { value: '40' } });
    fireEvent.click(screen.getByLabelText('Select Iron Ore from South drill'));
    fireEvent.click(screen.getByRole('button', { name: /Add selected resources/ }));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 165 }));
    fireEvent.click(screen.getByRole('heading', { name: 'Iron Ore' }));
    expect(screen.getAllByLabelText('Resource amount for Iron Ore')).toHaveLength(3);
    expect(screen.getByText('North drill')).toBeVisible();
    expect(screen.getByText('South drill')).toBeVisible();
    expect(screen.queryByText('Saved sources')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace from save' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Captured/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'or add from Factory Map' }));
    expect(screen.getByLabelText('Select Iron Ore from North drill')).toBeDisabled();
    await act(async () => harness.dispatchSync([appIds.events.SAVES_REMOVE_WORKSPACE, 'world']));
    expect(screen.queryByRole('button', { name: 'or add from Factory Map' })).not.toBeInTheDocument();
    expect(screen.getAllByLabelText('Resource amount for Iron Ore')).toHaveLength(3);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 165 });
});

it('uses the active save instead of the first workspace', async () => {
    const { harness } = setup();
    await addSave(harness);
    const active = structuredClone(harness.getState().savesWorkspaces.world);
    active.id = 'active';
    active.name = 'Another world';
    active.snapshot.cores[0].name = 'Active north';
    active.snapshot.cores[0].buildings[0].name = 'Active drill';
    await act(async () => harness.restoreState({ ...harness.getState(), savesWorkspaces: { ...harness.getState().savesWorkspaces, active }, savesWorkspaceOrder: ['world', 'active'], savesActiveWorkspaceId: 'active' }));
    fireEvent.click(screen.getByRole('button', { name: 'or add from Factory Map' }));
    expect(screen.getByText('Active north')).toBeVisible();
    expect(screen.getByLabelText('Select Iron Ore from Active drill')).toBeVisible();
    expect(screen.queryByText('North drill')).not.toBeInTheDocument();
    expect(screen.queryByText('Another world')).not.toBeInTheDocument();
});

it('compares selected cores in the statistics table and clears the comparison independently of resources', async () => {
    const { harness, runtime, view } = setup();
    await addSave(harness);
    expect(screen.queryByText('Compare buildings')).not.toBeInTheDocument();
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 120]));
    const originalStats = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_SUMMARY]);
    view.rerender(<UkladProvider runtime={runtime}><PlannerStatsModal isOpen onClose={() => {}} /></UkladProvider>);
    expect(screen.getByRole('columnheader', { name: 'Count' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'In cores' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Compare buildings' }));
    expect(screen.getByRole('button', { name: 'Use selected cores' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Select South'));
    fireEvent.click(screen.getByRole('button', { name: 'Use selected cores' }));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_BUILDING_COMPARISON]).baseline).toEqual({
        coreNames: ['South'], counts: { smelter: 1 },
    }));
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES])).toEqual([]);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_STATS_SUMMARY])).toEqual(originalStats);
    expect(screen.getByText('Selected cores: South')).toBeVisible();
    expect(screen.getAllByRole('table')).toHaveLength(1);
    expect(screen.getByRole('columnheader', { name: 'To build' })).toBeVisible();
    expect(within(screen.getByRole('row', { name: /Smelter/ })).getAllByRole('cell').map(cell => cell.textContent))
        .toEqual(['Smelter', '2', '1', '1', '⚡ 20', '🔥 10']);
    expect(within(screen.getByRole('row', { name: /Ore Excavator/ })).getAllByRole('cell').map(cell => cell.textContent))
        .toEqual(['Ore Excavator', '2', '—', '—', '⚡ 10', '🔥 4']);
    expect(screen.queryByText('World')).not.toBeInTheDocument();
    expect(screen.queryByText(/Captured/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Change cores' }));
    fireEvent.click(screen.getByLabelText('Select North'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Selected cores: South')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: /Items \(/ }));
    expect(screen.queryByRole('button', { name: 'Change cores' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Buildings \(/ }));
    await act(async () => {
        harness.dispatchSync([appIds.events.SAVES_REMOVE_WORKSPACE, 'world']);
        harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'copper-wire']);
    });
    expect(screen.getByText('Selected cores: South')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Change cores' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /Smelter/ })).getAllByRole('cell').map(cell => cell.textContent))
        .toEqual(['Smelter', '0', '1', '0', '⚡ 0', '🔥 0']);
    fireEvent.click(screen.getByRole('button', { name: 'Clear comparison' }));
    await waitFor(() => expect(screen.queryByRole('columnheader', { name: 'In cores' })).not.toBeInTheDocument());
    expect(screen.getByRole('columnheader', { name: 'Count' })).toBeVisible();
    expect(screen.queryByRole('row', { name: /Smelter/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Selected cores: South')).not.toBeInTheDocument();
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES])).toEqual([]);
});
