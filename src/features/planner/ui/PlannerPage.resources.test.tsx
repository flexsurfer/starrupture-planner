import type { ReactNode } from 'react';
import type { ReactFlowProps } from '@xyflow/react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import { UkladProvider } from '@/app/uklad/bindings';
import { createAppRuntime } from '@/app/uklad/runtime';
import { registerApplicationModules } from '@/app/uklad/register';
import { TEST_GAME_DATA } from '@/platform/headless/e2e-support';
import PlannerPage from './PlannerPage';

const { fitView } = vi.hoisted(() => ({ fitView: vi.fn() }));
vi.mock('@xyflow/react', async original => ({
    ...await original<typeof import('@xyflow/react')>(),
    useReactFlow: () => ({ fitView }),
    ReactFlow: ({ nodes }: ReactFlowProps) => <>{nodes?.map(node => <div key={node.id}>{node.data.label as ReactNode}</div>)}</>,
}));

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => {
    cleanup();
    runtimes.splice(0).forEach(runtime => runtime.dispose());
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'show');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal');
    Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
    vi.clearAllMocks();
});

function setup(view: 'graph' | 'table', suppliedAmount?: number) {
    HTMLDialogElement.prototype.show = function () { this.open = true; };
    HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    HTMLDialogElement.prototype.close = function () { this.open = false; };
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    runtime.registerModule(registerApplicationModules);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', structuredClone(TEST_GAME_DATA)]);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'resource-plan', 'Resource plan', 'single', view]);
    harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'iron-plate']);
    harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 125.5]);
    if (suppliedAmount) harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'iron-ore', suppliedAmount]);
    render(<UkladProvider runtime={runtime}><PlannerPage /></UkladProvider>);
    return harness;
}

it.each(['graph', 'table'] as const)('keeps manual entry visible and refreshes it from a %s card with the current card amount', async view => {
    const harness = setup(view);
    const openFromCard = () => fireEvent.click(screen.getByRole('button', { name: 'Manage resources for Iron Ore' }));
    openFromCard();
    expect(screen.getByLabelText('Item')).toHaveValue('iron-ore');
    expect(screen.getByLabelText('Amount / min')).toHaveValue(125.5);
    fireEvent.change(screen.getByLabelText('Amount / min'), { target: { value: '9' } });
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add resource' })).not.toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Add manual resource' })).toBeVisible();
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES])).toEqual([]);

    openFromCard();
    expect(screen.getByLabelText('Item')).toHaveValue('iron-ore');
    expect(screen.getByLabelText('Amount / min')).toHaveValue(125.5);
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 165.25]));
    fireEvent.change(screen.getByLabelText('Amount / min'), { target: { value: '9' } });
    openFromCard();
    expect(screen.getByLabelText('Item')).toHaveValue('iron-ore');
    expect(screen.getByLabelText('Amount / min')).toHaveValue(165.25);
    fireEvent.click(within(screen.getByRole('form', { name: 'Add manual resource' })).getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 165.25 }));
    expect(screen.getByRole('form', { name: 'Add manual resource' })).toBeVisible();
    openFromCard();
    expect(screen.getByLabelText('Amount / min')).toHaveValue(165.25);
});

it.each(['graph', 'table'] as const)('opens manual entry for an existing resource from a %s card using its consumed rate', view => {
    const harness = setup(view, 200);
    fireEvent.click(screen.getByRole('button', { name: 'Manage resources for Iron Ore' }));
    expect(screen.getByRole('form', { name: 'Add manual resource' })).toBeVisible();
    expect(screen.getByLabelText('Item')).toHaveValue('iron-ore');
    expect(screen.getByLabelText('Amount / min')).toHaveValue(125.5);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_EXTERNAL_INPUTS])).toEqual({ 'iron-ore': 200 });
});

it.each(['graph', 'table'] as const)('filters resources by the selected %s node and returns to regular mode when cleared', async view => {
    const harness = setup(view, 200);
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'copper-ore', 30]));
    const resources = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES]);
    const openFromCard = () => fireEvent.click(screen.getByRole('button', { name: 'Manage resources for Iron Ore' }));
    openFromCard();
    const panel = within(screen.getByRole('complementary', { name: 'Resources' }));
    expect(panel.getByText('Selected node')).toBeVisible();
    expect(panel.getByRole('heading', { name: 'Iron Ore' })).toBeVisible();
    expect(panel.getByLabelText('Resource amount for Iron Ore')).toBeVisible();
    expect(panel.queryByRole('heading', { name: 'Copper Ore' })).not.toBeInTheDocument();
    expect(panel.getByLabelText('Item')).toBeDisabled();

    fireEvent.click(panel.getByRole('button', { name: 'Clear node selection' }));
    expect(panel.queryByText('Selected node')).not.toBeInTheDocument();
    expect(panel.getByRole('heading', { name: 'Resources' })).toBeVisible();
    expect(panel.getByRole('heading', { name: 'Iron Ore' })).toBeVisible();
    expect(panel.getByRole('heading', { name: 'Copper Ore' })).toBeVisible();
    expect(panel.getByLabelText('Item')).toBeEnabled();
    expect(panel.getByLabelText('Item')).toHaveValue('');
    expect(panel.getByLabelText('Amount / min')).toHaveValue(60);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES])).toEqual(resources);

    openFromCard();
    expect(panel.getByText('Selected node')).toBeVisible();
    expect(panel.getByLabelText('Item')).toHaveValue('iron-ore');
    expect(panel.getByLabelText('Amount / min')).toHaveValue(125.5);
    expect(panel.queryByRole('heading', { name: 'Copper Ore' })).not.toBeInTheDocument();
});
