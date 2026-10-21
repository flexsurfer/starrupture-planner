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

async function interact(action: () => void) {
    await act(async () => {
        action();
        for (const { runtime } of owners) await createUkladTestHarness(runtime).flush();
    });
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

it('opens the map after importing and removes the save only after confirmation', async () => {
    const { runtime } = await setup();
    expect(screen.getByRole('heading', { name: 'Import your first save' })).toBeVisible();
    expect(screen.getByText('Experimental functionality')).toBeVisible();
    expect(screen.getByText(/Only tested with Update 2 QoL game data and .sav files from StarRupture 0.3.5/)).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Import save' })).toBeNull();
    await importSave('First world');
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Map' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('tab', { name: 'First world' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename' })).toBeNull();
    expect(screen.getByText('Last updated: 2026-04-03 13:00')).toBeVisible();
    expect(screen.queryByText(/Nominal capacity from configured recipes/)).toBeNull();
    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Overview' })); });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Open Core Workshop' })); });
    const coreDialog = await screen.findByRole('dialog', { name: 'Workshop' });
    expect(coreDialog).toBeVisible();
    await interact(() => { fireEvent.click(within(coreDialog).getByRole('button', { name: 'Close' })); });
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Update' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove save' }));
    expect(await screen.findByRole('heading', { name: 'Import your first save' })).toBeVisible();
    expect(createUkladTestHarness(runtime).getSubscriptionValue([appIds.subscriptions.SAVES_TABS])).toEqual([]);
    await importSave('Another world');
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
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

it.each([
    ['file-size', 'Choose a .sav file no larger than 64 MiB.'],
    ['decoded-size', 'This save expands beyond the 512 MiB import limit when unpacked.'],
    ['complexity', 'This save contains too many objects or entries that are too large to import.'],
] as const)('explains the %s limit separately', async (code, message) => {
    await setup(new SaveImportError(code));
    fireEvent.change(screen.getByLabelText('Choose save file'), { target: { files: [saveFile()] } });
    const dialog = await screen.findByRole('dialog', { name: 'Import save' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message);
    expect(within(dialog).getByText(/Limits: 64 MiB per file and 512 MiB after unpacking/)).toBeVisible();
});

it('retains the selected view across page remounts only for the current runtime session', async () => {
    const { runtime } = await setup();
    await importSave('Session world');
    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Power networks' })); });
    const harness = createUkladTestHarness(runtime);
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_SELECTED_VIEW])).toBe('power-networks'));
    cleanup();
    render(<UkladProvider runtime={runtime}><MySavesPage /></UkladProvider>);
    expect(screen.getByRole('tab', { name: 'Power networks' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Power networks' })).toBeVisible();
    expect(PERSIST_KEYS.map(entry => typeof entry === 'string' ? entry : entry.key)).not.toContain('savesSelectedView');

    const nextSession = createAppRuntime();
    try {
        expect(createUkladTestHarness(nextSession).getState().savesSelectedView).toBe('map');
    } finally { nextSession.dispose(); }
});


it('accepts a dropped file and shows building visuals without production objectives', async () => {
    await setup();
    fireEvent.drop(screen.getByRole('region', { name: 'Save import' }), { dataTransfer: { files: [saveFile('Dropped world')] } });
    expect(await screen.findByRole('button', { name: 'Update' })).toBeVisible();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByLabelText('Save name')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Map' })).toHaveAttribute('aria-selected', 'true');
    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Overview' })); });
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
    within(card).getByRole('button', { name: 'Open Core Workshop' }).focus();
    await interact(() => { fireEvent.click(within(card).getByRole('button', { name: 'Open Core Workshop' })); });
    const dialog = await screen.findByRole('dialog', { name: 'Workshop' });
    expect(within(dialog).getByRole('heading', { name: 'Production' })).toBeVisible();
    expect(within(dialog).queryByRole('heading', { name: 'Energy' })).toBeNull();
    expect(within(dialog).queryByRole('heading', { name: 'Infrastructure' })).toBeNull();
    expect(within(dialog).queryByRole('meter')).toBeNull();
    const supplies = within(dialog).getByRole('region', { name: 'Incoming resources' });
    for (const purity of ['Impure', 'Normal', 'Pure']) {
        const extractor = within(supplies).getByText(`Node purity: ${purity}`).closest('article')!;
        expect(within(extractor).getByTitle('Max capacity')).toHaveTextContent('/min');
        expect(within(extractor).getByTitle('Max capacity')).toHaveStyle({ color: '#3b82f6' });
    }
    const production = within(dialog).getByRole('region', { name: 'Production' });
    const fabricators = within(production).getByRole('heading', { name: 'Fabricator v.2' }).closest('article')!;
    expect(fabricators).toHaveTextContent('5 buildings');
    expect(within(production).queryByText('Tube')).toBeNull();
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map(heading => heading.textContent))
        .toEqual(['Incoming resources', 'Outgoing resources', 'Production']);
    await interact(() => { fireEvent.keyDown(within(dialog).getByRole('button', { name: 'Close' }), { key: 'Escape' }); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(card).getByRole('button', { name: 'Open Core Workshop' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Back to save overview' })).toBeNull();
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
    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Overview' })); });
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
    await interact(() => { fireEvent.click(within(receiver).getByRole('button', { name: 'Open Core Core 2' })); });
    const dialog = await screen.findByRole('dialog', { name: 'Core 2' });
    const resourceSection = within(dialog).getByRole('region', { name: 'Incoming resources' });
    expect(within(resourceSection).getAllByRole('article')).toHaveLength(2);
    expect(within(resourceSection).getAllByText('Helium-3')).toHaveLength(2);
    await interact(() => { fireEvent.click(within(dialog).getByRole('button', { name: 'Close' })); });
    expect(screen.queryByRole('dialog')).toBeNull();
});

it('groups launchers by item with combined colored rates while keeping cargo buildings separate', async () => {
    const save = transportFixture();
    const calcite = "/Game/Chimera/Items/I_CalciteSheets.I_CalciteSheets_C'/Game/Chimera/Items/I_CalciteSheets.Default__I_CalciteSheets_C'";
    for (const [index, item] of [heliumItemAsset, heliumItemAsset, calcite, null].entries()) {
        Object.assign(save.itemData.Mass.entities, { [`(ID=${50 + index})`]: saveEntity('Exporter/DA_Exporter.DA_Exporter', 0,
            item ? [`/Script/Chimera.CrInventoryFragment(InputInventoryContainer=(Items=((ItemTypeFilter=(${JSON.stringify(item)})))))`] : []) });
    }
    await setup(undefined, save);
    await importSave('Launchers');
    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Overview' })); });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Open Core Workshop' })); });
    const outgoing = within(screen.getByRole('dialog', { name: 'Workshop' })).getByRole('region', { name: 'Outgoing resources' });
    const launcherCards = within(outgoing).getAllByRole('heading', { name: 'Orbital Cargo Launcher' }).map(heading => heading.closest('article')!);
    expect(launcherCards).toHaveLength(3);
    const helium = launcherCards.find(card => card.textContent?.includes('Helium-3'))!;
    expect(helium).toHaveTextContent('2 launchers');
    expect(within(helium).getByTitle('Max capacity')).toHaveTextContent('20/min');
    expect(within(helium).getByTitle('Max capacity')).toHaveStyle({ color: '#3b82f6' });
    const otherItem = launcherCards.find(card => card.textContent?.includes('Calcite Sheets'))!;
    expect(otherItem).toHaveTextContent('1 launcher');
    expect(otherItem).toHaveTextContent('10/min');
    expect(launcherCards.find(card => card.textContent?.includes('Item unavailable'))).toBeDefined();
    expect(within(outgoing).getAllByRole('heading', { name: 'Cargo Dispatcher' })).toHaveLength(3);
});

