import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { ConfirmationDialog } from '@/features/app-shell/ui/ConfirmationDialog';
import { NodeInputButton } from '@/features/planner/ui/visualization/NodeInputButton';
import type { FlowNode } from '@/features/planner/types';
import { usePlanInputActions } from './usePlanInputActions';

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

function InputButton({ itemId, saved }: { itemId: string; saved: boolean }) {
    const actions = usePlanInputActions('base', saved ? 'plan' : undefined);
    const node: FlowNode = {
        nodeType: 'production', buildingId: 'smelter', buildingName: 'Smelter', recipeIndex: 0,
        outputItem: itemId, outputAmount: 60, buildingCount: 1,
        powerPerBuilding: 0, heatPerBuilding: 0, totalPower: 0, totalHeat: 0,
    };
    return <NodeInputButton node={node} itemName={itemId} isExternal={false} {...actions} />;
}

function setup(mode: 'planning' | 'advanced', itemId: string, saved = false) {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    const items = ['ore', 'plate', 'product'].map(id => ({ id, name: id, type: id === 'ore' ? 'raw' : 'processed' }));
    harness.restoreState({ ...harness.getState(), basesMode: mode, basesSelectedBaseId: 'base',
        itemsList: items, itemsById: Object.fromEntries(items.map(item => [item.id, item])),
        buildingsList: [
            { id: 'storage_depot_v1', name: 'Storage Depot v1', type: 'storage', upgrade: 'storage_depot_v2' },
            { id: 'storage_depot_v2', name: 'Storage Depot v2', type: 'storage' },
            { id: 'package_receiver', name: 'Receiver', type: 'transport' },
            { id: 'package_dispatcher', name: 'Dispatcher', type: 'transport' },
            { id: 'miner', name: 'Ore Miner', type: 'production', recipes: [
                { output: { id: 'ore', amount_per_minute: 60 }, inputs: [] },
            ] },
            { id: 'smelter', name: 'Smelter', type: 'production', recipes: [
                { output: { id: 'plate', amount_per_minute: 60 }, inputs: [{ id: 'ore', amount_per_minute: 60 }] },
            ] },
            { id: 'factory', name: 'Factory', type: 'production', recipes: [
                { output: { id: 'product', amount_per_minute: 30 }, inputs: [{ id: 'plate', amount_per_minute: 60 }] },
            ] },
        ],
        basesList: [{ id: 'base', name: 'Base', buildings: [], productions: [
            { id: 'plan', name: 'Products', selectedItemId: 'product', targetAmount: 30, inputs: [], active: false },
        ] }, { id: 'source', name: 'Source', productions: [], buildings: [
            { id: 'plates', name: 'Plate supply', buildingTypeId: 'package_dispatcher', sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
            { id: 'stored-plates', name: 'Stored plates', buildingTypeId: 'storage_depot_v1', sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
            { id: 'storage-v2', name: 'Other storage type', buildingTypeId: 'storage_depot_v2', sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
            { id: 'ore', name: 'Ore supply', buildingTypeId: 'package_dispatcher', sectionType: 'outputs', selectedItemId: 'ore', ratePerMinute: 60 },
            { id: 'occupied', name: 'Occupied supply', buildingTypeId: 'package_dispatcher', sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
            { id: 'reservation', buildingTypeId: 'package_receiver', sectionType: 'inputs', linkedOutput: { baseId: 'source', buildingId: 'occupied' } },
        ] }],
    });
    if (!saved) harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, 'plan']);
    render(<UkladProvider runtime={runtime}><InputButton itemId={itemId} saved={saved} /><ConfirmationDialog /></UkladProvider>);
    fireEvent.click(screen.getByRole('button', { name: `Use external resource for ${itemId}` }));
    return harness;
}

it('uses the corresponding extractor for raw resources in Planning mode', async () => {
    const harness = setup('planning', 'ore');
    const dialog = screen.getByRole('dialog', { name: 'Add new input' });
    expect(within(dialog).getByText('Ore Miner')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Select target' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Available amount / min'), { target: { value: '90' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add input' }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { buildingTypeId: 'miner', selectedItemId: 'ore', ratePerMinute: 90, planningOwnerPlanId: 'plan' },
    ]));
});

it('offers Storage Depot v1 amounts and hides unavailable targets', async () => {
    const harness = setup('planning', 'plate');
    expect(screen.getByText('Storage Depot v1')).toBeVisible();
    await act(async () => { harness.dispatchSync([appIds.events.BASES_DELETE_BASE, 'source']); });
    expect(screen.queryByRole('button', { name: 'Select target' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Available amount / min'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add input' }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { buildingTypeId: 'storage_depot_v1', selectedItemId: 'plate', ratePerMinute: 75 },
    ]));
});

