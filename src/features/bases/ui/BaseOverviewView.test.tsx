import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { Base, Building, Item } from '@/app/uklad/model';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { BaseOverviewView } from './BaseOverviewView';
import { BaseDetailView } from './BaseDetailView';
import { ORBITAL_CARGO_LAUNCHER_BUILDING_ID } from '@/constants/buildingIds';

const items: Item[] = [
  { id: 'ore', name: 'Wolfram Ore', type: 'raw' },
  { id: 'bar', name: 'Wolfram Bar', type: 'processed' },
  { id: 'wire', name: 'Wolfram Wire', type: 'component' },
  { id: 'water', name: 'Water', type: 'raw' },
  { id: 'plate', name: 'Wolfram Plate', type: 'processed' },
];
const buildings: Building[] = [
  { id: 'smelter', name: 'Smelter', type: 'production', recipes: [{ output: { id: 'bar', amount_per_minute: 30 }, inputs: [{ id: 'ore', amount_per_minute: 60 }] }] },
  { id: 'assembler', name: 'Assembler', type: 'production', recipes: [{ output: { id: 'wire', amount_per_minute: 15 }, inputs: [{ id: 'bar', amount_per_minute: 60 }] }] },
  { id: 'package_receiver', name: 'Cargo Receiver', type: 'logistics' },
  { id: 'package_dispatcher', name: 'Cargo Dispatcher', type: 'logistics' },
];
const base: Base = {
  id: 'base', name: 'Outpost',
  productions: [
    { id: 'wire-plan', name: 'Wire for Future Health Solutions', selectedItemId: 'wire', targetAmount: 15, active: true, requiredBuildings: [{ buildingId: 'smelter', count: 2 }, { buildingId: 'assembler', count: 1 }] },
    { id: 'bar-plan', name: 'Bar reserves', selectedItemId: 'bar', targetAmount: 30, active: false, requiredBuildings: [{ buildingId: 'smelter', count: 1 }] },
  ],
  buildings: [
    { id: 'ore-input', buildingTypeId: 'package_receiver', sectionType: 'inputs', selectedItemId: 'ore', ratePerMinute: 150 },
    { id: 'water-input', buildingTypeId: 'package_receiver', sectionType: 'inputs', selectedItemId: 'water', ratePerMinute: 10 },
    ...Array.from({ length: 3 }, (_, index) => ({ id: `smelter-${index}`, buildingTypeId: 'smelter', sectionType: 'production' })),
    ...Array.from({ length: 4 }, (_, index) => ({ id: `output-${index}`, name: `Wire dispatch ${index + 1}`, buildingTypeId: 'package_dispatcher', sectionType: 'outputs', sourceProductionId: 'wire-plan', capacityPerMinute: 5 })),
  ],
};

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => { cleanup(); runtimes.splice(0).forEach(runtime => runtime.dispose()); });

function setup(selectedBase: Base = base, buildingData: Building[] = buildings, fullDetail = false) {
  const runtime = createAppRuntime();
  runtimes.push(runtime);
  runtime.registerModule(registerApplicationModules);
  const harness = createUkladTestHarness(runtime);
  harness.restoreState({ ...harness.getState(), itemsList: items, itemsById: Object.fromEntries(items.map(item => [item.id, item])), buildingsList: buildingData, basesSelectedBaseId: 'base',
    basesList: [structuredClone(selectedBase)],
  });
  render(<UkladProvider runtime={runtime}>{fullDetail ? <BaseDetailView /> : <BaseOverviewView />}</UkladProvider>);
  return harness;
}

it('groups targets and shared ingredients like the planner while retaining inactive demand', () => {
  const harness = setup();
  const table = harness.getSubscriptionValue([appIds.subscriptions.BASES_PRODUCTION_TABLE]);
  expect(table.groups.map(group => group.type)).toEqual(['target', 'raw']);
  expect(table).toMatchObject({ requiredBuildings: 4, missingBuildings: 1, missingMaterials: 1 });
  const bar = table.groups[0].cards.find(card => card.item.id === 'bar');
  expect(bar).toMatchObject({ kind: 'recipe', rate: 90, targetRate: 30, requiredBuildings: 3, coverage: { owned: 3, totalRequired: 3, missing: 0 } });
  const ore = within(screen.getByRole('article', { name: 'Wolfram Ore input' }));
  expect(ore.getByText('30/min missing')).toBeVisible();
  expect(ore.getByText('Bar reserves')).toBeVisible();
  expect(ore.getByText('60/min')).toBeVisible();
  expect(ore.getByRole('meter')).toHaveAttribute('aria-valuetext', '150/min of 180/min covered');
  const target = within(screen.getByRole('article', { name: 'Wolfram Bar' }));
  expect(target.getByText('Target 30/min · rest used in plans')).toBeVisible();
});

