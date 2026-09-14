import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import type { AppState } from '@/app/uklad/model';
import MyBasesPage from './MyBasesPage';

vi.mock('@/features/production-plans/ui/components/EmbeddedFlowDiagram', () => ({ EmbeddedFlowDiagram: () => <div>Production diagram</div> }));

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

function setup(overrides: Partial<AppState> = {}) {
  const runtime = createAppRuntime();
  runtimes.push(runtime);
  runtime.registerModule(registerApplicationModules);
  const harness = createUkladTestHarness(runtime);
  const items = [{ id: 'ore', name: 'Ore', type: 'raw' }, { id: 'bar', name: 'Bar', type: 'processed' }];
  harness.restoreState({
    ...harness.getState(),
    itemsList: items,
    itemsById: Object.fromEntries(items.map(item => [item.id, item])),
    buildingsList: [{ id: 'smelter', name: 'Smelter', type: 'production', recipes: [{ output: { id: 'bar', amount_per_minute: 30 }, inputs: [{ id: 'ore', amount_per_minute: 60 }] }] }],
    basesList: [{ id: 'base', name: 'Outpost', coreLevel: 0, buildings: [], productions: [{ id: 'plan', name: 'Bar plan', selectedItemId: 'bar', targetAmount: 30, active: false, requiredBuildings: [{ buildingId: 'smelter', count: 1 }] }] }],
    ...overrides,
  });
  const view = render(<UkladProvider runtime={runtime}><MyBasesPage /></UkladProvider>);
  return { harness, ...view };
}

it('asks for a mode on first opening, including for existing bases, then allows changing it', async () => {
  const { harness } = setup();
  const before = harness.getState().basesList;
  const picker = screen.getByRole('dialog', { name: 'How would you like to use My Bases?' });
  fireEvent.click(within(picker).getByRole('button', { name: /Planning mode/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('tab', { name: 'Logistics' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Energy Grids/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Input' })).not.toBeInTheDocument();
  expect(screen.queryByText('Inactive')).not.toBeInTheDocument();
  expect(screen.getByText('Bar plan')).toBeVisible();

  fireEvent.click(screen.getByRole('switch', { name: 'Advanced' }));
  await waitFor(() => expect(screen.getByRole('tab', { name: 'Logistics' })).toBeVisible());
  expect(screen.getByRole('button', { name: /Energy Grids/ })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add Input' })).toBeVisible();
  expect(harness.getState().basesList).toEqual(before);
});

it('keeps building and resource requirements visible and safely switches away from a hidden tab', async () => {
  const { harness } = setup({ basesMode: 'advanced', basesSelectedBaseId: 'base', basesSelectedDetailTab: 'buildings' });
  const before = harness.getState();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: 'Advanced' }));
  await waitFor(() => expect(screen.queryByRole('tab', { name: /^Buildings/ })).not.toBeInTheDocument());
  expect(screen.getByRole('tab', { name: 'Production' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('×1')).toBeVisible();
  expect(within(screen.getByRole('article', { name: 'Ore input' })).getByText('60/min')).toBeVisible();
  expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /owned count|Manage inputs|Manage buildings/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Core Level:')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Rename' })).toBeVisible();
  expect(harness.getState()).toEqual({ ...before, basesMode: 'planning' });

  fireEvent.click(screen.getByRole('tab', { name: /^Plans/ }));
  expect(await screen.findByText('Production diagram')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Activate' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Requirements need attention/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add Plan' }));
  await waitFor(() => expect(harness.getState().productionPlanModalState.isOpen).toBe(true));
  expect(screen.queryByText('Match inputs')).not.toBeInTheDocument();
  expect(screen.queryByText('Missing Materials')).not.toBeInTheDocument();
});

it('prompts when entering directly into a base without a saved mode and remembers the choice on remount', async () => {
  const { harness, unmount } = setup({ basesSelectedBaseId: 'base' });
  fireEvent.click(screen.getByRole('button', { name: /Advanced mode/ }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  const saved = harness.getState();
  unmount();
  setup(saved);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /^Buildings/ })).toBeVisible();
});

it('offers the first-time picker with no bases, then switches directly without reopening settings', async () => {
  const { harness } = setup({ basesList: [] });
  fireEvent.click(screen.getByRole('button', { name: /Planning mode/ }));
  await waitFor(() => expect(harness.getState().basesMode).toBe('planning'));
  expect(screen.getByRole('switch', { name: 'Advanced' })).not.toBeChecked();
  expect(screen.queryByRole('button', { name: 'My Bases settings' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: 'Advanced' }));
  await waitFor(() => expect(harness.getState().basesMode).toBe('advanced'));
  expect(screen.getByRole('switch', { name: 'Advanced' })).toBeChecked();
  fireEvent.click(screen.getByRole('switch', { name: 'Advanced' }));
  await waitFor(() => expect(harness.getState().basesMode).toBe('planning'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(harness.getState().basesMode).toBe('planning');
  await act(async () => { await harness.flush(); });
});
