import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createUkladTestHarness } from '@ukladjs/core/testing';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactFlowProps, NodeProps, ControlProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { PERSIST_KEYS } from '@/platform/web/persistence';
import { createAppRuntime } from '@/app/uklad/runtime';
import { UkladProvider } from '@/app/uklad/bindings';
import { registerHeadlessApplication } from '@/platform/headless/register';
import { analyzeSave } from '../decoder/analyze';
import { extractionContext, snapshotFixture, saveGameData } from '../decoder/test-fixture';
import type { SaveSnapshot } from '../snapshot';
import { factoryMapOverlapFixture } from '../../../../test/fixtures/factory-map-overlaps';
import { createSaveWorkspace } from '../workspace';
import { SaveMap } from './SaveMap';
import type { MapNode } from './SaveMapNode';
import { BUILDING_DETAIL_ZOOM } from './map-viewport';

const { fitView, setCenter, getViewport, viewport } = vi.hoisted(() => {
    const viewport = { x: 0, y: 0, zoom: 1, width: 0, height: 0 };
    return { fitView: vi.fn(), setCenter: vi.fn(), getViewport: () => viewport, viewport };
});
let flowProps: ReactFlowProps<MapNode>;
vi.mock('@xyflow/react', async importOriginal => ({
    ...await importOriginal<typeof import('@xyflow/react')>(),
    ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
    useReactFlow: () => ({ fitView, setCenter, getViewport }),
    useStore: (selector: (state: { transform: [number, number, number]; width: number; height: number }) => unknown) => selector({
        transform: [viewport.x, viewport.y, viewport.zoom], width: viewport.width, height: viewport.height,
    }),
    Handle: () => null, Background: () => <div data-testid="map-grid" />, Controls: ({ fitViewOptions, onFitView, onZoomIn, onZoomOut }: ControlProps) => <>
        <button aria-label="Fit view" onClick={() => { fitView(fitViewOptions); onFitView?.(); }} />
        <button aria-label="Zoom in" onClick={onZoomIn} /><button aria-label="Zoom out" onClick={onZoomOut} />
    </>,
    ReactFlow: (props: ReactFlowProps<MapNode>) => {
        flowProps = props;
        return <div>{props.nodes?.map(node => {
            const Component = props.nodeTypes![node.type!];
            return <div key={node.id} data-testid={`rf-node-${node.id}`} style={node.style}><Component {...{
                ...node, dragging: false, isConnectable: false, positionAbsoluteX: node.position.x, positionAbsoluteY: node.position.y,
            } as NodeProps<MapNode>} /></div>;
        })}{props.children}</div>;
    },
}));

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => {
    cleanup(); runtimes.splice(0).forEach(runtime => runtime.dispose()); vi.clearAllMocks();
    Object.assign(viewport, { x: 0, y: 0, zoom: 1, width: 0, height: 0 });
});

function setup({ withBounds = true, networkIds = {}, snapshot: exampleSnapshot }: {
    withBounds?: boolean; networkIds?: Record<number, number | null>; snapshot?: SaveSnapshot;
} = {}) {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
    const snapshot = exampleSnapshot ?? analyzeSave(snapshotFixture(), extractionContext);
    for (const core of snapshot.cores) for (const entity of [core, ...core.buildings]) {
        if (entity.id in networkIds) entity.powerNetworkId = networkIds[entity.id];
    }
    if (!exampleSnapshot) {
        snapshot.cores[0].bounds = { min: { x: -120.5, y: -350, z: -10 }, max: { x: 279.5, y: 250, z: 10 } };
        const dispatcher = snapshot.cores.flatMap(core => core.buildings).find(building => building.id === 20)!;
        dispatcher.name = 'Ore dispatch';
        dispatcher.position = { x: -100, y: 250, z: 75 };
    }
    if (!withBounds) for (const core of snapshot.cores) core.bounds = null;
    let workspace = createSaveWorkspace('one', 'World', snapshot);
    harness.restoreState({ ...harness.getState(), savesWorkspaces: { one: workspace }, savesWorkspaceOrder: ['one'], savesActiveWorkspaceId: 'one' });
    const onOpenCore = vi.fn();
    const view = () => <UkladProvider runtime={runtime}><SaveMap workspace={workspace} initialCoreId={1} onOpenCore={onOpenCore} /></UkladProvider>;
    let result = render(view());
    return { onOpenCore, harness, remount: () => { result.unmount(); result = render(view()); }, rename: async (name: string) => {
        await act(async () => {
            harness.dispatchSync([appIds.events.SAVES_RENAME_WORKSPACE, 'one', name]);
            workspace = harness.getState().savesWorkspaces.one;
            result.rerender(view());
        });
    }, replaceSnapshot: async (nextSnapshot = analyzeSave(snapshotFixture(), extractionContext)) => {
        workspace = createSaveWorkspace('one', 'World', nextSnapshot);
        await act(async () => {
            harness.restoreState({ ...harness.getState(), savesImport: { requestId: 50, targetWorkspaceId: 'one', phase: 'reading', fileName: 'World.sav', error: null } });
            harness.dispatchSync([appIds.events.SAVES_IMPORT_READY, 50, workspace.snapshot]);
            workspace = harness.getState().savesWorkspaces.one;
            result.rerender(view());
        });
    } };
}

