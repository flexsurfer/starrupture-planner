import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { afterEach, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { UkladProvider } from '@/app/uklad/bindings';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import { ConfirmationDialog } from '@/features/app-shell/ui/ConfirmationDialog';
import { SaveImportError } from '../import-error';
import { analyzeSave } from '../decoder/analyze';
import { saveGameData, extractionContext, snapshotFixture, transportFixture, saveEntity, heliumItemAsset } from '../decoder/test-fixture';
import { MySavesPage } from './MySavesPage';

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
    await waitFor(() => expect(screen.getByRole('button', { name: 'Import save' })).toBeEnabled());
    return { runtime, persistence };
}

async function importSave(name: string) {
    fireEvent.click(screen.getByRole('button', { name: 'Import save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import save' });
    fireEvent.change(within(dialog).getByLabelText('Choose save file'), { target: { files: [saveFile(name)] } });
    await waitFor(() => expect(screen.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true'));
}

function saveFile(name = 'world') {
    const file = new File(['save data'], `${name}.sav`);
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(9) });
    return file;
}

it('automatically imports, opens and switches save tabs with Planner keyboard conventions; removal requires confirmation', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Import your first save' })).toBeVisible();
    await importSave('First world');
    fireEvent.click(screen.getByRole('button', { name: 'Open Core Workshop' }));
    expect(await screen.findByRole('button', { name: 'Back to save overview' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'First world' })).toBeVisible();
    await importSave('Second world');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Second world' }), { key: 'ArrowLeft' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'First world' })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getByRole('tab', { name: 'First world' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Back to save overview' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByLabelText('Save name'), { target: { value: '  Renamed world  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Renamed world' })).toBeVisible());
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Renamed world' }), { key: 'End' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Second world' })).toHaveAttribute('aria-selected', 'true'));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Second world' }), { key: 'Delete' });
    const confirmation = await screen.findByRole('alertdialog');
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('tab', { name: 'Second world' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Remove save Second world' }));
    fireEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove save' }));
    await waitFor(() => expect(screen.queryByRole('tab', { name: 'Second world' })).toBeNull());
    expect(screen.getByRole('tab', { name: 'Renamed world' })).toHaveAttribute('aria-selected', 'true');
});