it.each([false, true])('links only matching available targets from a card (saved diagram: %s)', async saved => {
    const harness = setup('planning', 'plate', saved);
    const dialog = screen.getByRole('dialog', { name: 'Add new input' });
    fireEvent.change(within(dialog).getByLabelText('Available amount / min'), { target: { value: '75' } });
    fireEvent.click(screen.getByRole('button', { name: 'Select target' }));
    expect(screen.getAllByRole('dialog')).toEqual([dialog]);
    expect(within(dialog).queryByLabelText('Available amount / min')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Select target' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enter amount' }));
    expect(within(dialog).getByLabelText('Available amount / min')).toHaveValue(75);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Select target' }));
    expect(within(dialog).queryByRole('button', { name: /Ore supply/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Connect .*Occupied supply/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('article', { name: 'Source / Receiver' })).toHaveTextContent('Receiver');
    fireEvent.click(within(dialog).getByRole('button', { name: /Plate supply/ }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { buildingTypeId: 'package_receiver', planningOwnerPlanId: 'plan', linkedOutput: { baseId: 'source', buildingId: 'plates' } },
    ]));
    if (saved) expect(harness.getState().productionPlanModalState.isOpen).toBe(false);
    // Removing a linked input also cleans up its owned receiver if its source disappears.
    const inputId = harness.getState().basesList[0].productions[0].inputs![0].id;
    await act(async () => {
        harness.dispatchSync([appIds.events.BASES_DELETE_BASE, 'source']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_REMOVE_INPUT, 'base', 'plan', inputId]);
        await harness.flush();
    });
    expect(harness.getState().basesList[0].productions[0].inputs).toEqual([]);
    expect(harness.getState().basesList[0].buildings).not.toContainEqual(expect.objectContaining({ id: inputId }));
});