it('restores zoom and pan after remounting without fitting over the session viewport', async () => {
    const { harness, remount, replaceSnapshot } = setup();
    expect(flowProps.fitView).toBe(true);
    expect(flowProps.defaultViewport).toBeUndefined();
    const position = { x: -480, y: 235, zoom: 0.4 };
    await act(async () => {
        flowProps.onMove?.(new MouseEvent('mousemove'), position);
        await harness.flush();
    });
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP_VIEWPORT, 'one'])).toEqual(position);
    remount();
    expect(flowProps.defaultViewport).toEqual(position);
    expect(flowProps.fitView).toBe(false);
    // Search, Core focus and Fit view move the camera programmatically (null event).
    const focused = { x: 100, y: -50, zoom: 1.2 };
    await act(async () => {
        flowProps.onMove?.(null, focused);
        await harness.flush();
    });
    await replaceSnapshot();
    expect(flowProps.defaultViewport).toEqual(focused);
    expect(PERSIST_KEYS.map(entry => typeof entry === 'string' ? entry : entry.key)).not.toContain('savesMapViewports');
    const nextSession = createAppRuntime();
    try {
        expect(createUkladTestHarness(nextSession).getState().savesMapViewports).toEqual({});
    } finally { nextSession.dispose(); }
});

it('scopes viewports to existing saves, rejects invalid positions and removes them with the save', async () => {
    const { harness } = setup();
    act(() => { harness.dispatchSync([appIds.events.SAVES_SET_MAP_VIEWPORT, 'one', 10, 20, 0.5]); });
    for (const [x, y, zoom] of [[NaN, 0, 1], [0, Infinity, 1], [0, 0, 0], [0, 0, 4]]) {
        harness.dispatchSync([appIds.events.SAVES_SET_MAP_VIEWPORT, 'one', x, y, zoom]);
    }
    harness.dispatchSync([appIds.events.SAVES_SET_MAP_VIEWPORT, 'missing', 1, 2, 1]);
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP_VIEWPORT, 'one'])).toEqual({ x: 10, y: 20, zoom: 0.5 });
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP_VIEWPORT, 'missing'])).toBeNull();
    act(() => { harness.dispatchSync([appIds.events.SAVES_REMOVE_WORKSPACE, 'one']); });
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP_VIEWPORT, 'one'])).toBeNull();
});

async function interact(action: () => void) {
    await act(async () => {
        action();
        for (const runtime of runtimes) await createUkladTestHarness(runtime).flush();
    });
}

async function toggleLayer(name: string) {
    const checkbox = layerCheckbox(name);
    await interact(() => { fireEvent.click(checkbox); });
}

function layerCheckbox(name: string) {
    const settings = screen.getByRole('button', { name: 'Map settings' });
    if (settings.getAttribute('aria-expanded') !== 'true') fireEvent.click(settings);
    return screen.getByRole('checkbox', { name });
}

function setupOverlapExamples() {
    return setup({ snapshot: analyzeSave(factoryMapOverlapFixture(), extractionContext) });
}

const markerButton = (id: number) => within(screen.getByTestId(`rf-node-${id}`)).getByRole('button');
const layerControls = () => screen.getByRole('region', { name: 'Building layers' });
const levelControls = () => screen.getByRole('region', { name: 'Building levels' });
const changeLevel = (direction: 'Higher' | 'Lower') => interact(() => {
    fireEvent.click(within(levelControls()).getByRole('button', { name: `${direction} level` }));
});
const node = (id: number) => flowProps.nodes!.find(node => node.id === String(id))!;
const focusExample = (id: number) => interact(() => {
    fireEvent.change(screen.getByRole('combobox', { name: 'Focus Core' }), { target: { value: String(id) } });
});
const searchFor = async (id: number) => {
    const search = screen.getByRole('combobox', { name: 'Find a building' });
    await interact(() => { fireEvent.change(search, { target: { value: `#${id}` } }); });
    await interact(() => { fireEvent.keyDown(search, { key: 'Enter' }); });
};

it('reveals each of the four aligned pairs as layers, preserving every individual building and position', async () => {
    setupOverlapExamples();
    const geometry = () => flowProps.nodes!.map(({ id, position }) => ({ id, position }));
    const original = geometry();
    for (const id of [105, 106, 107, 108]) {
        expect(markerButton(id).querySelector('.save-map-layer-badge')).toHaveTextContent('2');
        expect(node(id).zIndex).toBeGreaterThan(node(id - 4).zIndex!);
        await interact(() => { fireEvent.click(markerButton(id)); });
        expect(within(layerControls()).getByRole('button', { name: 'Above' })).toBeDisabled();
        await interact(() => { fireEvent.click(within(layerControls()).getByRole('button', { name: 'Below' })); });
        expect(markerButton(id - 4)).toHaveAttribute('aria-pressed', 'true');
        expect(markerButton(id - 4).querySelector('.save-map-layer-badge')).toHaveTextContent('1');
        expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 2');
        expect(node(id).data.ghost).toBe(true);
        expect(node(id).style?.pointerEvents).toBe('none');
        expect(within(layerControls()).getByRole('button', { name: 'Above' })).toHaveFocus();
        expect(within(screen.getByTestId(`rf-node-${id}`)).queryByRole('button')).toBeNull();
        expect(node(id).zIndex).toBeGreaterThan(node(id - 4).zIndex!);
        expect(screen.getByRole('region', { name: 'Building details' })).toHaveTextContent(`Exact ${id - 104}`);
        await interact(() => { fireEvent.click(within(layerControls()).getByRole('button', { name: 'Above' })); });
        expect(node(id).data.ghost).toBe(false);
    }
    expect(geometry()).toEqual(original);
    expect(screen.queryByText('Overlapping buildings')).toBeNull();
});