it('updates shortages when owned counts are changed and only saves typed counts explicitly', async () => {
  const harness = setup();
  const wire = within(screen.getByRole('article', { name: 'Wolfram Wire' }));
  expect(wire.getByText('1 missing')).toBeVisible();
  expect(wire.getByRole('meter', { name: 'Item coverage' })).toHaveAttribute('aria-valuenow', '0');
  fireEvent.click(wire.getByRole('button', { name: 'Increase Assembler owned count' }));
  await waitFor(() => expect(wire.getByRole('textbox', { name: 'Assembler owned count' })).toHaveValue('1'));
  expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_PRODUCTION_TABLE]).missingBuildings).toBe(0);
  expect(wire.getByRole('meter', { name: 'Item coverage' })).toHaveAttribute('aria-valuenow', '100');
  expect(wire.getByRole('meter', { name: 'Base coverage' })).toHaveAttribute('aria-valuenow', '100');
  fireEvent.change(wire.getByRole('textbox', { name: 'Assembler owned count' }), { target: { value: '3' } });
  expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS]).find(row => row.buildingId === 'assembler')?.owned).toBe(1);
  fireEvent.click(wire.getByRole('button', { name: 'Save Assembler owned count' }));
  await waitFor(() => expect(wire.getByText('2 extra')).toBeVisible());
});

it('shares building coverage across different recipes and keeps every count control in sync', async () => {
  const multiRecipeBuildings = structuredClone(buildings);
  multiRecipeBuildings[0].recipes!.push({ output: { id: 'plate', amount_per_minute: 30 }, inputs: [{ id: 'ore', amount_per_minute: 60 }] });
  const expandedBase = structuredClone(base);
  expandedBase.productions.push({ id: 'plate-plan', name: 'Plate reserves', selectedItemId: 'plate', targetAmount: 15, active: false, requiredBuildings: [{ buildingId: 'smelter', count: 1 }] });
  const harness = setup(expandedBase, multiRecipeBuildings);
  const bar = within(screen.getByRole('article', { name: 'Wolfram Bar' }));
  const plate = within(screen.getByRole('article', { name: 'Wolfram Plate' }));
  expect(bar.getByText('×3')).toBeVisible();
  expect(plate.getByText('×1')).toBeVisible();
  expect(bar.getByText('1 missing')).toBeVisible();
  expect(plate.getByText('1 missing')).toBeVisible();
  expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_PRODUCTION_TABLE]).missingBuildings).toBe(2);
  fireEvent.click(bar.getByRole('button', { name: 'Increase Smelter owned count' }));
  await waitFor(() => expect(plate.getByRole('textbox', { name: 'Smelter owned count' })).toHaveValue('4'));
  expect(bar.getByRole('meter', { name: 'Base coverage' })).toHaveAttribute('aria-valuenow', '100');
  expect(plate.getByRole('meter', { name: 'Base coverage' })).toHaveAttribute('aria-valuenow', '100');
  fireEvent.click(plate.getByRole('button', { name: 'Increase Smelter owned count' }));
  await waitFor(() => expect(bar.getByRole('textbox', { name: 'Smelter owned count' })).toHaveValue('5'));
  expect(bar.getByText('1 extra')).toBeVisible();
});

it('rounds whole buildings per plan before merging the same recipe', () => {
  const fractional = structuredClone(base);
  fractional.productions = [
    { id: 'one', name: 'First', selectedItemId: 'bar', targetAmount: 10 },
    { id: 'two', name: 'Second', selectedItemId: 'bar', targetAmount: 15 },
  ];
  const harness = setup(fractional);
  expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_PRODUCTION_TABLE]).groups[0].cards).toEqual([
    expect.objectContaining({ rate: expect.closeTo(25), targetRate: 25, requiredBuildings: 2, coverage: expect.objectContaining({ totalRequired: 2 }) }),
  ]);
});

it('keeps different recipes for the same item separate', () => {
  const variants = structuredClone(buildings);
  variants[0].recipes!.push({ id: 'efficient', variant: 'alternative', output: { id: 'bar', amount_per_minute: 20 }, inputs: [{ id: 'ore', amount_per_minute: 20 }] });
  const variantBase = structuredClone(base);
  variantBase.productions[1].recipeSelections = { bar: 'smelter:efficient' };
  const harness = setup(variantBase, variants);
  const cards = harness.getSubscriptionValue([appIds.subscriptions.BASES_PRODUCTION_TABLE]).groups.flatMap(group => group.cards).filter(card => card.item.id === 'bar');
  expect(cards).toHaveLength(2);
  expect(cards).toEqual(expect.arrayContaining([
    expect.objectContaining({ targetRate: 30, rate: 30, requiredBuildings: 2, node: expect.objectContaining({ recipeIndex: 1 }) }),
    expect.objectContaining({ targetRate: 0, rate: 60, requiredBuildings: 2, node: expect.objectContaining({ recipeIndex: 0 }) }),
  ]));
});

