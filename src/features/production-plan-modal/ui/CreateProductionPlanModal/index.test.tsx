import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { CreateProductionPlanModal } from './index';

vi.mock('./components/DiagramSection', () => ({ DiagramSection: () => null }));

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => {
    cleanup();
    runtimes.splice(0).forEach(runtime => runtime.dispose());
});

function setup(planning = false) {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    harness.restoreState({
        ...harness.getState(),
        basesSelectedBaseId: 'base',
        basesMode: planning ? 'planning' : null,
        itemsList: [
            { id: 'plate', name: 'Plate', type: 'processed' },
            { id: 'ore', name: 'Ore', type: 'raw' },
            { id: 'product', name: 'Product', type: 'component' },
        ],
        itemsById: { plate: { id: 'plate', name: 'Plate', type: 'processed' }, ore: { id: 'ore', name: 'Ore', type: 'raw' }, product: { id: 'product', name: 'Product', type: 'component' } },
        buildingsList: [
            { id: 'package_dispatcher', name: 'Rail output', type: 'logistics' },
            { id: 'package_receiver', name: 'Rail input', type: 'logistics' },
            { id: 'storage', name: 'Storage', type: 'storage' },
            { id: 'smelter', name: 'Smelter', type: 'production', recipes: [
                { output: { id: 'plate', amount_per_minute: 60 }, inputs: [{ id: 'ore', amount_per_minute: 60 }] },
            ] },
            { id: 'factory', name: 'Factory', type: 'production', recipes: [
                { output: { id: 'product', amount_per_minute: 30 }, inputs: [{ id: 'plate', amount_per_minute: 60 }] },
            ] },
        ],
        basesList: [{ id: 'base', name: 'Base', productions: [], buildings: [
            { id: 'input', buildingTypeId: 'storage', sectionType: 'inputs', selectedItemId: 'ore', ratePerMinute: 120 },
        ] }, { id: 'source', name: 'Ore base', productions: [], buildings: [
            { id: 'output', buildingTypeId: 'package_dispatcher', sectionType: 'outputs', selectedItemId: 'ore', ratePerMinute: 60, name: 'Ore output' },
        ] }],
    });
    const storage = memoryStorageAdapter();
    persist(runtime, { storage, keys: [stateKeys.basesList] }).hydrate();
    harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
    render(<UkladProvider runtime={runtime}><CreateProductionPlanModal /></UkladProvider>);
    return { harness, storage };
}

it('autosaves creation and the last keystroke before Back, then restores after reload', async () => {
    const { harness, storage } = setup();
    expect(screen.queryByRole('button', { name: /cancel|save|create plan/i })).not.toBeInTheDocument();
    expect(harness.getState().basesList[0].productions).toHaveLength(0);
    fireEvent.change(screen.getByLabelText('Production item'), { target: { value: 'plate' } });
    await waitFor(() => expect(screen.getByLabelText('Plan name')).toHaveValue('Plate Production'));
    const id = harness.getState().basesList[0].productions[0].id;
    fireEvent.change(screen.getByLabelText('Plan name'), { target: { value: 'My plates' } });
    fireEvent.change(screen.getByLabelText('Target items per minute'), { target: { value: '125' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Production' }));
    await waitFor(() => expect(screen.queryByLabelText('Plan name')).not.toBeInTheDocument());
    expect(harness.getState().basesList[0].productions).toMatchObject([{ id, name: 'My plates', targetAmount: 125 }]);
    expect(harness.getState().basesList[0].productions).toHaveLength(1);
    await harness.flush();

    const restored = createAppRuntime();
    runtimes.push(restored);
    persist(restored, { storage, keys: [stateKeys.basesList] }).hydrate();
    expect(createUkladTestHarness(restored).getState().basesList[0].productions).toMatchObject([{ id, name: 'My plates', targetAmount: 125 }]);
});

it('keeps the input list across modes and building selection in Advanced mode', async () => {
    const { harness } = setup(true);
    expect(screen.queryByRole('button', { name: /Add external item|Add input/ })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Production plan inputs' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Production item'), { target: { value: 'plate' } });
    await waitFor(() => expect(harness.getState().basesList[0].productions).toHaveLength(1));
    const saved = harness.getState().basesList;
    fireEvent.click(screen.getByRole('switch', { name: 'Advanced' }));
    const add = await screen.findByRole('button', { name: 'Add input' });
    expect(screen.getByRole('region', { name: 'Production plan inputs' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Match inputs' })).toBeInTheDocument();
    fireEvent.click(add);
    const buildingDialog = await screen.findByRole('dialog', { name: 'Select Building' });
    expect(within(buildingDialog).getByRole('button', { name: /Storage/ })).toBeInTheDocument();
    expect(within(buildingDialog).queryByRole('switch', { name: 'Advanced' })).not.toBeInTheDocument();
    fireEvent.click(within(buildingDialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Advanced' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Add input' })).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Production plan inputs' })).toBeInTheDocument();
    expect(harness.getState().basesList).toEqual(saved);
    expect(screen.getByLabelText('Plan name')).toHaveValue('Plate Production');
});

it('keeps a broken Planning input visible and removes its owned receiver', async () => {
    const { harness } = setup(true);
    await act(async () => {
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'plate']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, 'source', 'output']);
    });
    const inputId = harness.getState().basesList[0].productions[0].inputs![0].id;
    expect(screen.getByRole('button', { name: /Remove input Ore from Ore base/ })).toBeInTheDocument();

    await act(async () => { harness.dispatchSync([appIds.events.BASES_DELETE_BASE, 'source']); });
    expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW]).nodes
        .some(node => node.baseBuildingId === inputId)).toBe(false);
    expect(screen.getByText('Link broken')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Remove input Ore/ }));

    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toEqual([]));
    expect(harness.getState().productionPlanModalState.selectedInputIds).toEqual([]);
    expect(harness.getState().basesList[0].buildings.some(building => building.id === inputId)).toBe(false);
    expect(screen.queryByRole('button', { name: /Remove input Ore/ })).not.toBeInTheDocument();
});