it('reveals offset mixed buildings using node intersections without physical geometry', async () => {
    setupOverlapExamples();
    await focusExample(2);
    expect([201, 202, 203].every(id => node(id).data.hasLayers)).toBe(true);
    expect(screen.queryByRole('slider')).toBeNull();
    expect([201, 202, 203].map(id => node(id).data.entity.level)).toEqual([2, 3, 1]);
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 3 of 3');
    await changeLevel('Lower');
    expect(node(202).data.ghost).toBe(true);
    expect([201, 203].every(id => !node(id).data.ghost)).toBe(true);
    await interact(() => { fireEvent.click(markerButton(201)); });
    await interact(() => { fireEvent.click(within(layerControls()).getByRole('button', { name: 'Below' })); });
    expect(markerButton(203)).toHaveAttribute('aria-pressed', 'true');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 3');
    expect([201, 202].every(id => node(id).data.ghost)).toBe(true);
    await searchFor(202);
    expect([201, 202, 203].every(id => !node(id).data.ghost)).toBe(true);
});

it('changes overlap levels without hiding unrelated buildings on higher ground', async () => {
    setupOverlapExamples();
    await focusExample(6);
    expect(levelControls().parentElement).toHaveClass('save-map-canvas');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 2 of 2');
    expect(levelControls().textContent).toBe('2'); // No text panel beside the control.
    expect(levelControls().querySelector('.save-map-level-symbol svg')).not.toBeNull();
    expect([601, 602, 603, 604].map(id => node(id).data.entity.level)).toEqual([1, 1, 1, 2]);
    await changeLevel('Lower');
    expect(node(604).data.ghost).toBe(true);
    expect([601, 602, 603].every(id => !node(id).data.ghost)).toBe(true);
    expect(node(105).data.ghost).toBe(false); // Other Cores are untouched.
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 2');
    expect(within(levelControls()).getByRole('button', { name: 'Lower level' })).toBeDisabled();
    expect(within(levelControls()).getByRole('button', { name: 'Higher level' })).toHaveFocus();
    await interact(() => { fireEvent.click(markerButton(602)); }); // High terrain still selects level 1.
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 2');
    expect(screen.queryByRole('region', { name: 'Building layers' })).toBeNull();
    await changeLevel('Higher');
    expect(within(levelControls()).getByRole('button', { name: 'Higher level' })).toBeDisabled();
    expect(within(levelControls()).getByRole('button', { name: 'Lower level' })).toHaveFocus();
    expect([601, 602, 603, 604].every(id => !node(id).data.ghost)).toBe(true);
    expect(screen.queryByRole('region', { name: 'Building details' })).toBeNull();
});

it('skips same-Z comparisons even when markers or positions coincide', async () => {
    setupOverlapExamples();
    await focusExample(3);
    expect(screen.queryByRole('region', { name: 'Building levels' })).toBeNull();
    for (const id of [301, 302, 303, 304, 305, 306, 307, 308]) {
        expect(node(id).data.hasLayers).toBe(false);
        await interact(() => { fireEvent.click(markerButton(id), { detail: 1, clientX: 150, clientY: 60 }); });
        expect(screen.queryByRole('region', { name: 'Building layers' })).toBeNull();
    }
});

it('navigates irregular negative and fractional heights and searches hidden duplicates by ID', async () => {
    setupOverlapExamples();
    await searchFor(505);
    expect(markerButton(505)).toHaveAttribute('aria-pressed', 'true');
    expect(node(506).data.ghost).toBe(true);
    expect(layerControls()).toHaveTextContent('Level 5');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 5 of 10');
    await interact(() => { fireEvent.click(within(layerControls()).getByRole('button', { name: 'Below' })); });
    expect(markerButton(504)).toHaveAttribute('aria-pressed', 'true');
    expect(layerControls()).toHaveTextContent('Level 4');
    await searchFor(501);
    expect(layerControls()).toHaveTextContent('Level 1');
    expect(within(layerControls()).getByRole('button', { name: 'Below' })).toBeDisabled();
    expect(node(510).data.ghost).toBe(true);
    await searchFor(510);
    expect(node(510).data.ghost).toBe(false);
    expect(markerButton(510)).toHaveAttribute('aria-pressed', 'true');
    expect(markerButton(510).querySelector('.save-map-layer-badge')).toHaveTextContent('10');
    await searchFor(801);
    expect(layerControls()).toHaveTextContent('Level 1');
    expect(node(802).data.ghost).toBe(true);
    await interact(() => { fireEvent.keyDown(screen.getByRole('region', { name: 'Snapshot map' }), { key: 'Escape' }); });
    expect(screen.queryByRole('region', { name: 'Building layers' })).toBeNull();
});

it('follows the Core in view after panning, retaining independent levels without moving the camera', async () => {
    Object.assign(viewport, { width: 800, height: 600, x: 250, y: 150 });
    const { remount } = setupOverlapExamples();
    const picker = () => screen.getByRole('combobox', { name: 'Focus Core' });
    expect(picker()).toHaveValue('1');
    await changeLevel('Lower');
    const core6View = { x: 400 - 5200, y: 300 - 5150, zoom: 1 };
    await interact(() => { flowProps.onMove?.(new MouseEvent('mousemove'), core6View); });
    expect(picker()).toHaveValue('1'); // No flicker while dragging between Cores.
    await interact(() => { flowProps.onMoveEnd?.(new MouseEvent('mouseup'), core6View); });
    expect(picker()).toHaveValue('6');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 2 of 2');
    await changeLevel('Lower');
    expect(node(604).data.ghost).toBe(true);
    expect(node(105).data.ghost).toBe(true);
    await interact(() => { flowProps.onMoveEnd?.(null, { x: 250, y: 150, zoom: 1 }); });
    expect(picker()).toHaveValue('1');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 2');
    await changeLevel('Higher');
    expect(node(105).data.ghost).toBe(false);
    expect(node(604).data.ghost).toBe(true);
    await interact(() => { flowProps.onMoveEnd?.(null, { x: -3000, y: -3000, zoom: 1 }); });
    expect(picker()).toHaveValue('');
    expect(screen.queryByRole('region', { name: 'Building levels' })).toBeNull();
    // A restored camera is authoritative over initialCoreId, including on mount.
    Object.assign(viewport, { x: 400 - 15150, y: 300 - 5150 });
    await interact(() => { flowProps.onMove?.(null, viewport); });
    remount();
    expect(picker()).toHaveValue('8');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 2 of 2');
    expect(fitView).not.toHaveBeenCalled();
    expect(setCenter).not.toHaveBeenCalled();
});

