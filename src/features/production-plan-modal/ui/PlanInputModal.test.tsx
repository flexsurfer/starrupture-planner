import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { NodeInputButton } from '@/features/planner/ui/visualization/NodeInputButton';
import type { FlowNode } from '@/features/planner/types';
import { usePlanInputActions } from './usePlanInputActions';

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => {
    cleanup();
    runtimes.splice(0).forEach(runtime => runtime.dispose());
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
            { id: 'storage_depot_v1', name: 'Storage Depot v1', type: 'storage' },
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
            { id: 'ore', name: 'Ore supply', buildingTypeId: 'package_dispatcher', sectionType: 'outputs', selectedItemId: 'ore', ratePerMinute: 60 },
            { id: 'occupied', name: 'Occupied supply', buildingTypeId: 'package_dispatcher', sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
            { id: 'reservation', buildingTypeId: 'package_receiver', sectionType: 'inputs', linkedOutput: { baseId: 'source', buildingId: 'occupied' } },
        ] }],
    });
    if (!saved) harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, 'plan']);
    render(<UkladProvider runtime={runtime}><InputButton itemId={itemId} saved={saved} /></UkladProvider>);
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
    expect(within(dialog).queryByRole('button', { name: /Ore supply|Occupied supply/ })).not.toBeInTheDocument();
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

it.each([false, true])('allows selecting a building and linked output in Advanced mode (saved diagram: %s)', async saved => {
    const harness = setup('advanced', 'plate', saved);
    const buildings = screen.getByRole('dialog', { name: 'Select Building' });
    expect(screen.queryByRole('dialog', { name: /Select Item/ })).not.toBeInTheDocument();
    fireEvent.click(within(buildings).getByRole('button', { name: /Storage Depot v1/ }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Select material' }));
    const material = screen.getByRole('dialog', { name: 'Select Item for Storage Depot v1' });
    expect(within(material).getByRole('button', { name: /plate/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(material).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(within(buildings).getByRole('radio', { name: /Linked output/ }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Link output' }));
    const targets = screen.getByRole('dialog', { name: 'Link Output' });
    expect(within(targets).queryByRole('button', { name: /Ore supply/ })).not.toBeInTheDocument();
    fireEvent.click(within(targets).getByRole('button', { name: /Plate supply/ }));
    fireEvent.click(within(buildings).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { buildingTypeId: 'storage_depot_v1', linkedOutput: { baseId: 'source', buildingId: 'plates' } },
    ]));
});
