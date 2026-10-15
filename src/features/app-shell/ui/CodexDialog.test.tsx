import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { UkladProvider } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { TEST_GAME_DATA } from '@/platform/headless/e2e-support';
import TabLayout from './TabLayout';
import NavigationProvider from './navigation/NavigationProvider';

// An uncontrolled draft exposes accidental page remounts independently of Uklad state.
vi.mock('@/features/planner/ui', () => ({ PlannerPage: () => <input aria-label="Workspace draft" defaultValue="" /> }));
vi.mock('@ukladjs/devtools', () => ({ enableDevtools: vi.fn() }));
const runtimes: ReturnType<typeof createAppRuntime>[] = [];

beforeEach(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
        this.querySelector<HTMLElement>('[autofocus]')?.focus();
    };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
});

afterEach(() => {
    cleanup();
    runtimes.splice(0).forEach(runtime => runtime.dispose());
    vi.unstubAllGlobals();
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});

function Shell() {
    const location = useLocation();
    const navigate = useNavigate();
    return <NavigationProvider navigate={navigate}>
        <output data-testid="location">{location.pathname}{location.search}{location.hash}</output>
        <TabLayout />
    </NavigationProvider>;
}

async function setup(path = '/planner/?view=keep#workspace') {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', structuredClone(TEST_GAME_DATA)]);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'existing', 'Existing plan', 'single']);
    harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'iron-plate']);
    harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 125]);
    await act(async () => {
        render(<UkladProvider runtime={runtime}><MemoryRouter initialEntries={[path]}><Shell /></MemoryRouter></UkladProvider>);
    });
    return harness;
}

function openCodex(section: string) {
    const trigger = screen.getAllByRole('button', { name: 'Codex' }).find(button => button.closest('[aria-hidden="true"]') === null)!;
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: section }));
    return { dialog: screen.getByRole('dialog', { name: 'Codex' }), trigger };
}

it('keeps the URL, mounted workspace and existing plan while browsing every Codex section', async () => {
    const harness = await setup();
    await waitFor(() => expect(screen.getByLabelText('Workspace draft')).toBeInTheDocument());
    const draft = screen.getByLabelText('Workspace draft');
    fireEvent.change(draft, { target: { value: 'Unfinished input' } });
    const plans = harness.getState().plannerTabs;
    const { dialog, trigger } = openCodex('Items');
    expect(dialog).toHaveAttribute('open');
    expect(within(dialog).getByRole('link', { name: 'Open Items in a new tab' })).toHaveAttribute('href', '/items/');
    expect(within(dialog).queryByRole('button', { name: 'Planner' })).toBeNull();
    fireEvent.change(within(dialog).getByPlaceholderText('Search items...'), { target: { value: 'Iron Plate' } });
    await waitFor(() => expect(harness.getState().itemsCodexSearchTerm).toBe('Iron Plate'));
    const recipeButton = within(dialog).getAllByRole('button', { name: 'Recipe' })[0];
    recipeButton.focus();
    fireEvent.click(recipeButton);
    const recipe = screen.getByRole('dialog', { name: 'Recipes for Iron Plate' });
    expect(within(recipe).queryByRole('button', { name: 'Planner' })).toBeNull();
    fireEvent(recipe, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Recipes for Iron Plate' })).toBeNull();
    expect(dialog).toHaveAttribute('open');
    expect(recipeButton).toHaveFocus();

    fireEvent.click(within(dialog).getByRole('tab', { name: 'Buildings & Recipes' }));
    const building = within(dialog).getAllByRole('button', { expanded: false })[0];
    fireEvent.click(building);
    expect(building).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).queryByRole('button', { name: 'Planner' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Corporations' }));
    fireEvent.click(within(dialog).getAllByRole('button', { expanded: false })[0]);
    expect(within(dialog).queryByRole('button', { name: /in planner/ })).toBeNull();
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Buildings & Recipes' }));
    expect(building).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Items' }));
    expect(within(dialog).getByPlaceholderText('Search items...')).toHaveValue('Iron Plate');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close Codex' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
    expect(screen.getByLabelText('Workspace draft')).toBe(draft);
    expect(draft).toHaveValue('Unfinished input');
    expect(harness.getState().plannerTabs).toBe(plans);
    expect(harness.getState().uiActiveTab).toBe('planner');
    expect(screen.getByTestId('location')).toHaveTextContent('/planner/?view=keep#workspace');
});

it('isolates all item filters from an Items page underneath and leaves full-page planning available', async () => {
    const harness = await setup('/items/');
    await act(async () => {
        harness.dispatchSync([appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'raw']);
        harness.dispatchSync([appIds.events.ITEMS_SET_SEARCH_TERM, 'Copper']);
    });
    const backgroundSearch = screen.getByPlaceholderText('Search items...');
    const { dialog } = openCodex('Items');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Processed' }));
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'Smelter' } });
    fireEvent.change(within(dialog).getByPlaceholderText('Search items...'), { target: { value: 'Iron' } });
    await waitFor(() => expect(harness.getState().itemsCodexSearchTerm).toBe('Iron'));
    expect(harness.getState()).toMatchObject({
        itemsSelectedCategory: 'raw', itemsSelectedBuilding: 'all', itemsSearchTerm: 'Copper',
        itemsCodexSelectedCategory: 'processed', itemsCodexSelectedBuilding: 'Smelter', itemsCodexSearchTerm: 'Iron',
    });
    expect(harness.getSubscriptionValue([appIds.subscriptions.ITEMS_CODEX_TABLE_ROWS]).map(row => row.item.name)).toEqual(['Iron Plate']);
    fireEvent.click(dialog);
    expect(backgroundSearch).toBe(screen.getByPlaceholderText('Search items...'));
    expect(backgroundSearch).toHaveValue('Copper');
    expect(screen.getByTestId('location')).toHaveTextContent('/items/');
    await act(async () => {
        harness.dispatchSync([appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'all']);
        harness.dispatchSync([appIds.events.ITEMS_SET_SEARCH_TERM, '']);
    });
    expect(screen.getAllByRole('button', { name: 'Planner' }).length).toBeGreaterThan(0);
});

it('offers the existing URLs in new tabs and dismisses the menu and dialog with Escape', async () => {
    await setup();
    const trigger = screen.getAllByRole('button', { name: 'Codex' })[0];
    fireEvent.click(trigger);
    for (const [label, path] of [['Items', '/items/'], ['Buildings & Recipes', '/recipes/'], ['Corporations', '/corporations/']]) {
        const link = screen.getByRole('link', { name: `Open ${label} in a new tab` });
        expect(link).toHaveAttribute('href', path);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
    const { dialog } = openCodex('Corporations');
    fireEvent.keyDown(within(dialog).getByRole('tab', { name: 'Corporations' }), { key: 'Home' });
    expect(within(dialog).getByRole('tab', { name: 'Items' })).toHaveFocus();
    fireEvent(dialog, new Event('cancel', { bubbles: false, cancelable: true }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
});