it('preserves cutaways on rename and resets them on import even when building IDs are unchanged', async () => {
    const { harness, rename, replaceSnapshot } = setupOverlapExamples();
    await focusExample(1);
    await changeLevel('Lower');
    expect(node(105).data.ghost).toBe(true);
    await focusExample(6);
    await changeLevel('Lower');
    expect(node(604).data.ghost).toBe(true);
    const map = harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one']);
    const snapshot = harness.getState().savesWorkspaces.one.snapshot;
    await rename('Renamed world');
    expect(harness.getState().savesWorkspaces.one.snapshot).toBe(snapshot);
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one'])).not.toBe(map);
    expect(node(105).data.ghost).toBe(true);
    expect(node(604).data.ghost).toBe(true);
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 2');
    await replaceSnapshot(structuredClone(snapshot));
    expect(flowProps.nodes!.some(node => node.data.ghost)).toBe(false);
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 2 of 2');
});

it('keeps All Cores and Fit view selected after programmatic fitting, even on compact maps', async () => {
    Object.assign(viewport, { width: 800, height: 600, x: 250, y: 150 });
    setupOverlapExamples();
    const picker = screen.getByRole('combobox', { name: 'Focus Core' });
    for (const zoom of [.05, 1.2]) {
        await interact(() => { fireEvent.change(picker, { target: { value: '' } }); });
        Object.assign(viewport, { zoom });
        await interact(() => {
            flowProps.onMoveStart?.(null, viewport);
            flowProps.onMove?.(null, viewport);
            flowProps.onMoveEnd?.(null, viewport);
        });
        expect(picker).toHaveValue('');
        expect(screen.queryByRole('region', { name: 'Building levels' })).toBeNull();
    }
    // Zoom buttons are deliberate camera navigation and release the explicit target.
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Zoom in' })); });
    await interact(() => { flowProps.onMoveEnd?.(null, viewport); });
    expect(picker).toHaveValue('1');
    expect(levelControls()).toBeInTheDocument();
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Fit view' })); });
    await interact(() => { flowProps.onMoveEnd?.(null, viewport); });
    expect(picker).toHaveValue('');
    // Direct panning also releases All Cores, but only at a close zoom.
    await interact(() => { flowProps.onMoveStart?.(new MouseEvent('mousedown'), viewport); });
    await interact(() => { flowProps.onMoveEnd?.(new MouseEvent('mouseup'), { x: 400 - 15150, y: 300 - 5150, zoom: 1 }); });
    expect(picker).toHaveValue('8');
});

it('hides level controls and automatic Core focus at world zoom without changing level assignments', async () => {
    Object.assign(viewport, { width: 800, height: 600, x: 250, y: 150 });
    const { harness } = setupOverlapExamples();
    const map = harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one']);
    await changeLevel('Lower');
    for (const zoom of [BUILDING_DETAIL_ZOOM - .001, BUILDING_DETAIL_ZOOM]) {
        Object.assign(viewport, { x: 400 - 150 * zoom, y: 300 - 150 * zoom, zoom });
        await interact(() => { flowProps.onMoveEnd?.(new MouseEvent('mouseup'), viewport); });
        if (zoom < BUILDING_DETAIL_ZOOM) {
            expect(screen.queryByRole('region', { name: 'Building levels' })).toBeNull();
            expect(screen.getByRole('combobox', { name: 'Focus Core' })).toHaveValue('');
        } else {
            expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 2');
            expect(screen.getByRole('combobox', { name: 'Focus Core' })).toHaveValue('1');
        }
        expect(node(105).data.ghost).toBe(true);
        expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one'])).toEqual(map);
    }
});

it('preserves aligned stacks and selection across zoom, all node sizes and visual settings', async () => {
    viewport.zoom = .2;
    const { harness, remount } = setupOverlapExamples();
    expect(markerButton(801).querySelector('.save-map-layer-badge')).toBeNull();
    const map = harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one']);
    const original = flowProps.nodes!.map(({ id, position }) => ({ id, position }));
    await interact(() => { fireEvent.click(markerButton(801)); });
    expect(layerControls()).toBeInTheDocument();
    expect(node(802).data.ghost).toBe(true);
    viewport.zoom = 2;
    remount();
    expect(node(802).data.ghost).toBe(true);
    expect(markerButton(801).querySelector('.save-map-layer-badge')).not.toBeNull();
    await toggleLayer('Power networks');
    for (const size of ['Compact', 'Standard', 'Large']) {
        await interact(() => {
            const button = screen.getByRole('button', { name: size });
            button.focus(); fireEvent.click(button);
        });
        expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one'])?.stacks.get(101)).toEqual(map?.stacks.get(101));
        expect(node(801).data.hasLayers).toBe(true);
        expect(node(802).data.ghost).toBe(true);
        expect(node(601).data.hasLayers).toBe(false);
        expect(node(602).data.hasLayers).toBe(false);
        expect(layerControls()).toBeInTheDocument();
        expect(screen.getByRole('button', { name: size })).toHaveFocus();
    }
    expect(flowProps.nodes!.map(({ id, position }) => ({ id, position }))).toEqual(original);
});