it('removes an unused Planning input and releases its reserved source output', async () => {
    const { harness } = setup(true);
    await act(async () => {
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'product']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT, 'source', 'output']);
    });
    const planId = harness.getState().basesList[0].productions[0].id;
    const inputId = harness.getState().basesList[0].productions[0].inputs![0].id;
    await act(async () => {
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_ADD_INPUT, 'base', planId, 'plate', 60, 'storage']);
    });
    const flow = harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW]);
    expect(flow.nodes.some(node => node.outputItem === 'ore')).toBe(false);
    expect(harness.getState().basesList[0].productions[0].inputs).toHaveLength(2);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, 'base', planId, 'ore'])).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: /Remove input Ore from Ore base/ }));
    await waitFor(() => expect(harness.getState().basesList[0].productions[0].inputs).toMatchObject([
        { selectedItemId: 'plate', ratePerMinute: 60 },
    ]));
    expect(harness.getState().basesList[0].buildings.some(building => building.id === inputId)).toBe(false);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW])).toEqual(flow);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, 'base', planId, 'ore'])).toMatchObject([
        { baseId: 'source', baseBuildingId: 'output' },
    ]);
});

it('autosaves input selection and matched amount to the same plan, preserving valid data during incomplete edits', async () => {
    const { harness } = setup();
    fireEvent.change(screen.getByLabelText('Production item'), { target: { value: 'plate' } });
    await waitFor(() => expect(harness.getState().basesList[0].productions).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: /Ore.*120.*Storage/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Match inputs' }));
    await waitFor(() => expect(screen.getByLabelText('Target items per minute')).toHaveValue(120));
    expect(screen.getByLabelText('Target items per minute')).toBeDisabled();
    const savedPlan = harness.getState().basesList[0].productions[0];
    expect(savedPlan).toMatchObject({ targetAmount: 120, inputs: [{ id: 'input' }], requiredBuildings: [{ buildingId: 'smelter', count: 2 }] });
    fireEvent.change(screen.getByLabelText('Plan name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Production' }));
    await waitFor(() => expect(screen.queryByLabelText('Plan name')).not.toBeInTheDocument());
    expect(harness.getState().basesList[0].productions).toEqual([savedPlan]);
    await act(async () => { harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, savedPlan.id]); });
    expect(screen.getByLabelText('Plan name')).toHaveValue('Plate Production');
    fireEvent.change(screen.getByLabelText('Target items per minute'), { target: { value: '90' } });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Production' }));
    await waitFor(() => expect(harness.getState().basesList[0].productions).toMatchObject([{ id: savedPlan.id, targetAmount: 90 }]));
});

it('selects newly added inputs and autosaves the matched rate without selecting existing inputs', async () => {
    const { harness } = setup();
    await act(async () => {
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'plate']);
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, true]);
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'base', 'storage', 'inputs', 1, 'New input', undefined, 'ore', 90]);
    });
    const state = harness.getState();
    const added = state.basesList[0].buildings.find(building => building.name === 'New input')!;
    expect(state.productionPlanModalState.selectedInputIds).toEqual([added.id]);
    expect(state.basesList[0].productions).toMatchObject([{ targetAmount: 90, inputs: [{ id: added.id }] }]);
    expect(screen.getByRole('button', { name: /Ore.*90.*New input/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Target items per minute')).toHaveValue(90);

    await act(async () => {
        harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
        harness.dispatchSync([appIds.events.BASES_ADD_BUILDINGS, 'base', 'storage', 'inputs', 1, 'Outside editor', undefined, 'ore', 30]);
    });
    expect(harness.getState().productionPlanModalState.selectedInputIds).toEqual([]);
    expect(harness.getState().basesList[0].productions[0].targetAmount).toBe(90);
});
