import { act, cleanup, fireEvent, renderHook, screen } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { ReactFlowProvider, useReactFlow } from '@xyflow/react';
import { expect, it, vi } from 'vitest';
import { UkladProvider } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import { createAppRuntime } from '@/app/uklad/runtime';
import { TEST_GAME_DATA } from '@/platform/headless/e2e-support';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { PlannerFlowDiagram } from './PlannerFlowDiagram';

it('keeps a selected production node and connection on Backspace and supports arrow-key moves', async ({ onTestFinished }) => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
    const runtime = createAppRuntime();
    onTestFinished(() => {
        cleanup();
        runtime.dispose();
        vi.unstubAllGlobals();
    });
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'playtest', structuredClone(TEST_GAME_DATA)]);
    harness.dispatchSync([appIds.events.PLANNER_CREATE_TAB, 'plan', 'Iron plate', 'single']);
    harness.dispatchSync([appIds.events.PLANNER_SET_SELECTED_ITEM, 'iron-plate']);
    const { result } = renderHook(() => useReactFlow(), {
        wrapper: ({ children }) => (
            <UkladProvider runtime={runtime}>
                <ReactFlowProvider><PlannerFlowDiagram />{children}</ReactFlowProvider>
            </UkladProvider>
        ),
    });
    const [edge] = result.current.getEdges();
    const node = screen.getByTestId(`rf__node-${edge.source}`);
    fireEvent.click(node);
    // Box selection also selects connections incident to the selected nodes.
    await act(async () => result.current.updateEdge(edge.id, { selected: true }));
    expect(node).toHaveClass('selected');
    expect(result.current.getEdge(edge.id)?.selected).toBe(true);

    await act(async () => { fireEvent.keyDown(node, { key: 'Backspace' }); });
    fireEvent.keyUp(node, { key: 'Backspace' });
    expect(node).toBeInTheDocument();
    expect(result.current.getEdge(edge.id)).toBeDefined();

    const before = result.current.getNode(edge.source)!.position;
    await act(async () => {
        fireEvent.keyDown(node, { key: 'ArrowRight' });
        await harness.flush();
    });
    const saved = harness.getSubscriptionValue([appIds.subscriptions.PLANNER_ACTIVE_TAB])!.nodePositions;
    expect(saved[edge.source].x).toBeGreaterThan(before.x);
});
