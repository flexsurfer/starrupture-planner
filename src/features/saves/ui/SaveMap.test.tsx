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
import { createSaveWorkspace } from '../workspace';
import { SaveMap } from './SaveMap';
import type { MapNode } from './SaveMapNode';

const { fitView, setCenter, viewport } = vi.hoisted(() => ({ fitView: vi.fn(), setCenter: vi.fn(), viewport: { zoom: 1 } }));
let flowProps: ReactFlowProps<MapNode>;
vi.mock('@xyflow/react', async importOriginal => ({
    ...await importOriginal<typeof import('@xyflow/react')>(),
    ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
    useReactFlow: () => ({ fitView, setCenter }),
    useStore: (selector: (state: { transform: [number, number, number] }) => unknown) => selector({ transform: [0, 0, viewport.zoom] }),
    Handle: () => null, Background: () => <div data-testid="map-grid" />, Controls: ({ fitViewOptions, onFitView }: ControlProps) => <button aria-label="Fit view" onClick={() => {
        fitView(fitViewOptions); onFitView?.();
    }} />,
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
afterEach(() => { cleanup(); runtimes.splice(0).forEach(runtime => runtime.dispose()); vi.clearAllMocks(); viewport.zoom = 1; });

function setup({ withBounds = true, networkIds = {} }: { withBounds?: boolean; networkIds?: Record<number, number | null> } = {}) {
    const runtime = createAppRuntime();
    runtimes.push(runtime);
    registerHeadlessApplication(runtime);
    const harness = createUkladTestHarness(runtime);
    harness.dispatchSync([appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
    const snapshot = analyzeSave(snapshotFixture(), extractionContext);
    for (const core of snapshot.cores) for (const entity of [core, ...core.buildings]) {
        if (entity.id in networkIds) entity.powerNetworkId = networkIds[entity.id];
    }
    snapshot.cores[0].bounds = { min: { x: -120.5, y: -350, z: -10 }, max: { x: 279.5, y: 250, z: 10 } };
    if (!withBounds) for (const core of snapshot.cores) core.bounds = null;
    const dispatcher = snapshot.cores.flatMap(core => core.buildings).find(building => building.id === 20)!;
    dispatcher.name = 'Ore dispatch';
    dispatcher.position = { x: -100, y: 250, z: 75 };
    let workspace = createSaveWorkspace('one', 'World', snapshot);
    harness.restoreState({ ...harness.getState(), savesWorkspaces: { one: workspace }, savesWorkspaceOrder: ['one'], savesActiveWorkspaceId: 'one' });
    const onOpenCore = vi.fn();
    const view = () => <UkladProvider runtime={runtime}><SaveMap workspace={workspace} initialCoreId={1} onOpenCore={onOpenCore} /></UkladProvider>;
    let result = render(view());
    return { onOpenCore, harness, remount: () => { result.unmount(); result = render(view()); }, replaceSnapshot: async () => {
        workspace = createSaveWorkspace('one', 'World', analyzeSave(snapshotFixture(), extractionContext));
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
        expect(button(id)).toHaveAttribute('aria-description', 'Power network 0');
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
    expect(button(20)).not.toHaveAttribute('aria-description');
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
    expect(within(building).getByRole('button')).toHaveAttribute('aria-description', 'Power network 0');
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