it('recalculates layers on node resize, resets stale cutaways and keeps the selected building visible', async () => {
    const { harness } = setupOverlapExamples();
    await focusExample(8);
    await toggleLayer('Power networks'); // Open map settings.
    const resize = (size: string) => interact(() => { fireEvent.click(screen.getByRole('button', { name: size })); });
    expect([801, 802, 803, 804].map(id => node(id).data.entity.level)).toEqual([1, 2, 1, 1]);
    await resize('Large');
    expect([801, 802, 803, 804].map(id => node(id).data.entity.level)).toEqual([1, 2, 2, 3]);
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 3 of 3');
    await changeLevel('Lower');
    expect(node(804).data.ghost).toBe(true);
    await resize('Compact');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 2 of 2');
    expect([801, 802, 803, 804].every(id => !node(id).data.ghost)).toBe(true);
    await resize('Large');
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 3 of 3');
    expect(node(804).data.ghost).toBe(false); // No stale cutaway returns when switching back.
    await searchFor(803);
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 2 of 3');
    await resize('Standard');
    expect(markerButton(803)).toHaveAttribute('aria-pressed', 'true');
    expect(node(803).data.hasLayers).toBe(false);
    expect(node(802).data.ghost).toBe(true);
    expect(within(levelControls()).getByRole('status')).toHaveAccessibleName('Level 1 of 2');
    await resize('Large');
    expect(markerButton(803)).toHaveAttribute('aria-pressed', 'true');
    expect(markerButton(803).querySelector('.save-map-layer-badge')).toHaveTextContent('2');
    expect(node(804).data.ghost).toBe(true);
    const map = harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one']);
    await toggleLayer('Power networks');
    await toggleLayer('Building names');
    expect(harness.getSubscriptionValue([appIds.subscriptions.SAVES_MAP, 'one'])).toBe(map);
    expect(node(804).data.ghost).toBe(true);
});

it('hides links with ghost endpoints, follows real cargo connections and resets layers on import', async () => {
    const { replaceSnapshot } = setupOverlapExamples();
    expect([701, 702, 703, 704].map(id => node(id).data.entity.level)).toEqual([1, 2, 1, 2]);
    await interact(() => { fireEvent.click(markerButton(701)); });
    expect(node(702).data.ghost).toBe(true);
    expect(flowProps.edges!.map(edge => edge.source)).toEqual(['701']);
    await interact(() => {
        fireEvent.click(within(screen.getByRole('region', { name: 'Building details' })).getByRole('button', { name: 'Show connected building' }));
    });
    expect(markerButton(703)).toHaveAttribute('aria-pressed', 'true');
    expect(node(704).data.ghost).toBe(true);
    expect(flowProps.edges!.find(edge => edge.source === '701')?.label).toBe('Helium-3');
    await replaceSnapshot();
    expect(screen.queryByRole('region', { name: 'Building layers' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Building details' })).toBeNull();
    expect(flowProps.nodes!.some(node => node.data.ghost)).toBe(false);
});

it('keeps the selected node, display settings and layers when returning to the map', async () => {
    const { remount } = setup();
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Ore dispatch' })); });
    await toggleLayer('Cargo links');
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Large' })); });
    remount();
    expect(screen.getByRole('region', { name: 'Building details' })).toHaveTextContent('Ore dispatch');
    expect(flowProps.nodes!.find(node => node.id === '20')?.data.selected).toBe(true);
    expect(flowProps.nodes!.find(node => node.id === '20')?.width).toBe(88);
    expect(flowProps.edges).toEqual([]);
    expect(layerCheckbox('Cargo links')).not.toBeChecked();
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Close' })); });
    remount();
    expect(screen.queryByRole('region', { name: 'Building details' })).toBeNull();
});

it('opens building details, follows cargo endpoints and keeps positions read-only', async () => {
    const { onOpenCore } = setup();
    const node = flowProps.nodes!.find(node => node.id === '20')!;
    expect(node.position).toEqual({ x: -10, y: 25 });
    expect(flowProps.nodesDraggable).toBe(false);
    expect(flowProps.nodesConnectable).toBe(false);
    expect(flowProps.deleteKeyCode).toBeNull();
    expect(flowProps.onlyRenderVisibleElements).toBe(true);
    expect(flowProps.attributionPosition).toBe('bottom-left');
    expect(screen.queryByRole('checkbox', { name: 'Cargo links' })).toBeNull();
    expect(flowProps.fitViewOptions?.nodes).toContainEqual({ id: '1' });
    expect(flowProps.fitViewOptions?.nodes).not.toContainEqual({ id: '2' });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Ore dispatch' })); });
    const panel = screen.getByRole('region', { name: 'Building details' });
    expect(within(panel).queryByRole('heading', { name: 'Building details' })).toBeNull();
    expect(panel).not.toHaveTextContent('Power network');
    expect(panel).toHaveTextContent('Helium-3');
    expect(panel).toHaveTextContent('240/min');
    expect(panel).not.toHaveTextContent('X -100 · Y 250 · Z 75');
    expect(screen.queryByText('Coordinates (save units)')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Save map' })).toBeNull();
    expect(screen.queryByText('Saved positions')).toBeNull();
    expect(flowProps.edges!.find(edge => edge.source === '20')?.label).toBe('Helium-3');
    expect(within(panel).queryByRole('button', { name: 'Focus Core' })).toBeNull();
    expect(flowProps.nodes!.find(node => node.id === '20')?.data.selected).toBe(true);
    await interact(() => { fireEvent.click(within(panel).getByRole('button', { name: 'Show connected building' })); });
    expect(flowProps.nodes!.find(node => node.id === '30')?.data.selected).toBe(true);
    expect(screen.getByRole('region', { name: 'Building details' })).toHaveTextContent('Cargo Receiver');
    expect(setCenter).toHaveBeenCalledWith(3, 0, { zoom: 1.2, duration: 300 });
    expect(screen.queryByRole('button', { name: 'View details' })).toBeNull();
    expect(onOpenCore).not.toHaveBeenCalled();
    await toggleLayer('Cargo links');
    expect(flowProps.edges).toEqual([]);
});

it('focuses a Core, selects stacked buildings through the selector, and clears selection after snapshot replacement', async () => {
    const { replaceSnapshot } = setup();
    await interact(() => { fireEvent.change(screen.getByRole('combobox', { name: 'Focus Core' }), { target: { value: '2' } }); });
    expect(fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ id: '2' })]) }));
    await interact(() => { fireEvent.change(screen.getByRole('combobox', { name: 'Find a building' }), { target: { value: '#200' } }); });
    await interact(() => { fireEvent.keyDown(screen.getByRole('combobox', { name: 'Find a building' }), { key: 'Enter' }); });
    expect(screen.getByRole('region', { name: 'Building details' })).toHaveTextContent('Tube');
    expect(screen.getByRole('region', { name: 'Building details' })).toHaveTextContent('Inputs');
    await replaceSnapshot();
    expect(screen.queryByRole('region', { name: 'Building details' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Find a building' })).toHaveValue('');
});

it('searches building IDs and resources with the keyboard, closes results independently, and dismisses the inspector', async () => {
    setup();
    const search = screen.getByRole('combobox', { name: 'Find a building' });
    const positions = flowProps.nodes!.map(({ id, position }) => ({ id, position }));
    expect(screen.queryByRole('region', { name: 'Building details' })).toBeNull();
    await interact(() => { fireEvent.focus(search); });
    await interact(() => { fireEvent.change(search, { target: { value: 'helium' } }); });
    expect(screen.getAllByRole('option').some(option => option.textContent?.includes('Ore dispatch'))).toBe(true);
    await interact(() => { fireEvent.change(search, { target: { value: '#200' } }); });
    expect(screen.getByRole('listbox', { name: 'Buildings' })).toHaveTextContent('#200');
    expect(document.getElementById(search.getAttribute('aria-activedescendant')!)).toHaveAttribute('aria-selected', 'true');
    await interact(() => { fireEvent.keyDown(search, { key: 'ArrowDown' }); });
    await interact(() => { fireEvent.keyDown(search, { key: 'Enter' }); });
    expect(search).toHaveAttribute('aria-expanded', 'false');
    expect(flowProps.nodes!.find(node => node.id === '200')?.data.selected).toBe(true);
    expect(screen.getByRole('region', { name: 'Building details' })).toHaveTextContent('Tube');
    expect(flowProps.nodes!.map(({ id, position }) => ({ id, position }))).toEqual(positions);

    await interact(() => { fireEvent.change(search, { target: { value: 'no matching building' } }); });
    expect(screen.getByText('No buildings found.')).toBeInTheDocument();
    await interact(() => { fireEvent.keyDown(search, { key: 'Escape' }); });
    expect(search).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('region', { name: 'Building details' })).toBeInTheDocument();
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Close' })); });
    expect(screen.queryByRole('region', { name: 'Building details' })).toBeNull();
});

