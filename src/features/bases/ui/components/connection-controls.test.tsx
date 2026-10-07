import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { BuildingSection } from './BuildingSection';
import { AddBuildingCardModal } from '../modals/AddBuildingCardModal';
import { ConfirmationDialog } from '@/features/app-shell/ui/ConfirmationDialog';

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

const connectionTypes = [
    { outputType: 'package_dispatcher', outputName: 'Dispatcher', inputType: 'package_receiver', inputName: 'Receiver' },
    { outputType: 'drone_rail', outputName: 'Drone Rail', inputType: 'drone_merger_3_to_1', inputName: 'Drone Merger' },
    { outputType: 'drone_merger_3_to_1', outputName: 'Drone Merger', inputType: 'drone_rail', inputName: 'Drone Rail' },
];

function setup(outputType = 'package_dispatcher', inputType = 'package_receiver') {
    const runtime = createAppRuntime();
    runtime.registerModule(registerApplicationModules);
    runtimes.push(runtime);
    const harness = createUkladTestHarness(runtime);
    harness.restoreState({ ...harness.getState(), basesMode: 'advanced', basesSelectedBaseId: 'source',
        buildingsList: [
            { id: 'package_receiver', name: 'Receiver', type: 'logistics' },
            { id: 'package_dispatcher', name: 'Dispatcher', type: 'logistics' },
            { id: 'storage_v1', name: 'Storage v1', type: 'storage', upgrade: 'storage_v2' },
            { id: 'storage_v2', name: 'Storage v2', type: 'storage' },
            { id: 'drone_rail', name: 'Drone Rail', type: 'transport' },
            { id: 'drone_merger_3_to_1', name: 'Drone Merger', type: 'transport' },
        ],
        itemsList: [{ id: 'plate', name: 'Plate', type: 'processed' }],
        basesList: [{ id: 'source', name: 'Source', productions: [], buildings: [
            { id: 'output', name: 'Main supply', buildingTypeId: outputType, sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 120 },
            { id: 'other-output', name: 'Reserve supply', buildingTypeId: outputType, sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
            { id: 'storage-output', buildingTypeId: 'storage_v1', sectionType: 'outputs', selectedItemId: 'plate', ratePerMinute: 60 },
        ] }, { id: 'target', name: 'Target', productions: [], buildings: [
            { id: 'input', name: 'North dock', buildingTypeId: inputType, sectionType: 'inputs', linkedOutput: { baseId: 'source', buildingId: 'output' } },
            { id: 'free-input', name: 'South dock', buildingTypeId: inputType, sectionType: 'inputs' },
            { id: 'storage-input', buildingTypeId: 'storage_v1', sectionType: 'inputs' },
            { id: 'storage-v2-input', buildingTypeId: 'storage_v2', sectionType: 'inputs' },
        ] }],
    });
    return { runtime, harness };
}

it.each(connectionTypes)('opens Source for $outputName → $inputName and requires disconnecting before choosing another output', async ({ outputType, inputType, inputName }) => {
    const { runtime, harness } = setup(outputType, inputType);
    render(<UkladProvider runtime={runtime}><BuildingSection title="Inputs" description="" baseId="target" sectionType="inputs" onAdd={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const free = within(screen.getByRole('heading', { name: 'South dock' }).closest('article')!);
    expect(free.getByRole('button', { name: 'Source' })).toHaveTextContent('Manual');
    const card = within(screen.getByRole('heading', { name: 'North dock' }).closest('article')!);
    expect(card.getByRole('button', { name: 'Source' })).toHaveTextContent('Source / Main supply');
    expect(card.queryByRole('button', { name: /^Disconnect/ })).not.toBeInTheDocument();
    fireEvent.click(card.getByRole('button', { name: 'Source' }));
    const picker = within(screen.getByRole('dialog', { name: 'Link Output' }));
    const currentBuilding = within(picker.getByRole('article', { name: 'Current building' }));
    expect(currentBuilding.getByLabelText('Base')).toHaveTextContent('Target');
    expect(currentBuilding.getByText(`${inputName} (North dock)`)).toBeVisible();
    expect(currentBuilding.getByText('120/min')).toBeVisible();
    expect(picker.queryByRole('button', { name: /Storage/ })).not.toBeInTheDocument();
    expect(picker.getByText('Connected to Source / Main supply. Disconnect first.')).toBeVisible();
    expect(picker.getByRole('button', { name: /Reserve supply/ })).toBeDisabled();
    fireEvent.click(picker.getByRole('button', { name: /Reserve supply/ }));
    expect(harness.getState().basesList[1].buildings[0].linkedOutput?.buildingId).toBe('output');
    fireEvent.click(picker.getByRole('button', { name: 'Disconnect' }));
    await confirmDisconnect();
    await waitFor(() => expect(picker.getByRole('button', { name: /Reserve supply/ })).toBeEnabled());
    expect(harness.getState().basesList[1].buildings[0].selectedItemId).toBeUndefined();
    expect(harness.getState().basesList[1].buildings[0].ratePerMinute).toBeUndefined();
    expect(currentBuilding.getByText('No material configured')).toBeVisible();
    expect(currentBuilding.queryByText('120/min')).not.toBeInTheDocument();
    fireEvent.change(picker.getByRole('searchbox', { name: 'Search outputs' }), { target: { value: 'reserve' } });
    expect(picker.queryByRole('button', { name: /Main supply/ })).not.toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', { name: /Reserve supply/ }));
    await waitFor(() => expect(card.getByRole('button', { name: 'Source' })).toHaveTextContent('Source / Reserve supply'));
    expect(screen.queryByRole('dialog', { name: 'Link Output' })).not.toBeInTheDocument();
});

it.each(connectionTypes)('shows occupied Target details for $outputName → $inputName and requires disconnecting before linking another input', async ({ outputType, outputName, inputType }) => {
    const { runtime, harness } = setup(outputType, inputType);
    render(<UkladProvider runtime={runtime}><BuildingSection title="Outputs" description="" baseId="source" sectionType="outputs" onAdd={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const main = within(screen.getByRole('heading', { name: 'Main supply' }).closest('article')!);
    const reserve = within(screen.getByRole('heading', { name: 'Reserve supply' }).closest('article')!);
    expect(main.queryByRole('button', { name: /^Disconnect/ })).not.toBeInTheDocument();
    fireEvent.click(reserve.getByRole('button', { name: 'Target' }));
    let picker = within(screen.getByRole('dialog', { name: 'Link Input' }));
    expect(picker.queryByRole('button', { name: /Connect .*North dock/ })).not.toBeInTheDocument();
    expect(picker.getByRole('article', { name: 'Source / Main supply' })).toHaveTextContent(`${outputName} (Main supply)`);
    const targetGroup = within(picker.getByRole('region', { name: 'Target' }));
    expect(targetGroup.getAllByRole('group')).toHaveLength(2);
    expect(targetGroup.getByRole('group', { name: /North dock/ }).querySelectorAll('article')).toHaveLength(2);
    expect(targetGroup.getByRole('group', { name: /South dock/ }).querySelectorAll('article')).toHaveLength(1);
    fireEvent.change(picker.getByRole('searchbox'), { target: { value: 'Main supply' } });
    expect(picker.getByRole('article', { name: 'Source / Main supply' })).toBeVisible();
    expect(picker.queryByRole('button', { name: /South dock/ })).not.toBeInTheDocument();
    fireEvent.change(picker.getByRole('searchbox'), { target: { value: '' } });
    expect(picker.queryByRole('button', { name: /Storage/ })).not.toBeInTheDocument();
    expect(picker.getByRole('button', { name: /South dock/ })).toBeEnabled();
    fireEvent.click(picker.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(main.getByRole('button', { name: 'Target' }));
    picker = within(screen.getByRole('dialog', { name: 'Link Input' }));
    expect(picker.getByRole('button', { name: /South dock/ })).toBeDisabled();
    expect(picker.getByText('Connected to Target / North dock. Disconnect first.')).toBeVisible();
    fireEvent.click(picker.getByRole('button', { name: 'Disconnect' }));
    await confirmDisconnect();
    await waitFor(() => expect(picker.getByRole('button', { name: /South dock/ })).toBeEnabled());
    fireEvent.change(picker.getByRole('searchbox', { name: 'Search inputs' }), { target: { value: 'south' } });
    expect(picker.queryByRole('button', { name: /North dock/ })).not.toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', { name: /South dock/ }));
    await waitFor(() => expect(harness.getState().basesList[1].buildings[1].linkedOutput?.buildingId).toBe('output'));
    expect(main.getByRole('button', { name: 'Target' })).toHaveTextContent('Target / South dock');
    expect(reserve.getByRole('button', { name: 'Target' })).toHaveTextContent('No target');
    expect(harness.getState().basesList[1].buildings[0].linkedOutput).toBeUndefined();
});

it('offers compatible storage versions as add-output targets and rejects a selection that becomes occupied', async () => {
    const { runtime, harness } = setup();
    const onAdd = vi.fn();
    render(<UkladProvider runtime={runtime}><AddBuildingCardModal isOpen baseId="source" sectionType="outputs" onAdd={onAdd} onClose={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const dialog = within(screen.getByRole('dialog', { name: 'Select Building' }));
    fireEvent.click(dialog.getByRole('button', { name: /Storage v1/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Target' }));
    let picker = within(screen.getByRole('dialog', { name: 'Link Input' }));
    expect(picker.getByRole('button', { name: /Storage v1/ })).toBeEnabled();
    expect(picker.getByRole('button', { name: /Storage v2/ })).toBeEnabled();
    expect(picker.queryByRole('button', { name: /Receiver/ })).not.toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', { name: /Storage v2/ }));
    expect(dialog.getByRole('button', { name: 'Target' })).toHaveTextContent('Target / Storage v2');
    fireEvent.click(dialog.getByRole('button', { name: /Dispatcher/ }));
    fireEvent.change(dialog.getByPlaceholderText('Dispatcher'), { target: { value: 'New dock' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Target' }));
    picker = within(screen.getByRole('dialog', { name: 'Link Input' }));
    const draftBuilding = within(picker.getByRole('article', { name: 'Current building' }));
    expect(draftBuilding.getByText('Dispatcher (New dock)')).toBeVisible();
    expect(draftBuilding.getByLabelText('Base')).toHaveTextContent('Source');
    expect(draftBuilding.getByText('No material configured')).toBeVisible();
    expect(picker.queryByRole('button', { name: /Connect .*North dock/ })).not.toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', { name: /South dock/ }));
    expect(dialog.getByRole('button', { name: 'Target' })).toHaveTextContent('Target / South dock');
    await act(async () => {
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'target', 'free-input', 'source', 'other-output']);
        await harness.flush();
    });
    expect(dialog.getByRole('button', { name: 'Add' })).toBeDisabled();
    expect(dialog.getByRole('alert')).toHaveTextContent('This connection is no longer available. Choose another building.');
    fireEvent.click(dialog.getByRole('button', { name: 'Add' }));
    expect(onAdd).not.toHaveBeenCalled();
});

it('can clear an unsaved target and cancel the picker without changing the selection', () => {
    const { runtime, harness } = setup();
    const onAdd = vi.fn();
    render(<UkladProvider runtime={runtime}><AddBuildingCardModal isOpen baseId="source" sectionType="outputs" onAdd={onAdd} onClose={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const dialog = within(screen.getByRole('dialog', { name: 'Select Building' }));
    fireEvent.click(dialog.getByRole('button', { name: /Dispatcher/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Target' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Link Input' })).getByRole('button', { name: /South dock/ }));
    expect(harness.getState().basesList[1].buildings[1].linkedOutput).toBeUndefined();
    fireEvent.click(dialog.getByRole('button', { name: 'Target' }));
    fireEvent(screen.getByRole('dialog', { name: 'Link Input' }), new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Link Input' })).not.toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Target' })).toHaveTextContent('Target / South dock');
    fireEvent.click(dialog.getByRole('button', { name: 'Target' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Link Input' })).getByRole('button', { name: 'No target' }));
    expect(dialog.getByRole('button', { name: 'Target' })).toHaveTextContent('No target');
    fireEvent.click(dialog.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ buildingTypeId: 'package_dispatcher', linkedInputRef: undefined }));
});

it('shows an empty search result and starts with an empty search when reopened', () => {
    const { runtime, harness } = setup();
    render(<UkladProvider runtime={runtime}><BuildingSection title="Inputs" description="" baseId="target" sectionType="inputs" onAdd={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const card = within(screen.getByRole('heading', { name: 'South dock' }).closest('article')!);
    const trigger = card.getByRole('button', { name: 'Source' });
    trigger.focus();
    fireEvent.click(trigger);
    const picker = screen.getByRole('dialog', { name: 'Link Output' });
    fireEvent.change(within(picker).getByRole('searchbox'), { target: { value: 'nonexistent' } });
    expect(within(picker).getByText('No compatible outputs found.')).toBeVisible();
    fireEvent(picker, new Event('cancel', { cancelable: true }));
    expect(trigger).toHaveFocus();
    expect(harness.getState().basesList[1].buildings[1].linkedOutput).toBeUndefined();
    fireEvent.click(card.getByRole('button', { name: 'Source' }));
    expect(within(screen.getByRole('dialog', { name: 'Link Output' })).getByRole('searchbox')).toHaveValue('');
});

it('keeps an incompatible saved link visible and removable from its popup', async () => {
    const { runtime, harness } = setup();
    const state = harness.getState();
    harness.restoreState({ ...state, basesList: state.basesList.map(base => base.id !== 'target' ? base : {
        ...base, buildings: base.buildings.map(building => building.id !== 'input' ? building : {
            ...building, linkedOutput: { baseId: 'source', buildingId: 'storage-output' },
        }),
    }) });
    render(<UkladProvider runtime={runtime}><BuildingSection title="Inputs" description="" baseId="target" sectionType="inputs" onAdd={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const card = within(screen.getByRole('heading', { name: 'North dock' }).closest('article')!);
    expect(card.getByRole('button', { name: 'Source' })).toHaveAttribute('title', 'Source / Storage v1');
    expect(card.getByText('This saved connection is incompatible. Disconnect it before choosing another.')).toBeVisible();
    fireEvent.click(card.getByRole('button', { name: 'Source' }));
    const picker = within(screen.getByRole('dialog', { name: 'Link Output' }));
    expect(picker.getByText('Connected to Source / Storage v1. Disconnect first.')).toBeVisible();
    fireEvent.click(picker.getByRole('button', { name: 'Disconnect' }));
    await confirmDisconnect();
    await waitFor(() => expect(picker.getByRole('button', { name: /Reserve supply/ })).toBeEnabled());
    expect(picker.queryByRole('button', { name: /Storage/ })).not.toBeInTheDocument();
});

async function confirmDisconnect() {
    const confirmation = await screen.findByRole('alertdialog', { name: 'Disconnect' });
    fireEvent.click(within(confirmation).getByRole('button', { name: /^Disconnect/ }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
}

it('confirms an occupied output card disconnect, supports cancellation, and stays in the source picker', async () => {
    const { runtime, harness } = setup();
    render(<UkladProvider runtime={runtime}><BuildingSection title="Inputs" description="" baseId="target" sectionType="inputs" onAdd={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const card = within(screen.getByRole('heading', { name: 'South dock' }).closest('article')!);
    fireEvent.click(card.getByRole('button', { name: 'Source' }));
    const picker = within(screen.getByRole('dialog', { name: 'Link Output' }));
    const disconnect = picker.getByRole('button', { name: 'Disconnect Source / Main supply' });
    disconnect.focus();
    fireEvent.click(disconnect);
    const confirmation = await screen.findByRole('alertdialog', { name: 'Disconnect' });
    expect(confirmation).toHaveTextContent('Source / Main supply → Target / North dock');
    expect(confirmation).toHaveTextContent('Inputs will return to manual mode with no material or rate configured.');
    expect(harness.getState().basesList[1].buildings[0].linkedOutput?.buildingId).toBe('output');
    expect(within(confirmation).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent(confirmation, new Event('cancel', { cancelable: true }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(disconnect).toHaveFocus();
    expect(picker.queryByRole('button', { name: /Connect .*Main supply/ })).not.toBeInTheDocument();
    fireEvent.click(disconnect);
    await confirmDisconnect();
    expect(picker.getByRole('button', { name: /— Dispatcher \(Main supply\)/ })).toBeEnabled();
    expect(picker.queryByRole('button', { name: 'Disconnect Source / Main supply' })).not.toBeInTheDocument();
    expect(picker.getByRole('searchbox')).toHaveFocus();
    expect(harness.getState().basesList[1].buildings[0].selectedItemId).toBeUndefined();
    expect(harness.getState().basesList[1].buildings[0].ratePerMinute).toBeUndefined();
    expect(harness.getState().basesList[1].buildings[1].linkedOutput).toBeUndefined();
    fireEvent.click(picker.getByRole('button', { name: /— Dispatcher \(Main supply\)/ }));
    await waitFor(() => expect(harness.getState().basesList[1].buildings[1].linkedOutput?.buildingId).toBe('output'));
});

it('frees an occupied input from the Target picker only after confirmation', async () => {
    const { runtime, harness } = setup();
    render(<UkladProvider runtime={runtime}><BuildingSection title="Outputs" description="" baseId="source" sectionType="outputs" onAdd={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const card = within(screen.getByRole('heading', { name: 'Reserve supply' }).closest('article')!);
    fireEvent.click(card.getByRole('button', { name: 'Target' }));
    const picker = within(screen.getByRole('dialog', { name: 'Link Input' }));
    fireEvent.click(picker.getByRole('button', { name: 'Disconnect Target / North dock' }));
    const confirmation = await screen.findByRole('alertdialog', { name: 'Disconnect' });
    expect(confirmation).toHaveTextContent('Source / Main supply → Target / North dock');
    expect(confirmation).toHaveTextContent('Inputs will return to manual mode with no material or rate configured.');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(picker.queryByRole('button', { name: /Connect .*North dock/ })).not.toBeInTheDocument();
    fireEvent.click(picker.getByRole('button', { name: 'Disconnect Target / North dock' }));
    await confirmDisconnect();
    expect(picker.getByRole('button', { name: /— Receiver \(North dock\)/ })).toBeEnabled();
    fireEvent.click(picker.getByRole('button', { name: /— Receiver \(North dock\)/ }));
    await waitFor(() => expect(harness.getState().basesList[1].buildings[0].linkedOutput?.buildingId).toBe('other-output'));
});

it('does not break a newer connection if the selected card changes while confirmation is open', async () => {
    const { runtime, harness } = setup();
    render(<UkladProvider runtime={runtime}><AddBuildingCardModal isOpen baseId="source" sectionType="outputs" onAdd={() => {}} onClose={() => {}} /><ConfirmationDialog /></UkladProvider>);
    const dialog = within(screen.getByRole('dialog', { name: 'Select Building' }));
    fireEvent.click(dialog.getByRole('button', { name: /Dispatcher/ }));
    fireEvent.click(dialog.getByRole('button', { name: 'Target' }));
    const picker = within(screen.getByRole('dialog', { name: 'Link Input' }));
    fireEvent.click(picker.getByRole('button', { name: 'Disconnect Target / North dock' }));
    await screen.findByRole('alertdialog', { name: 'Disconnect' });
    await act(async () => {
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, 'target', 'input', 'plate', 120]);
        harness.dispatchSync([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'target', 'input', 'source', 'other-output']);
        await harness.flush();
    });
    await confirmDisconnect();
    expect(harness.getState().basesList[1].buildings[0].linkedOutput?.buildingId).toBe('other-output');
    expect(picker.getByRole('article', { name: 'Source / Reserve supply' })).toHaveTextContent('Dispatcher (Reserve supply)');
    expect(dialog.getByRole('button', { name: 'Target' })).toHaveTextContent('No target');
});

it('shows the current building, base badges and production plans across both picker directions', () => {
    const { runtime, harness } = setup();
    const state = harness.getState();
    harness.restoreState({ ...state, basesList: state.basesList.map(base => base.id !== 'source' ? base : {
        ...base,
        productions: [{ id: 'plate-plan', name: 'Plate exports', selectedItemId: 'plate', targetAmount: 180 }],
        buildings: base.buildings.map(building => building.id !== 'output' ? building : {
            ...building, sourceProductionId: 'plate-plan', allocationMode: 'auto' as const,
        }),
    }) });
    render(<UkladProvider runtime={runtime}>
        <BuildingSection title="Outputs" description="" baseId="source" sectionType="outputs" onAdd={() => {}} />
        <BuildingSection title="Inputs" description="" baseId="target" sectionType="inputs" onAdd={() => {}} />
    </UkladProvider>);
    const outputCard = within(screen.getByRole('heading', { name: 'Main supply' }).closest('article')!);
    fireEvent.click(outputCard.getByRole('button', { name: 'Target' }));
    let picker = within(screen.getByRole('dialog', { name: 'Link Input' }));
    const currentOutput = within(picker.getByRole('article', { name: 'Current building' }));
    expect(currentOutput.getByText('Dispatcher (Main supply)')).toBeVisible();
    expect(currentOutput.getByLabelText('Base')).toHaveTextContent('Source');
    expect(currentOutput.getByLabelText('Plan')).toHaveTextContent('Plate exports');
    expect(currentOutput.getByText('180/min')).toBeVisible();
    expect(within(picker.getByRole('article', { name: 'Source / Main supply' })).getByLabelText('Plan')).toHaveTextContent('Plate exports');
    for (const card of picker.getAllByRole('article')) expect(within(card).getByLabelText('Base')).not.toBeEmptyDOMElement();
    fireEvent.click(picker.getByRole('button', { name: 'Cancel' }));

    const inputCard = within(screen.getByRole('heading', { name: 'South dock' }).closest('article')!);
    fireEvent.click(inputCard.getByRole('button', { name: 'Source' }));
    picker = within(screen.getByRole('dialog', { name: 'Link Output' }));
    const currentInput = within(picker.getByRole('article', { name: 'Current building' }));
    expect(currentInput.getByText('Receiver (South dock)')).toBeVisible();
    expect(currentInput.getByText('No material configured')).toBeVisible();
    expect(currentInput.getByLabelText('Base')).toHaveTextContent('Target');
    expect(currentInput.queryByLabelText('Plan')).not.toBeInTheDocument();
    fireEvent.change(picker.getByRole('searchbox'), { target: { value: 'Plate exports' } });
    expect(picker.getByRole('article', { name: 'Current building' })).toBeVisible();
    expect(within(picker.getByRole('article', { name: /Dispatcher \(Main supply\)/ })).getByLabelText('Plan')).toHaveTextContent('Plate exports');
    expect(picker.queryByRole('button', { name: /Reserve supply/ })).not.toBeInTheDocument();
});