it('preselects the extractor and opens its material dialog in Advanced mode', async () => {
    const harness = setup('advanced', 'ore');
    const buildings = screen.getByRole('dialog', { name: 'Select Building' });
    expect(within(buildings).getByRole('button', { name: /Ore Miner/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(buildings).queryByRole('switch')).not.toBeInTheDocument();
    const material = screen.getByRole('dialog', { name: 'Select Item for Ore Miner' });
    expect(within(material).getByPlaceholderText('Search items...')).toHaveFocus();
    expect(within(material).getByRole('button', { name: /ore/ })).toHaveAttribute('aria-pressed', 'true');
    expect(within(material).getByLabelText('Rate per Minute')).toHaveValue(60);
    fireEvent.click(within(material).getByRole('button', { name: 'Confirm' }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { buildingTypeId: 'miner', selectedItemId: 'ore', ratePerMinute: 60 },
    ]));
});

it.each([false, true])('allows linking another depot version in Advanced mode (saved diagram: %s)', async saved => {
    const harness = setup('advanced', 'plate', saved);
    const buildings = screen.getByRole('dialog', { name: 'Select Building' });
    expect(screen.queryByRole('dialog', { name: /Select Item/ })).not.toBeInTheDocument();
    fireEvent.click(within(buildings).getByRole('button', { name: /Storage Depot v1/ }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Select material' }));
    const material = screen.getByRole('dialog', { name: 'Select Item for Storage Depot v1' });
    expect(within(material).getByRole('button', { name: /plate/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(material).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(buildings).getByRole('radio', { name: /Linked output/ }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Source output' }));
    const targets = screen.getByRole('dialog', { name: 'Link Output' });
    expect(within(targets).queryByRole('button', { name: /Ore supply/ })).not.toBeInTheDocument();
    expect(within(targets).queryByRole('button', { name: /Plate supply|Occupied supply/ })).not.toBeInTheDocument();
    expect(within(targets).getByRole('button', { name: /Stored plates/ })).toBeEnabled();
    fireEvent.click(within(targets).getByRole('button', { name: /Other storage type/ }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { buildingTypeId: 'storage_depot_v1', linkedOutput: { baseId: 'source', buildingId: 'storage-v2' } },
    ]));
});


it('shows occupied compatible dispatchers and blocks a source claimed while the form is open', async () => {
    const harness = setup('advanced', 'plate');
    const buildings = screen.getByRole('dialog', { name: 'Select Building' });
    fireEvent.click(within(buildings).getByRole('button', { name: /Receiver/ }));
    fireEvent.click(within(buildings).getByRole('radio', { name: /Linked output/ }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Link output' }));
    const picker = screen.getByRole('dialog', { name: 'Link Output' });
    expect(within(picker).queryByRole('button', { name: /Stored plates|Other storage type/ })).not.toBeInTheDocument();
    const occupied = within(picker).getByRole('article', { name: /— Dispatcher \(Occupied supply\)/ });
    expect(within(picker).queryByRole('button', { name: /Connect .*Occupied supply/ })).not.toBeInTheDocument();
    expect(within(picker).getByRole('article', { name: 'Source / Receiver' })).toBeVisible();
    fireEvent.click(occupied);
    expect(picker).toBeVisible();
    fireEvent.click(within(picker).getByRole('button', { name: /Plate supply/ }));
    expect(within(buildings).getByRole('button', { name: 'Add' })).toBeEnabled();

    await act(async () => {
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'source', 'package_receiver', 'inputs', 1,
            'Another receiver', undefined, 'plate', 60, { baseId: 'source', buildingId: 'plates' }]);
        await harness.flush();
    });
    expect(within(buildings).getByRole('alert')).toHaveTextContent('This connection is no longer available. Choose another building.');
    expect(within(buildings).getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(harness.getState().basesList[0].buildings).toEqual([]);
});

it('creates matching storage automatically from the Planning target picker', async () => {
    const harness = setup('planning', 'plate', true);
    fireEvent.click(screen.getByRole('button', { name: 'Select target' }));
    fireEvent.click(screen.getByRole('button', { name: /Other storage type/ }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { buildingTypeId: 'storage_depot_v2', linkedOutput: { baseId: 'source', buildingId: 'storage-v2' } },
    ]));
});

it('cancels the disconnect confirmation with Escape while keeping the Planning input picker open', async () => {
    const harness = setup('planning', 'plate');
    const basesBefore = harness.getState().basesList;
    const picker = screen.getByRole('dialog', { name: 'Add new input' });
    fireEvent.click(within(picker).getByRole('button', { name: 'Select target' }));
    const disconnect = within(picker).getByRole('button', { name: 'Disconnect Source / Occupied supply' });
    disconnect.focus();
    fireEvent.click(disconnect);
    const confirmation = await screen.findByRole('alertdialog', { name: 'Disconnect' });
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(within(confirmation).getByRole('button', { name: 'Cancel' }), escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(picker).toBeInTheDocument();
    // jsdom does not generate the native dialog's cancel event after an unhandled Escape.
    fireEvent(confirmation, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(picker).toBeVisible();
    expect(disconnect).toHaveFocus();
    expect(harness.getState().basesList).toEqual(basesBefore);
});

it('cancels the nested output picker with Escape without discarding the Advanced building form', () => {
    const harness = setup('advanced', 'plate');
    const basesBefore = harness.getState().basesList;
    const buildings = screen.getByRole('dialog', { name: 'Select Building' });
    fireEvent.click(within(buildings).getByRole('button', { name: /Receiver/ }));
    fireEvent.click(within(buildings).getByRole('radio', { name: /Linked output/ }));
    const trigger = within(buildings).getByRole('button', { name: 'Link output' });
    trigger.focus();
    fireEvent.click(trigger);
    const picker = screen.getByRole('dialog', { name: 'Link Output' });
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    fireEvent(within(picker).getByRole('searchbox'), escape);
    expect(escape.defaultPrevented).toBe(false);
    expect(buildings).toBeInTheDocument();
    // Complete the browser's native Escape behavior, which jsdom does not implement.
    fireEvent(picker, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Link Output' })).not.toBeInTheDocument();
    expect(buildings).toBeVisible();
    expect(within(buildings).getByRole('radio', { name: /Linked output/ })).toBeChecked();
    expect(trigger).toHaveFocus();
    expect(harness.getState().basesList).toEqual(basesBefore);
});