it('shows only Core focus actions and keeps them in sync with the Core picker', async () => {
    const { onOpenCore } = setup();
    const picker = screen.getByRole('combobox', { name: 'Focus Core' });
    await interact(() => { fireEvent.change(picker, { target: { value: '2' } }); });
    const expectedFocus = fitView.mock.calls.at(-1)![0];
    await interact(() => { fireEvent.change(picker, { target: { value: '' } }); });
    await interact(() => { flowProps.nodes!.find(node => node.id === '2')!.data.onSelect(2); });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Focus Core' })); });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'View details' })); });
    expect(onOpenCore).toHaveBeenCalledWith(2);
    expect(picker).toHaveValue('2');
    const actualFocus = fitView.mock.calls.at(-1)![0];
    expect({ ...actualFocus, nodes: actualFocus.nodes.map((node: MapNode) => node.id) })
        .toEqual({ ...expectedFocus, nodes: expectedFocus.nodes.map((node: MapNode) => node.id) });
    expect(setCenter).not.toHaveBeenCalled();
    expect(flowProps.nodes!.find(node => node.id === '2')?.data.selected).toBe(true);
});

it('resets the Core picker when fitting the entire map', async () => {
    setup();
    const picker = screen.getByRole('combobox', { name: 'Focus Core' });
    expect(picker).toHaveValue('1');
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Fit view' })); });
    expect(picker).toHaveValue('');
    expect(fitView).toHaveBeenCalledWith({ padding: 0.2, minZoom: 0.005, maxZoom: 1.5, duration: 300 });
});

