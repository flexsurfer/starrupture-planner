import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { UkladProvider } from '@/app/uklad/bindings';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import { ConfirmationDialog } from '@/features/app-shell/ui/ConfirmationDialog';
import { SaveImportError } from '../import-error';
import { analyzeSave } from '../decoder/analyze';
import { saveGameData, extractionContext, snapshotFixture, transportFixture, saveFixture, saveEntity, heliumItemAsset } from '../decoder/test-fixture';
import { MySavesPage } from './MySavesPage';

// Map rendering has its own suite; this suite exercises the save view navigation.
vi.mock('./SaveMap', () => ({ SaveMap: () => <div /> }));

const owners: { runtime: ReturnType<typeof createAppRuntime>; persistence: ReturnType<typeof persist> }[] = [];
afterEach(async () => {
    cleanup();
    for (const owner of owners.splice(0)) { await owner.persistence.dispose(); owner.runtime.dispose(); }
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

async function setup(error?: SaveImportError, save: unknown = snapshotFixture()) {
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const runtime = createAppRuntime();
    registerHeadlessApplication(runtime, { effects: { decodeSaveFile: async () => {
        if (error) throw error;
        return analyzeSave(save, extractionContext);
    } } });
    const persistence = persist(runtime, { storage: memoryStorageAdapter(), keys: PERSIST_KEYS, prefix: 'saves-ui-test' });
    persistence.hydrate();
    runtime.dispatch([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
    owners.push({ runtime, persistence });
    render(<UkladProvider runtime={runtime}><MySavesPage /><ConfirmationDialog /></UkladProvider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Choose save file' })).toBeEnabled());
    return { runtime, persistence };
}

async function importSave(name: string) {
    fireEvent.change(screen.getByLabelText('Choose save file'), { target: { files: [saveFile(name)] } });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Update' })).toBeVisible());
}

function saveFile(name = 'world') {
    const file = new File(['save data'], `${name}.sav`);
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(9) });
    return file;
}

it('imports from the centered empty state and removes the save only after confirmation', async () => {
    const { runtime } = await setup();
    expect(screen.getByRole('heading', { name: 'Import your first save' })).toBeVisible();
    expect(screen.getByText('Experimental functionality')).toBeVisible();
    expect(screen.getByText(/Only tested with Update 2 QoL game data and .sav files from StarRupture 0.3.5/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Import save' })).toBeNull();
    await importSave('First world');
    expect(screen.queryByRole('heading', { name: 'My Saves' })).toBeNull();
    expect(screen.queryByRole('tab', { name: 'First world' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    expect(screen.getByText('Last updated: 2026-04-03 13:00')).toBeVisible();
    expect(screen.queryByText(/Nominal capacity from configured recipes/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open Core Workshop' }));
    expect(await screen.findByRole('button', { name: 'Back to save overview' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Update' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove save' }));
    expect(await screen.findByRole('heading', { name: 'Import your first save' })).toBeVisible();
    expect(createUkladTestHarness(runtime).getSubscriptionValue([appIds.subscriptions.SAVES_TABS])).toEqual([]);
    await importSave('Another world');
    expect(createUkladTestHarness(runtime).getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])?.name).toBe('Another world');
});

it('shows controlled read errors, cancellation, hydration failure and unsaved changes', async () => {
    const { runtime } = await setup(new SaveImportError('compression'));
    fireEvent.change(screen.getByLabelText('Choose save file'), { target: { files: [saveFile()] } });
    const dialog = await screen.findByRole('dialog', { name: 'Import save' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This file could not be decoded');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel import' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => { runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'write']); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Some changes could not be saved');
    expect(screen.queryByRole('button', { name: 'Retry saving' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose save file' })).toBeEnabled();
    await act(async () => { runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'load']); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your saves could not be loaded'));
    expect(screen.getByRole('button', { name: 'Choose save file' })).toBeDisabled();
});


it('accepts a dropped file and shows building visuals without production objectives', async () => {
    await setup();
    fireEvent.drop(screen.getByRole('region', { name: 'Save import' }), { dataTransfer: { files: [saveFile('Dropped world')] } });
    expect(await screen.findByRole('button', { name: 'Update' })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByLabelText('Save name')).toBeNull();
    expect(screen.queryByText(/Review imported facts|Unrecognized entities|Mapping revision|Candidate buildings/)).toBeNull();
    const card = screen.getByRole('article', { name: 'Workshop' });
    expect(within(card).getByText(/^Lv\.1 · \d+ buildings$/)).toBeVisible();
    expect(within(card).getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/ \/ 1,000$/));
    expect(within(card).queryByRole('region', { name: 'Energy' })).toBeNull();
    expect(within(card).getAllByText('Local extraction').length).toBeGreaterThan(0);
    expect(within(card).queryByRole('heading', { name: 'Local extraction' })).toBeNull();
    expect(within(card).getByText('Heat')).toBeVisible();
    expect(within(card).queryByText('Imported from other Cores')).toBeNull();
    expect(within(card).getByText('View details')).toBeVisible();
    expect(within(card).queryByAltText('Fabricator')).toBeNull();
    expect(within(card).getByRole('region', { name: 'Available resources' })).toHaveTextContent('Titanium Ore');
    expect(within(card).getByRole('region', { name: 'Sent to other Cores' })).toBeVisible();
    expect(within(card).getByAltText('Base Core')).toBeVisible();
    expect(within(card).queryByRole('region', { name: 'Production objective' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Open Core Workshop' }));
    expect(await screen.findByRole('button', { name: 'Production' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Energy' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Infrastructure' })).toBeVisible();
    expect(screen.getAllByAltText('Fabricator').length).toBeGreaterThan(0);
    expect(screen.queryByText('Inputs')).toBeNull();
    expect(screen.queryByText('Outputs')).toBeNull();
});

it('requires one dropped save and leaves cancellation as a no-op', async () => {
    await setup();
    fireEvent.drop(screen.getByRole('region', { name: 'Save import' }), { dataTransfer: { files: [saveFile('one'), saveFile('two')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Choose one save file at a time.');
    expect(screen.queryByRole('tab')).toBeNull();
});


it('separates supplies and Core shipments, expands buildings, omits corporation shipments and empty outgoing sections from cards', async () => {
    const save = transportFixture();
    Object.assign(save.itemData.CrBuildingCustomNameSubsystem.customNames, { '(ID=20)': 'Ore dispatch', '(ID=30)': 'Ore intake' });
    Object.assign(save.itemData.Mass.entities, { '(ID=50)': saveEntity('Exporter/DA_Exporter.DA_Exporter', 0, [
        `/Script/Chimera.CrInventoryFragment(InputInventoryContainer=(Items=((ItemTypeFilter=(${JSON.stringify(heliumItemAsset)})))))`,
    ]) });
    await setup(undefined, save);
    await importSave('Logistics');
    const sender = screen.getByRole('article', { name: 'Workshop' });
    const receiver = screen.getByRole('article', { name: 'Core 2' });
    const incoming = within(receiver).getByRole('region', { name: 'Available resources' });
    expect(incoming).toHaveTextContent('From Workshop · Ore dispatch');
    expect(incoming).toHaveTextContent('From Workshop · Cargo Dispatcher');
    expect(incoming).toHaveTextContent('480/min');
    const summary = within(incoming).getByText('Helium-3').closest('summary')!;
    expect(summary.parentElement).not.toHaveAttribute('open');
    fireEvent.click(summary);
    expect(summary.parentElement).toHaveAttribute('open');
    const breakdown = within(summary.parentElement!).getByRole('list', { name: 'Buildings' });
    expect(breakdown).toHaveTextContent('Ore intake');
    expect(breakdown).toHaveTextContent('From Workshop · Ore dispatch');
    expect(breakdown).toHaveTextContent('From Workshop · Cargo Dispatcher');
    const outgoing = within(sender).getByRole('region', { name: 'Sent to other Cores' });
    expect(outgoing).toHaveTextContent('To Core 2 · Ore intake');
    fireEvent.click(within(outgoing).getByText('Helium-3').closest('summary')!);
    expect(within(outgoing).getByRole('list', { name: 'Buildings' })).toHaveTextContent('To Core 2 · Ore intake');
    expect(outgoing).not.toHaveTextContent('Sent to corporations');
    expect(within(sender).queryByRole('region', { name: 'Sent to corporations' })).toBeNull();
    expect(within(receiver).queryByRole('region', { name: 'Sent to other Cores' })).toBeNull();
    expect(within(receiver).queryByText('No shipments to other Cores')).toBeNull();
    expect(within(sender).queryByRole('region', { name: 'Production objective' })).toBeNull();
    expect(within(sender).queryByText('Power network 7')).toBeNull();
    fireEvent.click(within(receiver).getByRole('button', { name: 'Open Core Core 2' }));
    await screen.findByRole('button', { name: 'Back to save overview' });
    expect(within(screen.getByRole('article', { name: 'Core 2' })).getByText('From Workshop · Ore dispatch · From Workshop · Cargo Dispatcher')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to save overview' }));
});

it('updates the existing workspace without adding another or changing its identity', async () => {
    const save = snapshotFixture();
    const { runtime } = await setup(undefined, save);
    await importSave('My world');
    const before = createUkladTestHarness(runtime).getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])!;
    save.itemData.BaseCoreReplicationHelperSaveData.baseCoreSaveData[0].upgradeLevel = 2;
    save.timestamp = '20260404153000';
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    const dialog = await screen.findByRole('dialog', { name: 'Update save' });
    fireEvent.change(within(dialog).getByLabelText('Choose save file'), { target: { files: [saveFile('New filename')] } });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(createUkladTestHarness(runtime).getSubscriptionValue([appIds.subscriptions.SAVES_TABS])).toHaveLength(1);
    expect(createUkladTestHarness(runtime).getSubscriptionValue([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE])).toMatchObject({ id: before.id, name: 'My world' });
    expect(screen.getByText('Last updated: 2026-04-04 15:30')).toBeVisible();
    expect(within(screen.getByRole('article', { name: 'Workshop' })).getByText(/^Lv\.3 · \d+ buildings$/)).toBeVisible();
    expect(within(screen.getByRole('article', { name: 'Workshop' })).getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/ \/ 4,000$/));
});

it('lists all power networks with per-Core building counts and opens Core details', async () => {
    const save = saveFixture();
    await setup(undefined, save);
    await importSave('Power world');
    fireEvent.click(screen.getByRole('tab', { name: 'Power networks' }));
    const panel = screen.getByRole('tabpanel', { name: 'Power networks' });
    expect(within(panel).getAllByRole('article')).toHaveLength(3);
    const shared = within(panel).getByRole('article', { name: 'Power network 9' });
    expect(within(shared).getByText('2 Cores · 2 buildings')).toBeVisible();
    expect(within(shared).getByRole('row', { name: 'Workshop 1' })).toBeVisible();
    expect(within(shared).getByRole('row', { name: 'Core 2 1' })).toBeVisible();
    expect(within(panel).getByRole('article', { name: 'Power network 7' })).toHaveTextContent('1 Core · 0 buildings');
    expect(within(panel).getByRole('article', { name: 'Power network 8' })).toHaveTextContent('1 Core · 0 buildings');
    fireEvent.click(within(shared).getByRole('button', { name: 'Open Core Core 2' }));
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getByRole('article', { name: 'Core 2' })).toBeVisible());
    expect(screen.getByRole('button', { name: 'Back to save overview' })).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Power networks' }));
    expect(within(screen.getByRole('tabpanel', { name: 'Power networks' })).getAllByRole('article')).toHaveLength(3);
    // Re-importing updates the derived counts while this tab is selected.
    save.itemData.Mass.electricitySubsystemState.nodeData['(UId=(ID=10))'].subGraph.subGraphId = 8;
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));
    const dialog = await screen.findByRole('dialog', { name: 'Update save' });
    fireEvent.change(within(dialog).getByLabelText('Choose save file'), { target: { files: [saveFile()] } });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const updated = screen.getByRole('article', { name: 'Power network 9' });
    expect(within(updated).getByText('1 Core · 1 building')).toBeVisible();
    expect(within(updated).queryByRole('button', { name: 'Open Core Workshop' })).toBeNull();
    expect(within(screen.getByRole('article', { name: 'Power network 8' })).getByRole('row', { name: 'Workshop 1' })).toBeVisible();
});

it('supports three-tab keyboard navigation and shows an empty power networks state', async () => {
    const save = saveFixture();
    save.itemData.Mass.electricitySubsystemState.nodeData = {} as typeof save.itemData.Mass.electricitySubsystemState.nodeData;
    await setup(undefined, save);
    await importSave('No networks');
    const overview = screen.getByRole('tab', { name: 'Overview' });
    const map = screen.getByRole('tab', { name: 'Map' });
    const networks = screen.getByRole('tab', { name: 'Power networks' });
    fireEvent.keyDown(overview, { key: 'End' });
    expect(networks).toHaveFocus();
    expect(networks).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('No power networks found in this save.')).toBeVisible();
    fireEvent.keyDown(networks, { key: 'ArrowRight' });
    expect(overview).toHaveFocus();
    fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(networks).toHaveFocus();
    fireEvent.keyDown(networks, { key: 'Home' });
    expect(overview).toHaveFocus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(map).toHaveFocus();
    fireEvent.keyDown(map, { key: 'ArrowRight' });
    expect(networks).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Power networks' })).toHaveTextContent('No power networks found in this save.');
});