it('shows unused supply and opens input management', async () => {
  const harness = setup();
  const water = within(screen.getByRole('article', { name: 'Water input' }));
  expect(water.getByText('No plan demand')).toBeVisible();
  expect(water.getByText('10/min')).toBeVisible();
  expect(water.queryByRole('meter')).not.toBeInTheDocument();
  fireEvent.click(water.getByRole('button', { name: 'Manage inputs' }));
  await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_SELECTED_DETAIL_TAB])).toBe('buildings'));
});

it('shows required and covered rates with direct neutral plan editing and no overview extras', async () => {
  const harness = setup();
  const wire = within(screen.getByRole('article', { name: 'Wolfram Wire' }));
  expect(wire.getByText('Wire for Future Health Solutions')).toBeVisible();
  expect(wire.getByRole('meter', { name: 'Item coverage' })).toHaveAttribute('aria-valuetext', '0/min of 15/min covered');
  const plan = within(wire.getByRole('listitem'));
  expect(plan.getByText('Required')).toBeVisible();
  expect(plan.getByText('15/min')).toBeVisible();
  expect(plan.getByText('Covered')).toBeVisible();
  expect(plan.getByText('0/min')).toBeVisible();
  expect(plan.getByRole('button')).not.toHaveClass('btn-primary');
  fireEvent.click(plan.getByRole('button', { name: 'Edit Wire for Future Health Solutions' }));
  await waitFor(() => expect(harness.getState().productionPlanModalState).toMatchObject({ isOpen: true, editSectionId: 'wire-plan' }));
  expect(screen.queryByRole('button', { name: 'Plan details' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Add plan/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/All plans, including/)).not.toBeInTheDocument();
});

it('allocates scarce item capacity and input supply to active plans first without double counting', () => {
  const scarce = structuredClone(base);
  scarce.productions.reverse();
  scarce.buildings = scarce.buildings.filter(building => !['smelter-1', 'smelter-2'].includes(building.id));
  scarce.buildings[0].ratePerMinute = 50;
  const harness = setup(scarce);
  const cards = harness.getSubscriptionValue([appIds.subscriptions.BASES_PRODUCTION_TABLE]).groups.flatMap(group => group.cards);
  expect(cards.find(card => card.item.id === 'bar')?.itemCoverage).toMatchObject({
    required: 90, covered: 30, planDemands: [
      { planId: 'wire-plan', amount: 60, covered: 30 },
      { planId: 'bar-plan', amount: 30, covered: 0 },
    ],
  });
  expect(cards.find(card => card.item.id === 'ore')?.itemCoverage).toMatchObject({
    required: 180, covered: 50, planDemands: [
      { planId: 'wire-plan', amount: 120, covered: 50 },
      { planId: 'bar-plan', amount: 60, covered: 0 },
    ],
  });
});

it('keeps one Add Plan action on every base tab', async () => {
  const harness = setup({ id: 'base', name: 'Outpost', buildings: [], productions: [] }, buildings, true);
  for (const tab of ['Production', 'Plans', 'Buildings']) {
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${tab}`) }));
    await waitFor(() => expect(screen.getByRole('tab', { name: new RegExp(`^${tab}`) })).toHaveAttribute('aria-selected', 'true'));
    expect(screen.getAllByRole('button', { name: 'Add Plan' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add Plan' }));
    await waitFor(() => expect(harness.getState().productionPlanModalState).toMatchObject({ isOpen: true, editSectionId: null }));
    await act(async () => { harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]); });
  }
});

it('puts Delivery before Targets in the base production table', () => {
  const delivery = structuredClone(base);
  delivery.productions[0].corporationLevel = { corporationId: 'corp', level: 1 };
  const harness = setup(delivery, [...buildings, { id: ORBITAL_CARGO_LAUNCHER_BUILDING_ID, name: 'Orbital Cargo Launcher', type: 'production' }]);
  expect(harness.getSubscriptionValue([appIds.subscriptions.BASES_PRODUCTION_TABLE]).groups.map(group => group.type)).toEqual(['launcher', 'target', 'raw']);
  expect(screen.getAllByRole('rowgroup')[0]).toHaveTextContent('Delivery');
});

it('keeps invalid plans accessible and handles an empty base', async () => {
  const invalid = structuredClone(base);
  invalid.productions = [{ id: 'missing', name: 'Old plan', selectedItemId: 'removed-item', targetAmount: 10 }];
  setup(invalid);
  const unavailable = within(screen.getByRole('article', { name: 'removed-item' }));
  expect(unavailable.getByText('Review plan setup')).toBeVisible();
  expect(unavailable.getByRole('button', { name: 'Edit Old plan' })).toBeVisible();
  cleanup();
  const harness = setup({ id: 'base', name: 'Empty', buildings: [], productions: [] });
  expect(screen.getByText('No production plans yet. Add a plan to see its production chain and requirements.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Add Plan' })).not.toBeInTheDocument();
  await act(async () => { harness.dispatchSync([appIds.events.BASES_SET_SELECTED_BASE, null]); });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