it('updates the existing workspace without adding another or changing its identity', async () => {
    const save = snapshotFixture();
    const { runtime } = await setup(undefined, save);
    await importSave('My world');
    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Overview' })); });
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
    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Power networks' })); });
    const panel = screen.getByRole('tabpanel', { name: 'Power networks' });
    expect(within(panel).getAllByRole('article')).toHaveLength(3);
    const shared = within(panel).getByRole('article', { name: 'Power network 9' });
    expect(within(shared).getByText('2 Cores · 2 buildings')).toBeVisible();
    expect(within(shared).getByRole('row', { name: 'Workshop 1' })).toBeVisible();
    expect(within(shared).getByRole('row', { name: 'Core 2 1' })).toBeVisible();
    expect(within(panel).getByRole('article', { name: 'Power network 7' })).toHaveTextContent('1 Core · 0 buildings');
    expect(within(panel).getByRole('article', { name: 'Power network 8' })).toHaveTextContent('1 Core · 0 buildings');
    await interact(() => { fireEvent.click(within(shared).getByRole('button', { name: 'Open Core Core 2' })); });
    expect(screen.getByRole('tab', { name: 'Power networks' })).toHaveAttribute('aria-selected', 'true');
    const coreDialog = await screen.findByRole('dialog', { name: 'Core 2' });
    expect(coreDialog).toBeVisible();
    await interact(() => { fireEvent.click(within(coreDialog).getByRole('button', { name: 'Close' })); });

    await interact(() => { fireEvent.click(screen.getByRole('tab', { name: 'Power networks' })); });
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
    await interact(() => { fireEvent.keyDown(map, { key: 'End' }); });
    expect(networks).toHaveFocus();
    expect(networks).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('No power networks found in this save.')).toBeVisible();
    await interact(() => { fireEvent.keyDown(networks, { key: 'ArrowRight' }); });
    expect(map).toHaveFocus();
    await interact(() => { fireEvent.keyDown(map, { key: 'ArrowLeft' }); });
    expect(networks).toHaveFocus();
    await interact(() => { fireEvent.keyDown(networks, { key: 'Home' }); });
    expect(map).toHaveFocus();
    await interact(() => { fireEvent.keyDown(map, { key: 'ArrowRight' }); });
    expect(overview).toHaveFocus();
    await interact(() => { fireEvent.keyDown(overview, { key: 'ArrowRight' }); });
    expect(networks).toHaveFocus();
    expect(screen.getByRole('tabpanel', { name: 'Power networks' })).toHaveTextContent('No power networks found in this save.');
});
