import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { Base, BaseBuilding, Building, Item } from '@/app/uklad/model';
import type { BuildingSectionBuilding } from '@/features/bases/types';
import { BuildingSection } from './BuildingSection';
import { BuildingSectionCard } from './BuildingSectionCard';

const { dispatch } = vi.hoisted(() => ({ dispatch: vi.fn() }));
vi.mock('@/app/uklad/bindings', () => ({
  useRuntime: () => ({ dispatch }),
  useSubscription: ([id]: [string]) => {
    switch (id) {
      case appIds.subscriptions.ITEMS_BY_ID_MAP: return Object.fromEntries(items.map(item => [item.id, item]));
      case appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID: return items;
      case appIds.subscriptions.BUILDINGS_BY_ID_MAP: return { receiver, dispatcher, smelter };
      case appIds.subscriptions.BASES_BASE_BY_ID: return base;
      case appIds.subscriptions.BASES_LIST: return [base];
      case appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS: return [grouped];
      case appIds.subscriptions.BASES_BUILDING_SECTION_STATS: return {
        buildingCount: 3, totalHeat: 9, totalPowerConsumption: 15, totalPowerGeneration: 0,
      };
    }
  },
}));

const items: Item[] = [{ id: 'bar', name: 'Wolfram Bar', type: 'processed' }, { id: 'wire', name: 'Wolfram Wire', type: 'component' }];
const receiver: Building = { id: 'receiver', name: 'Receiver', type: 'logistics', power: 40, heat: 40 };
const dispatcher: Building = { id: 'dispatcher', name: 'Dispatcher', type: 'logistics', power: 40, heat: 40 };
const smelter: Building = { id: 'smelter', name: 'Smelter', type: 'production', power: 5, heat: 3 };
const grouped: BuildingSectionBuilding = {
  id: 'smelter', buildingTypeId: 'smelter', building: smelter, sectionType: 'production',
  count: 3, isGrouped: true, activePlanNames: ['Wolfram bars'],
};
const input: BaseBuilding = { id: 'input', buildingTypeId: 'receiver', sectionType: 'inputs', selectedItemId: 'bar', ratePerMinute: 10 };
const output: BaseBuilding = { id: 'output', buildingTypeId: 'dispatcher', sectionType: 'outputs', sourceProductionId: 'plan', capacityPerMinute: 200, priority: 0 };
const base: Base = {
  id: 'base', name: 'Base', buildings: [input, output],
  productions: [{ id: 'plan', name: 'Wire plan', selectedItemId: 'wire', targetAmount: 150 }],
};
const entry = (baseBuilding: BaseBuilding): BuildingSectionBuilding => ({
  id: baseBuilding.id, buildingTypeId: baseBuilding.buildingTypeId, baseBuilding,
  building: baseBuilding.sectionType === 'inputs' ? receiver : dispatcher,
  sectionType: baseBuilding.sectionType as 'inputs' | 'outputs', count: 1, isGrouped: false, activePlanNames: [],
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('keeps Add accessible when a section is collapsed without toggling it', () => {
  const onAdd = vi.fn();
  render(<BuildingSection title="Production" description="Process materials." baseId="base" sectionType="production" onAdd={onAdd} />);
  const toggle = screen.getByRole('button', { name: 'Production' });
  fireEvent.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('heading', { name: 'Smelter' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add production building' }));
  expect(onAdd).toHaveBeenCalledOnce();
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(toggle);
  expect(screen.getByRole('heading', { name: 'Smelter' })).toBeVisible();
});

it('preserves count adjustments, explicit draft saving, and removal confirmation', () => {
  render(<BuildingSectionCard sectionBuilding={grouped} baseId="base" />);
  fireEvent.click(screen.getByRole('button', { name: 'Increase Smelter production count' }));
  expect(dispatch).toHaveBeenLastCalledWith([appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT, 'base', 'smelter', 'production', 4]);
  dispatch.mockClear();
  fireEvent.change(screen.getByRole('textbox', { name: 'Smelter production count' }), { target: { value: '12' } });
  expect(dispatch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Save Smelter production count' }));
  expect(dispatch).toHaveBeenLastCalledWith([appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT, 'base', 'smelter', 'production', 12]);
  fireEvent.click(screen.getByRole('button', { name: 'Remove Smelter' }));
  expect(dispatch).toHaveBeenLastCalledWith([
    appIds.events.UI_SHOW_CONFIRMATION_DIALOG, 'Remove Smelter?', expect.any(String), expect.any(Function),
    expect.objectContaining({ confirmLabel: 'Remove' }),
  ]);
});

it('opens the item editor from a manual input and saves its new rate', () => {
  render(<BuildingSectionCard sectionBuilding={entry(input)} baseId="base" />);
  fireEvent.click(screen.getByRole('button', { name: 'Edit Wolfram Bar item and rate' }));
  expect(screen.getByRole('heading', { name: 'Select Item for Receiver' })).toBeVisible();
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(dispatch).toHaveBeenLastCalledWith([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, 'base', 'input', 'bar', 25]);
  expect(screen.queryByRole('heading', { name: 'Select Item for Receiver' })).not.toBeInTheDocument();
});

it('shows live linked supply and lets the source return to manual', () => {
  const linked = { ...input, linkedOutput: { baseId: 'base', buildingId: 'output', itemIdSnapshot: 'bar', ratePerMinuteSnapshot: 10 } };
  const { rerender } = render(<BuildingSectionCard sectionBuilding={entry(linked)} baseId="base" />);
  expect(screen.getByText('Wolfram Wire')).toBeVisible();
  expect(screen.getByText('150/min')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Edit .* item and rate/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Source' }), { target: { value: '' } });
  expect(dispatch).toHaveBeenLastCalledWith([appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, 'base', 'input', 'wire', 150]);
  rerender(<BuildingSectionCard sectionBuilding={entry({ ...linked, linkedOutput: { ...linked.linkedOutput, baseId: 'missing' } })} baseId="base" />);
  expect(screen.getByTitle('Broken linked output: Missing base / output')).toHaveTextContent('Broken link');
  expect(screen.getByText('10/min')).toBeVisible();
});

it('keeps plan-linked output capacity and target controls available', () => {
  render(<BuildingSectionCard sectionBuilding={entry(output)} baseId="base" />);
  expect(screen.getByText('150/min')).toBeVisible();
  expect(screen.queryByRole('button', { name: /Edit .* item and rate/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Capacity/min' }), { target: { value: '120' } });
  expect(dispatch).toHaveBeenLastCalledWith([
    appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK, 'base', 'output',
    { sourceProductionId: 'plan', allocationMode: 'auto', capacityPerMinute: 120, priority: 0 },
  ]);
  fireEvent.change(screen.getByRole('combobox', { name: 'Target' }), { target: { value: 'base:input' } });
  expect(dispatch).toHaveBeenLastCalledWith([appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, 'base', 'input', 'base', 'output']);
});