it('shows controlled read errors, cancellation, hydration failure and unsaved changes', async () => {
    const { runtime } = await setup(new SaveImportError('compression'));
    fireEvent.click(screen.getByRole('button', { name: 'Import save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import save' });
    fireEvent.change(within(dialog).getByLabelText('Choose save file'), { target: { files: [saveFile()] } });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This file could not be decoded');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel import' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await act(async () => { runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'write']); });
    expect(await screen.findByRole('alert')).toHaveTextContent('Some changes could not be saved');
    expect(screen.queryByRole('button', { name: 'Retry saving' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Import save' })).toBeEnabled();
    await act(async () => { runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'load']); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Your saves could not be loaded'));
    expect(screen.getByRole('button', { name: 'Import save' })).toBeDisabled();
});


it('accepts a dropped file, skips review, shows building visuals and saves the chosen objective', async () => {
    await setup();
    fireEvent.drop(screen.getByRole('region', { name: 'Save import' }), { dataTransfer: { files: [saveFile('Dropped world')] } });
    expect(await screen.findByRole('tab', { name: 'Dropped world' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByLabelText('Save name')).toBeNull();
    expect(screen.queryByText(/Review imported facts|Unrecognized entities|Mapping revision|Candidate buildings/)).toBeNull();
    const card = screen.getByRole('article', { name: 'Workshop' });
    expect(within(card).getByText(/^Lv\.1 · \d+ buildings$/)).toBeVisible();
    expect(within(card).getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/ \/ 1,000$/));
    expect(within(card).getAllByRole('meter', { name: 'Energy Load' }).length).toBeGreaterThan(0);
    expect(within(card).getByRole('region', { name: 'Available resources' })).toHaveTextContent('Titanium Ore');
    expect(within(card).getByRole('region', { name: 'Sent to other Cores' })).toBeVisible();
    expect(within(card).getByAltText('Base Core')).toBeVisible();
    fireEvent.click(within(card).getByText('No objective selected'));
    fireEvent.click(within(card).getByRole('button', { name: 'Intermediate resources' }));
    fireEvent.change(await within(card).findByRole('searchbox', { name: 'Search resources' }), { target: { value: 'Tube' } });
    fireEvent.click(within(card).getByRole('checkbox', { name: 'Tube' }));
    await waitFor(() => expect(within(card).getByRole('checkbox', { name: 'Tube' })).toBeChecked());
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


it('separates supplies and Core shipments, expands buildings, and keeps launchers under the production objective', async () => {
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
    const objective = within(sender).getByRole('region', { name: 'Production objective' });
    expect(objective).toHaveTextContent('Sent to corporations');
    expect(objective).toHaveTextContent('10/min');
    expect(within(sender).getByText('Power network 7')).toBeVisible();
    fireEvent.click(within(receiver).getByRole('button', { name: 'Open Core Core 2' }));
    await screen.findByRole('button', { name: 'Back to save overview' });
    expect(within(screen.getByRole('article', { name: 'Core 2' })).getByText('From Workshop · Ore dispatch · From Workshop · Cargo Dispatcher')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Back to save overview' }));
});

it('updates the current save without adding a tab or losing its name and objective', async () => {
    const save = snapshotFixture();
    await setup(undefined, save);
    await importSave('My world');
    const card = screen.getByRole('article', { name: 'Workshop' });
    fireEvent.click(within(card).getByText('No objective selected'));
    fireEvent.click(within(card).getByRole('button', { name: 'Intermediate resources' }));
    save.itemData.BaseCoreReplicationHelperSaveData.baseCoreSaveData[0].upgradeLevel = 2;
    fireEvent.click(screen.getByRole('button', { name: 'Update save' }));
    const dialog = await screen.findByRole('dialog', { name: 'Update save' });
    fireEvent.change(within(dialog).getByLabelText('Choose save file'), { target: { files: [saveFile('New filename')] } });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getAllByRole('tab')).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'My world' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('article', { name: 'Workshop' })).getByRole('button', { name: 'Intermediate resources' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('article', { name: 'Workshop' })).getByText(/^Lv\.3 · \d+ buildings$/)).toBeVisible();
    expect(within(screen.getByRole('article', { name: 'Workshop' })).getByRole('meter', { name: 'Heat' })).toHaveAttribute('aria-valuetext', expect.stringMatching(/ \/ 4,000$/));
});

it('updates objective choices from the selected catalogs and uses their actual first level', async () => {
    const { runtime } = await setup();
    await importSave('Versioned world');
    await act(async () => {
        runtime.dispatch([appIds.events.APP_SET_DATA_VERSION, 'earlyaccess', {
            buildings: [], items: [{ id: 'selected_item', name: 'Selected item', type: 'resource' }],
            corporations: { 'Selected corporation': { id: 'selected_corp', levels: [{ level: 7, components: [], rewards: [] }] } },
        }]);
    });
    await screen.findAllByAltText('smelter');
    const card = screen.getByRole('article', { name: 'Workshop' });
    fireEvent.click(within(card).getByText('No objective selected'));
    fireEvent.click(within(card).getByRole('button', { name: 'Corporation level' }));
    await waitFor(() => expect(within(card).getByRole('combobox', { name: 'Corporation' })).toHaveValue('selected_corp'));
    expect(within(card).getByRole('combobox', { name: 'Level' })).toHaveValue('7');
    expect(within(card).getByText('Selected corporation Lv.7')).toBeVisible();
    fireEvent.click(within(card).getByRole('button', { name: 'Intermediate resources' }));
    expect(await within(card).findByRole('checkbox', { name: 'Selected item' })).toBeVisible();
    expect(within(card).queryByRole('checkbox', { name: 'Tube' })).toBeNull();
});