it('shows saved Core bounds behind buildings, includes them in fitting, and toggles them independently', async () => {
    setup();
    const bounds = () => flowProps.nodes!.find(node => node.id === 'bounds-1');
    const markers = flowProps.nodes!.filter(node => node.type === 'saveBuilding').map(node => ({ id: node.id, position: node.position }));
    expect(layerCheckbox('Core bounds')).toBeChecked();
    expect(bounds()).toMatchObject({ position: { x: -12.05, y: -35 }, origin: [0, 0], width: 40, height: 60,
        zIndex: -1, style: { pointerEvents: 'none' }, selectable: false, draggable: false, focusable: false });
    expect(flowProps.fitViewOptions?.nodes).toContainEqual({ id: 'bounds-1' });
    const rect = screen.getByTestId('rf-node-bounds-1').querySelector('rect')!;
    expect(rect).toHaveAttribute('vector-effect', 'non-scaling-stroke');
    expect(rect).toHaveAttribute('stroke-width', '1');
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Ore dispatch' })); });
    expect(screen.getByRole('region', { name: 'Building details' })).toBeInTheDocument();
    expect(rect).toHaveAttribute('stroke-width', '2');
    const edges = flowProps.edges;
    await toggleLayer('Core bounds');
    expect(screen.queryByTestId('rf-node-bounds-1')).toBeNull();
    expect(flowProps.nodes!.some(node => node.type === 'saveCoreBounds')).toBe(false);
    expect(flowProps.nodes!.map(node => ({ id: node.id, position: node.position }))).toEqual(markers);
    expect(flowProps.edges).toEqual(edges);
    expect(flowProps.nodes!.find(node => node.id === '20')?.data.selected).toBe(true);
    await toggleLayer('Core bounds');
    expect(bounds()?.data.selected).toBe(true);
    await interact(() => { fireEvent.change(screen.getByRole('combobox', { name: 'Focus Core' }), { target: { value: '1' } }); });
    expect(fitView).toHaveBeenCalledWith(expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ id: 'bounds-1' })]) }));
});

it('keeps maps usable without Core bounds and explains how to refresh older imports', async () => {
    setup({ withBounds: false });
    expect(flowProps.nodes!.every(node => node.type === 'saveBuilding')).toBe(true);
    expect(screen.getByText('Some Core bounds are unavailable. Try re-importing the save.')).toBeInTheDocument();
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Ore dispatch' })); });
    expect(screen.getByRole('region', { name: 'Building details' })).toBeInTheDocument();
    await toggleLayer('Core bounds');
    expect(screen.queryByText('Some Core bounds are unavailable. Try re-importing the save.')).toBeNull();
});

it('toggles stable network colors across Cores and buildings without changing other map layers', async () => {
    setup({ networkIds: { 1: 0, 20: 0, 30: 0, 2: 8, 22: null } });
    const toggle = layerCheckbox('Power networks');
    const node = (id: number) => flowProps.nodes!.find(node => node.id === String(id))!;
    const button = (id: number) => within(screen.getByTestId(`rf-node-${id}`)).getByRole('button');
    const geometry = () => flowProps.nodes!.map(({ id, position }) => ({ id, position }));
    const originalGeometry = geometry();
    const originalEdges = flowProps.edges;
    expect(toggle).not.toBeChecked();
    expect(node(20).data.powerColor).toBeUndefined();
    await toggleLayer('Power networks');
    const color = node(20).data.powerColor;
    expect(color).toBeTruthy();
    expect(node(1).data.powerColor).toBe(color);
    expect(node(30).data.powerColor).toBe(color);
    expect(node(2).data.powerColor).not.toBe(color);
    expect(node(2).data.powerColor).toBeTruthy();
    expect(node(22).data.powerColor).toBeUndefined();
    expect(button(20).style.getPropertyValue('--save-map-network-color')).toBe(color);
    expect(button(30).style.getPropertyValue('--save-map-network-color')).toBe(color);
    expect(button(1).style.getPropertyValue('--save-map-network-color')).toBe(color);
    for (const id of [1, 20, 30]) {
        expect(button(id)).toHaveClass('has-power-network');
        expect(button(id).style.getPropertyValue('--save-map-network-border-style')).toBe('solid');
        expect(button(id).querySelector('.save-map-network-badge')).toHaveTextContent('#0');
        expect(button(id)).toHaveAttribute('aria-description', expect.stringContaining('Power network 0'));
    }
    expect(button(22).style.getPropertyValue('--save-map-network-color')).toBe('');
    expect(button(22)).not.toHaveClass('has-power-network');
    expect(button(22).querySelector('.save-map-network-badge')).toBeNull();
    expect(button(20)).toHaveAttribute('title', expect.stringContaining('Power network 0'));
    expect(geometry()).toEqual(originalGeometry);
    expect(flowProps.edges).toEqual(originalEdges);
    await interact(() => { fireEvent.click(button(20)); });
    expect(button(20)).toHaveAttribute('aria-pressed', 'true');
    expect(button(20)).toHaveClass('is-selected');
    expect(node(20).data.powerColor).toBe(color);
    await toggleLayer('Power networks');
    expect(button(20).style.getPropertyValue('--save-map-network-color')).toBe('');
    expect(button(1)).not.toHaveClass('has-power-network');
    expect(button(20).querySelector('.save-map-network-badge')).toBeNull();
    expect(button(20).getAttribute('aria-description')).not.toContain('Power network');
    expect(button(20)).toHaveAttribute('aria-pressed', 'true');
    await toggleLayer('Core bounds');
    await toggleLayer('Cargo links');
    await toggleLayer('Power networks');
    expect(node(20).data.powerColor).toBe(color);
    expect(node(30).data.powerColor).toBe(color);
    expect(flowProps.edges).toEqual([]);
    expect(flowProps.nodes!.every(node => node.type === 'saveBuilding')).toBe(true);
});

