import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactFlowProps } from '@xyflow/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { UkladProvider } from '@/app/uklad/bindings';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import { createPlannerTab } from '../../state';
import { PlannerFlowDiagram } from './PlannerFlowDiagram';

const { fitView } = vi.hoisted(() => ({ fitView: vi.fn() }));
let flowProps: ReactFlowProps;
vi.mock('@xyflow/react', async original => ({
    ...await original<typeof import('@xyflow/react')>(),
    useReactFlow: () => ({ fitView }),
    ReactFlow: (props: ReactFlowProps) => { flowProps = props; return <>{props.nodes?.map(node => <div key={node.id}>{node.data.label as ReactNode}</div>)}</>; },
}));
vi.mock('./DiagramSettings', () => ({ DiagramSettings: () => null }));
vi.mock('./NodeCard', () => ({ NodeCard: () => null }));
vi.mock('./usePlannerInputActions', () => ({ usePlannerInputActions: () => ({}) }));
const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => { cleanup(); runtimes.splice(0).forEach(runtime => runtime.dispose()); vi.clearAllMocks(); });

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
