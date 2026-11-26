import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactFlowProps } from '@xyflow/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { UkladProvider } from '@/app/uklad/bindings';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { TEST_GAME_DATA } from '@/platform/headless/e2e-support';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion } from '@/platform/headless/game-data-loader';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import { createPlannerTab } from '../../state';
import { PlannerFlowDiagram } from './PlannerFlowDiagram';

const { fitView } = vi.hoisted(() => ({ fitView: vi.fn() }));
let flowProps: ReactFlowProps;
vi.mock('@xyflow/react', async original => ({
    ...await original<typeof import('@xyflow/react')>(),
    useReactFlow: () => ({ fitView }),
    Background: () => null,
    Controls: ({ children }: { children: ReactNode }) => children,
    ReactFlow: (props: ReactFlowProps) => { flowProps = props; return <>{props.nodes?.map(node => <div key={node.id} data-testid={node.id}>{node.data.label as ReactNode}</div>)}{props.children}</>; },
}));
vi.mock('./DiagramSettings', () => ({ DiagramSettings: () => null }));
vi.mock('./NodeCard', () => ({ NodeCard: () => null }));
vi.mock('./usePlannerInputActions', () => ({ usePlannerInputActions: () => ({}) }));
const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => { cleanup(); runtimes.splice(0).forEach(runtime => runtime.dispose()); vi.clearAllMocks(); });

it.each(['completed', 'interrupted'])('fits the automatic layout on every reset after a %s drag', async gesture => {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', structuredClone(TEST_GAME_DATA)]);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'plan', 'Iron plate', 'single']);
    harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'iron-plate']);
    harness.dispatchSync([appIds.events.PLANNER_SET_VIEWPORT, 'plan', 25, 50, 1]);
    const automatic = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_FLOW_GRAPH]).nodes;
    render(<UkladProvider runtime={runtime}><PlannerFlowDiagram /></UkladProvider>);
    const moved = { x: 900, y: -600 };
    await act(async () => {
        flowProps.onNodesChange!([{ type: 'position', id: automatic[0].id, position: moved, dragging: gesture === 'interrupted' }]);
        await harness.flush();
    });
    expect(flowProps.nodes![0].position).toEqual(moved);

    const reset = screen.getByRole('button', { name: 'Reset node positions' });
    const positions = () => flowProps.nodes!.map(node => node.position);
    fitView.mockImplementationOnce(positions);
    await act(async () => { fireEvent.click(reset); await harness.flush(); });
    expect(fitView).toHaveBeenCalledTimes(1);
    expect(fitView).toHaveReturnedWith(automatic.map(node => node.position));
    expect(flowProps.nodes![0].dragging).toBe(false);
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB])!.nodePositions).toEqual({});

    expect(reset).toBeEnabled();
    await act(async () => { fireEvent.click(reset); await harness.flush(); });
    expect(fitView).toHaveBeenCalledTimes(2);
});

it('saves completed node moves per tab and reapplies them when the graph is rebuilt', async () => {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    const data = gameDataBundleToAppVersioned(await loadHeadlessGameDataVersion('update2_QoL'));
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', data]);
    for (const id of ['other', 'plan']) {
        harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, id, id, 'single']);
        harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'titanium_housing']);
    }
    const view = (id: string) => <UkladProvider runtime={runtime}><PlannerFlowDiagram key={id} /></UkladProvider>;
    const rendered = render(view('plan'));
    const [first, second, untouched] = flowProps.nodes!;
    const position = { x: -175.5, y: 340 };
    const otherPosition = { x: 260, y: -89 };
    const node = (id: string) => flowProps.nodes!.find(entry => entry.id === id)!;
    const saved = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB])!.nodePositions;

    await act(async () => {
        flowProps.onNodesChange!([
            { type: 'select', id: first.id, selected: true },
            { type: 'position', id: first.id, position, dragging: true },
        ]);
        await harness.flush();
    });
    expect(node(first.id).position).toEqual(position);
    expect(saved()).toEqual({});
    await act(async () => {
        flowProps.onNodesChange!([
            { type: 'position', id: first.id, position, dragging: false },
            { type: 'position', id: second.id, position: otherPosition, dragging: false },
        ]);
        await harness.flush();
    });
    expect(saved()).toEqual({ [first.id]: position, [second.id]: otherPosition });
    expect(node(first.id).selected).toBe(true);
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 90]));
    expect(node(first.id).position).toEqual(position);
    expect(node(untouched.id).position).toEqual(untouched.position);

    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'other']));
    rendered.rerender(view('other'));
    expect(node(first.id).position).toEqual(first.position);
    const reset = screen.getByRole('button', { name: 'Reset node positions' });
    expect(reset).toBeEnabled();
    await act(async () => {
        flowProps.onNodesChange!([{ type: 'position', id: first.id, position: otherPosition, dragging: false }]);
        await harness.flush();
    });
    await act(async () => { fireEvent.click(reset); await harness.flush(); });
    expect(saved()).toEqual({});
    expect(node(first.id).position).toEqual(first.position);
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'plan']));
    rendered.rerender(view('plan'));
    expect(node(first.id).position).toEqual(position);
    expect(node(second.id).position).toEqual(otherPosition);
    await act(async () => harness.dispatchSync([appIds.events.PLANNER_SET_FLOW_DIRECTION, 'TB']));
    expect(saved()).toEqual({});
    const autoNodes = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_FLOW_GRAPH]).nodes;
    expect(node(first.id).position).toEqual(autoNodes.find(entry => entry.id === first.id)!.position);
});