it('uses uniform building sizes without moving saved positions, resizing Cores or changing cargo destinations', async () => {
    setup();
    const geometry = () => flowProps.nodes!.map(({ id, position }) => ({ id, position }));
    const initialGeometry = geometry();
    const bounds = flowProps.nodes!.find(node => node.id === 'bounds-1');
    const links = flowProps.edges;
    const building = () => flowProps.nodes!.find(node => node.id === '20')!;
    expect(building().width).toBe(72);
    expect(flowProps.nodes!.filter(node => node.type === 'saveBuilding' && node.data.entity.detail).every(node => node.width === 72 && node.height === 72)).toBe(true);
    expect(links!.find(edge => edge.source === '20')).toMatchObject({
        type: 'saveCargo', target: '30', sourceHandle: 'source-top', targetHandle: 'target-bottom',
    });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Ore dispatch' })); });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Map settings' })); });
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Large' })); });
    expect(building().width).toBe(88);
    expect(flowProps.nodes!.filter(node => node.type === 'saveBuilding' && node.data.entity.detail).every(node => node.width === 88 && node.height === 88)).toBe(true);
    expect(building().data.selected).toBe(true);
    expect(flowProps.nodes!.find(node => node.id === '1')?.width).toBe(48);
    expect(flowProps.nodes!.find(node => node.id === 'bounds-1')).toMatchObject({ width: bounds!.width, height: bounds!.height });
    expect(geometry()).toEqual(initialGeometry);
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Compact' })); });
    expect(building().width).toBe(56);
    expect(geometry()).toEqual(initialGeometry);
    await interact(() => { fireEvent.keyDown(screen.getByRole('button', { name: 'Compact' }), { key: 'Escape' }); });
    expect(screen.getByRole('button', { name: 'Map settings' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Map settings' })).toHaveFocus();
    expect(screen.getByRole('region', { name: 'Building details' })).toBeInTheDocument();
});

it('keeps network identities on Cores at overview zoom without crowding small buildings with badges', async () => {
    viewport.zoom = 0.2;
    setup({ networkIds: { 1: 0, 20: 0 } });
    await toggleLayer('Power networks');
    const core = screen.getByTestId('rf-node-1');
    const building = screen.getByTestId('rf-node-20');
    expect(core.querySelector('.save-map-network-badge')).toHaveTextContent('#0');
    expect(building.querySelector('.save-map-network-badge')).toBeNull();
    expect(within(building).getByRole('button')).toHaveClass('has-power-network');
    expect(within(building).getByRole('button')).toHaveAttribute('aria-description', expect.stringContaining('Power network 0'));
});

it('keeps nearby Core names visible and shows building counts at overview zoom', async () => {
    viewport.zoom = 0.03;
    setup();
    for (const id of [1, 2]) {
        const label = screen.getByTestId(`rf-node-${id}`).querySelector('.save-map-core-label')!;
        expect(label).toHaveTextContent(id === 1 ? 'Workshop' : 'Core 2');
        expect(label).not.toHaveClass('is-crowded');
        expect(label.querySelector('small')).toHaveTextContent('buildings');
    }
    const labels = [1, 2].map(id => screen.getByTestId(`rf-node-${id}`).querySelector<HTMLElement>('.save-map-core-label')!);
    expect(labels[0].style.top).not.toBe(labels[1].style.top);
});

it('omits Core building counts at closer zoom', async () => {
    setup();
    for (const id of [1, 2]) {
        const label = screen.getByTestId(`rf-node-${id}`).querySelector('.save-map-core-label')!;
        expect(label.querySelector('small')).toBeNull();
    }
});

it('enables cargo movement by default and controls map detail and transport motion independently', async () => {
    setup();
    const marker = screen.getByTestId('rf-node-20');
    const initialLinks = flowProps.edges!.map(({ source, target }) => ({ source, target }));
    expect(flowProps.edges!.every(edge => edge.data?.animate)).toBe(true);
    await interact(() => { fireEvent.click(screen.getByRole('button', { name: 'Map settings' })); });
    expect(marker.querySelector('.save-map-resource-marker')).not.toBeNull();
    expect(marker.querySelector('.save-map-building-label')).not.toHaveClass('is-visible');
    await interact(() => { fireEvent.blur(screen.getByRole('button', { name: 'Map settings' }), { relatedTarget: null }); });
    await interact(() => { fireEvent.blur(screen.getByRole('button', { name: 'Map settings' }), { relatedTarget: document.body }); });
    await interact(() => { fireEvent.click(screen.getByText('Building names')); });
    expect(marker.querySelector('.save-map-building-label')).toHaveClass('is-visible');
    await interact(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'Resource icons' })); });
    expect(marker.querySelector('.save-map-resource-marker')).toBeNull();
    await interact(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'Grid' })); });
    expect(screen.queryByTestId('map-grid')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Cargo movement' })).toBeChecked();
    await interact(() => { fireEvent.click(screen.getByRole('checkbox', { name: 'Cargo movement' })); });
    expect(flowProps.edges!.every(edge => !edge.data?.animate)).toBe(true);
    expect(flowProps.edges!.map(({ source, target }) => ({ source, target }))).toEqual(initialLinks);
    expect(screen.queryByRole('button', { name: 'Reset display' })).toBeNull();
    expect(screen.queryByText('Labels appear as you zoom in.')).toBeNull();
    expect(layerCheckbox('Core bounds')).toBeChecked();
    await interact(() => { fireEvent.pointerDown(screen.getByRole('region', { name: 'Snapshot map' })); });
    expect(screen.getByRole('button', { name: 'Map settings' })).toHaveAttribute('aria-expanded', 'false');
});

it('shows overview resource information in the Core inspector', async () => {
    setup();
    await interact(() => { fireEvent.click(within(screen.getByTestId('rf-node-1')).getByRole('button')); });
    const panel = screen.getByRole('region', { name: 'Building details' });
    const incoming = within(panel).getByRole('region', { name: 'Available resources' });
    expect(incoming).toHaveTextContent('Titanium Ore');
    expect(incoming).toHaveTextContent('Local extraction');
    expect(within(incoming).queryByRole('heading', { name: 'Local extraction' })).toBeNull();
    const outgoing = within(panel).getByRole('region', { name: 'Sent to other Cores' });
    expect(outgoing).toHaveTextContent('Helium-3');
    expect(outgoing).toHaveTextContent('To Core 2');
    expect(within(panel).getByRole('button', { name: 'View details' })).toBeInTheDocument();
});