it.each(['ore_titanium', 'titanium_sheet'])('keeps the pin tied to %s when resource changes reorder the graph', async pinnedItemId => {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    const data = gameDataBundleToAppVersioned(await loadHeadlessGameDataVersion('update2_QoL'));
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(data)]);
    harness.dispatchSync([appIds.events.PLANNER_OPEN_ITEM, 'titanium_housing']);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'plan', 'Titanium Housing', 'single']);
    harness.dispatchSync([appIds.events.PLANNER_SET_TARGET_AMOUNT, 30]);
    harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'ore_titanium', 60]);
    render(<UkladProvider runtime={runtime}><PlannerFlowDiagram /></UkladProvider>);

    const graph = () => harness.getSubscriptionValue([appIds.subscriptions.PLANNER_FLOW_GRAPH]);
    const oreIndex = graph().nodes.findIndex(node => node.flowNode.outputItem === 'ore_titanium');
    expect(oreIndex).toBeGreaterThanOrEqual(0);
    const pinnedId = graph().nodes.find(node => node.flowNode.outputItem === pinnedItemId)!.id;
    await act(async () => {
        fireEvent.click(within(screen.getByTestId(pinnedId)).getByRole('button', { name: 'Pin node to highlight connections' }));
        await harness.flush();
    });
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_PINNED_NODE])).toBe(pinnedId);
    expect(flowProps.nodes!.find(node => node.id === pinnedId)?.draggable).toBe(false);

    await act(async () => {
        harness.dispatchSync([appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'bar_titanium', 50]);
        await harness.flush();
    });
    expect(graph().nodes.some(node => node.flowNode.outputItem === 'ore_titanium')).toBe(false);
    // Sheet takes Ore's former array position, which previously reused its node ID.
    expect(graph().nodes[oreIndex].flowNode.outputItem).toBe('titanium_sheet');
    if (pinnedItemId === 'ore_titanium') {
        await waitFor(() => expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_PINNED_NODE])).toBeNull());
        expect(harness.getState().plannerPinnedNodes.plan).toBeUndefined();
        expect(screen.queryByRole('button', { name: 'Unpin node' })).toBeNull();
        expect(flowProps.nodes!.every(node => node.draggable !== false && !node.style?.boxShadow)).toBe(true);
        expect(flowProps.edges!.every(edge => !edge.labelStyle?.outline)).toBe(true);

        const bar = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_RESOURCES]).find(resource => resource.itemId === 'bar_titanium')!;
        await act(async () => {
            harness.dispatchSync([appIds.events.PLANNER_REMOVE_RESOURCE, bar.id]);
            await harness.flush();
        });
        expect(graph().nodes.some(node => node.flowNode.outputItem === 'ore_titanium')).toBe(true);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_PINNED_NODE])).toBeNull();
        expect(screen.queryByRole('button', { name: 'Unpin node' })).toBeNull();
    } else {
        const sheet = graph().nodes.find(node => node.flowNode.outputItem === 'titanium_sheet')!;
        expect(sheet.id).toBe(pinnedId);
        expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_PINNED_NODE])).toBe(sheet.id);
        expect(within(screen.getByTestId(sheet.id)).getByRole('button', { name: 'Unpin node' })).toHaveAttribute('aria-pressed', 'true');
        expect(flowProps.nodes!.find(node => node.id === sheet.id)?.draggable).toBe(false);
    }
});

it('restores each plan camera and pin across remounts and keeps them session-only', async () => {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    harness.restoreState({ ...harness.getState(),
        plannerTabs: ['one', 'two'].map(id => ({ ...createPlannerTab(id, id, 'single'), selectedItemId: 'plate' })),
        plannerActiveTabId: 'one',
        itemsList: [{ id: 'plate', name: 'Plate', type: 'processed' }, { id: 'ore', name: 'Ore', type: 'raw' }],
        buildingsList: [{ id: 'smelter', name: 'Smelter', recipes: [{ output: { id: 'plate', amount_per_minute: 30 }, inputs: [{ id: 'ore', amount_per_minute: 60 }] }] }],
    });
    const view = (id: string) => <UkladProvider runtime={runtime}><PlannerFlowDiagram key={id} /></UkladProvider>;
    let rendered = render(view('one'));
    await waitFor(() => expect(fitView).toHaveBeenCalled());
    const position = { x: 125, y: -230, zoom: 0.6 };
    await act(async () => { flowProps.onMove?.(null, position); await harness.flush(); });
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_VIEWPORT])).toEqual(position);
    const pinnedId = flowProps.nodes![0].id;
    await act(async () => { fireEvent.click(screen.getAllByRole('button', { name: 'Pin node to highlight connections' })[0]); await harness.flush(); });
    expect(harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_PINNED_NODE])).toBe(pinnedId);
    rendered.unmount();
    fitView.mockClear();
    rendered = render(view('one'));
    expect(flowProps.defaultViewport).toEqual(position);
    expect(screen.getByRole('button', { name: 'Unpin node' })).toHaveAttribute('aria-pressed', 'true');
    expect(flowProps.nodes!.find(node => node.id === pinnedId)?.draggable).toBe(false);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
    expect(fitView).not.toHaveBeenCalled();

    await act(async () => { harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'two']); });
    rendered.rerender(view('two'));
    expect(flowProps.defaultViewport).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Unpin node' })).toBeNull();
    await waitFor(() => expect(fitView).toHaveBeenCalled());
    await act(async () => { flowProps.onMove?.(null, { x: 5, y: 10, zoom: 1.1 }); await harness.flush(); });
    await act(async () => { harness.dispatchSync([appIds.events.PLANNER_SELECT_TAB, 'one']); });
    rendered.rerender(view('one'));
    expect(flowProps.defaultViewport).toEqual(position);
    expect(screen.getByRole('button', { name: 'Unpin node' })).toHaveAttribute('aria-pressed', 'true');
    expect(flowProps.nodes!.find(node => node.id === pinnedId)?.draggable).toBe(false);
    fitView.mockClear();
    await act(async () => { harness.dispatchSync([appIds.events.PLANNER_SET_FLOW_DIRECTION, 'TB']); });
    await waitFor(() => expect(fitView).toHaveBeenCalled());

    await act(async () => {
        harness.dispatchSync([appIds.events.PLANNER_SET_VIEWPORT, 'one', NaN, 0, 1]);
        harness.dispatchSync([appIds.events.PLANNER_SET_VIEWPORT, 'missing', 0, 0, 1]);
    });
    expect(harness.getState().plannerViewports.one).toEqual(position);
    expect(harness.getState().plannerViewports.missing).toBeUndefined();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Unpin node' })); await harness.flush(); });
    expect(harness.getState().plannerPinnedNodes.one).toBeUndefined();
    await act(async () => { harness.dispatchSync([appIds.events.PLANNER_SET_PINNED_NODE, 'one', pinnedId]); });
    await act(async () => { harness.dispatchSync([appIds.events.PLANNER_CLOSE_TAB, 'one']); });
    expect(harness.getState().plannerPinnedNodes.one).toBeUndefined();
    expect(harness.getState().plannerViewports.one).toBeUndefined();
    expect(PERSIST_KEYS.map(entry => typeof entry === 'string' ? entry : entry.key)).not.toContain('plannerViewports');
    expect(PERSIST_KEYS.map(entry => typeof entry === 'string' ? entry : entry.key)).not.toContain('plannerPinnedNodes');
    const nextSession = createAppRuntime();
    try {
        expect(createUkladTestHarness(nextSession).getState().plannerViewports).toEqual({});
        expect(createUkladTestHarness(nextSession).getState().plannerPinnedNodes).toEqual({});
    }
    finally { nextSession.dispose(); }
});
