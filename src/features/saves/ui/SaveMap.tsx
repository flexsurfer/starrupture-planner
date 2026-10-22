import type { MapDisplaySettings, MapLayers } from '../map-preferences';
import { useCallback, useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, useStore, type Position, type Viewport, type NodeMouseHandler, type EdgeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { useFlowLabels } from '@/shared/i18n/useFlowLabels';
import type { SaveMap as MapData, SaveMapEntity } from '../map';
import type { SaveWorkspace } from '../types';
import { SaveMapCoreBounds, SaveMapNode, type MapNode } from './SaveMapNode';
import { SaveMapDetails } from './SaveMapDetails';
import { SaveMapLevels, SaveMapBuildingLayers } from './SaveMapLevels';
import { SaveMapIcon } from './SaveMapIcon';
import { SaveMapSearch } from './SaveMapSearch';
import { SaveMapEdge, type CargoEdge } from './SaveMapEdge';
import { SaveMapSettings } from './SaveMapSettings';
import { SaveMapCoreLabels } from './SaveMapCoreLabels';
import { createMapNodeProjector, createCargoEdgeProjector } from './map-scene';
import { cargoHandles } from './map-display';
import { powerNetworkStyles } from './power-network-style';
import { BUILDING_DETAIL_ZOOM, buildingsVisible, coreInViewport, mapFocusMarkers } from './map-viewport';
import { CORE_MARKER_SIZE, projectMapPosition as project } from '../map-coordinates';
import './SaveMap.css';

const nodeTypes = { saveBuilding: SaveMapNode, saveCoreBounds: SaveMapCoreBounds };
const edgeTypes = { saveCargo: SaveMapEdge };
const nodeOrigin: [number, number] = [0.5, 0.5];
// Hidden building geometry still participates in fitting, search and camera restoration.
const fitOptions = { padding: 0.2, minZoom: 0.005, maxZoom: 1.5, includeHiddenNodes: true };
const motionDuration = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 300;

function MapGrid() {
    // Keep planner-style dots visible across the much wider world-map zoom range.
    const zoom = useStore(state => state.transform[2]);
    const gap = 100 * 2 ** Math.ceil(Math.log2(20 / (100 * zoom)));
    return <Background gap={gap} size={1 / zoom} />;
}

function SaveMapCanvas({ map, workspace, initialCoreId, onOpenCore }: {
    map: MapData; workspace: SaveWorkspace; initialCoreId: number | null; onOpenCore: (id: number) => void;
}) {
    const { t } = useTranslation();
    const flowLabels = useFlowLabels();
    const runtime = useRuntime();
    const viewport = useSubscription([appIds.subscriptions.SAVES_MAP_VIEWPORT, workspace.id]);
    const theme = useSubscription([appIds.subscriptions.UI_THEME]);
    const { fitView, setCenter, getViewport } = useReactFlow<MapNode>();
    const width = useStore(state => state.width);
    const height = useStore(state => state.height);
    const showBuildingDetail = useStore(state => state.transform[2] >= BUILDING_DETAIL_ZOOM);
    const [showBuildings, setShowBuildings] = useState(() => buildingsVisible(viewport?.zoom ?? getViewport().zoom, false));
    const nextShowBuildings = useStore(useCallback(state => buildingsVisible(state.transform[2], showBuildings), [showBuildings]));
    if (nextShowBuildings !== showBuildings) setShowBuildings(nextShowBuildings);
    const [moving, setMoving] = useState(false);
    const selections = useSubscription([appIds.subscriptions.SAVES_MAP_SELECTED_NODES]);
    const layers = useSubscription([appIds.subscriptions.SAVES_MAP_LAYERS]);
    const setLayers = useCallback((value: MapLayers) => runtime.dispatch([appIds.events.SAVES_SET_MAP_LAYERS, value]), [runtime]);
    const { showLinks, showBounds, showPowerNetworks } = layers;
    const display = useSubscription([appIds.subscriptions.SAVES_MAP_DISPLAY]);
    const setDisplay = useCallback((value: MapDisplaySettings) => runtime.dispatch([appIds.events.SAVES_SET_MAP_DISPLAY, value]), [runtime]);
    // Explicit navigation provides immediate feedback. Once the camera settles,
    // derive focus from that viewport (also on remount and resize).
    const [focus, setFocus] = useState<{ coreId: string } | { viewport: Viewport }>(() => viewport
        ? { viewport } : { coreId: initialCoreId === null ? '' : String(initialCoreId) });
    const setFocusedCore = useCallback((coreId: string) => setFocus({ coreId }), []);
    const onMoveStart = useCallback((event: unknown, next: Viewport) => {
        setMoving(true);
        if (event !== null) setFocus({ viewport: next });
    }, []);
    const onMoveEnd = useCallback((event: unknown, next: Viewport) => {
        setMoving(false);
        runtime.dispatch([appIds.events.SAVES_SET_MAP_VIEWPORT, workspace.id, next.x, next.y, next.zoom]);
        // Programmatic fitting must retain an explicit picker target, including All Cores.
        setFocus(current => event === null && 'coreId' in current ? current : { viewport: next });
    }, [runtime, workspace.id]);
    const onZoom = useCallback(() => setFocus({ viewport: getViewport() }), [getViewport]);
    const powerStyles = useMemo(() => powerNetworkStyles(map.entities.map(entity =>
        (entity.detail?.instance ?? entity.core.core).powerNetworkId)), [map]);
    const coreName = useCallback((entity: SaveMapEntity) => entity.core.core.name ?? t('Core {number}', { number: entity.coreNumber }), [t]);
    const entityName = useCallback((entity: SaveMapEntity) => entity.detail
        ? entity.detail.instance.name ?? entity.detail.building.name : coreName(entity), [coreName]);
    const byId = useMemo(() => new Map(map.entities.map(entity => [entity.id, entity])), [map]);
    // Reset before children commit on import or resize, releasing obsolete state.
    // Renames preserve snapshot identity and therefore retain the cutaways.
    const [cutaways, setCutaways] = useState(() => ({ snapshot: workspace.snapshot,
        buildingSize: map.buildingSize, levels: new Map<number, number>() }));
    if (cutaways.snapshot !== workspace.snapshot || cutaways.buildingSize !== map.buildingSize) {
        setCutaways({ snapshot: workspace.snapshot, buildingSize: map.buildingSize, levels: new Map() });
    }
    const levelLimits = cutaways.levels;
    const setLevelLimit = useCallback((coreId: number, level: number) => {
        setCutaways(current => current.levels.get(coreId) === level ? current
            : { ...current, levels: new Map(current.levels).set(coreId, level) });
    }, []);
    const cores = useMemo(() => map.entities.filter(entity => !entity.detail), [map]);
    const focusMarkers = useMemo(() => mapFocusMarkers(map.entities), [map]);
    const viewportCore = useMemo(() => 'viewport' in focus
        ? coreInViewport(focusMarkers, focus.viewport, width, height, map.buildingSize) : null,
    [focus, focusMarkers, width, height, map.buildingSize]);
    const focusedCore = 'coreId' in focus ? focus.coreId : viewportCore === null ? '' : String(viewportCore);
    const corePositions = useMemo(() => cores.map(core => ({ ...project(core.position), id: core.id, name: coreName(core) })), [cores, coreName]);
    // Import replacement clears session selection because node IDs belong to a snapshot.
    const selected = byId.get(selections[workspace.id]);
    const selectedCoreId = selected?.core.core.id;
    const selectedStack = selected && map.stacks.get(selected.id);
    const hasBuildingLayers = selectedStack && (selectedStack.above.length > 0 || selectedStack.below.length > 0);
    const selectEntity = useCallback((id: number | null) => runtime.dispatch([appIds.events.SAVES_SELECT_MAP_NODE, workspace.id, id]), [runtime, workspace.id]);
    const selectMarker = useCallback((id: number) => {
        const entity = byId.get(id);
        if (!entity) return;
        if (entity.detail) {
            setFocusedCore(String(entity.core.core.id));
            setLevelLimit(entity.core.core.id, entity.level!);
        }
        selectEntity(id);
    }, [byId, setLevelLimit, selectEntity, setFocusedCore]);
    const scopeId = focusedCore !== '' && byId.get(Number(focusedCore))?.detail === null ? Number(focusedCore) : null;
    const levelCount = scopeId === null ? 0 : map.levelCountsByCore.get(scopeId) ?? 0;
    // A restored selection reveals the same level even before transient camera
    // controls have been used in this mount.
    const levelForCore = useCallback((coreId: number) => levelLimits.get(coreId)
        ?? (selected?.detail && selectedCoreId === coreId ? selected.level! : undefined), [levelLimits, selected, selectedCoreId]);
    const currentLevel = (scopeId === null ? undefined : levelForCore(scopeId)) ?? levelCount;
    const heightRanks = useMemo(() => new Map([...new Set(map.entities.map(entity => entity.position.z))]
        .sort((a, b) => a - b).map((z, index) => [z, index * 2])), [map]);
    const aboveCutaway = useCallback((entity: SaveMapEntity) => {
        const level = levelForCore(entity.core.core.id);
        return entity.level !== null && level !== undefined && entity.level > level;
    }, [levelForCore]);
    const ghosts = useMemo(() => {
        const ids = new Set(map.entities.filter(aboveCutaway).map(entity => entity.id));
        if (selected) {
            for (const id of map.stacks.get(selected.id)?.above ?? []) ids.add(id);
        }
        return ids;
    }, [map, aboveCutaway, selected]);
    const resetLevels = useCallback(() => {
        setCutaways(current => current.levels.size ? { ...current, levels: new Map() } : current);
        selectEntity(null);
    }, [selectEntity]);
    const focusEntity = useCallback((id: number) => {
        const entity = byId.get(id);
        if (!entity) return;
        selectMarker(id);
        const point = project(entity.position);
        // Search/cargo navigation reveals the selected building's overlap level.
        setFocusedCore(String(entity.core.core.id));
        void setCenter(point.x, point.y, { zoom: 1.2, duration: motionDuration() });
    }, [byId, selectMarker, setFocusedCore, setCenter]);
    const ports = useMemo(() => {
        const result = new Map<number, MapNode['data']['ports']>();
        for (const link of [...map.links, ...map.coreLinks]) {
            const handles = cargoHandles(byId.get(link.source)!.position, byId.get(link.target)!.position);
            for (const [entityId, id, type] of [[link.source, handles.sourceHandle, 'source'], [link.target, handles.targetHandle, 'target']] as const) {
                const entries = result.get(entityId) ?? [];
                if (!entries.some(port => port.id === id)) entries.push({ id, type, position: id.split('-')[1] as Position });
                result.set(entityId, entries);
            }
        }
        return result;
    }, [map, byId]);
    const baseNodes = useMemo<MapNode[]>(() => map.entities.flatMap(entity => {
        const networkId = (entity.detail?.instance ?? entity.core.core).powerNetworkId;
        const powerStyle = showPowerNetworks && networkId !== null ? powerStyles.get(networkId) : undefined;
        const data = { entity, name: entityName(entity), selected: false,
            related: false, ports: ports.get(entity.id) ?? [], onSelect: selectMarker,
            hasLayers: Boolean(map.stacks.get(entity.id)?.above.length || map.stacks.get(entity.id)?.below.length),
            ghost: false,
            showNames: display.showNames, showResources: display.showResources,
            powerColor: powerStyle?.color, powerBorderStyle: powerStyle?.borderStyle };
        const size = entity.detail ? map.buildingSize : CORE_MARKER_SIZE;
        const marker: MapNode = {
            id: String(entity.id), type: 'saveBuilding', position: project(entity.position), width: size, height: size,
            // Fixed sizes and ports are known without mounting DOM. This keeps fit
            // extents and cargo routes correct even for endpoints never in view.
            measured: { width: size, height: size },
            handles: data.ports.map(port => ({ ...port, width: 6, height: 6,
                x: (port.position === 'left' ? 0 : port.position === 'right' ? size : size / 2) - 3,
                y: (port.position === 'top' ? 0 : port.position === 'bottom' ? size : size / 2) - 3 })),
            style: { width: size, height: size },
            // Selection may raise a marker within its elevation, never over a higher building.
            zIndex: entity.detail ? heightRanks.get(entity.position.z)! : heightRanks.size * 2 + 2, data,
        };
        const bounds = !entity.detail ? entity.core.core.bounds : null;
        if (!bounds) return [marker];
        const min = project(bounds.min), max = project(bounds.max);
        const area: MapNode = {
            id: `bounds-${entity.id}`, type: 'saveCoreBounds', position: min, origin: [0, 0],
            width: max.x - min.x, height: max.y - min.y, zIndex: -1,
            measured: { width: max.x - min.x, height: max.y - min.y },
            selectable: false, draggable: false, connectable: false, focusable: false,
            // React Flow enables wrapper pointer events for onNodeClick; bounds must remain transparent to input.
            style: { pointerEvents: 'none' },
            data,
        };
        return [area, marker];
    }), [map, entityName, selectMarker, heightRanks, showPowerNetworks, powerStyles, ports,
        display.showNames, display.showResources]);
    const [projectNodes] = useState(createMapNodeProjector);
    const nodes = useMemo(() => projectNodes(baseNodes, ghosts, selected?.id, selected?.connectedBuildingId, selectedCoreId, showBuildings, showBounds),
        [projectNodes, baseNodes, ghosts, selected?.id, selected?.connectedBuildingId, selectedCoreId, showBuildings, showBounds]);
    const baseEdges = useMemo<CargoEdge[]>(() => map.links.map(link => {
        return { id: `cargo-${link.source}`, source: String(link.source), target: String(link.target), type: 'saveCargo',
            ...cargoHandles(byId.get(link.source)!.position, byId.get(link.target)!.position),
            data: { highlighted: false, dimmed: false, animate: true },
            label: link.item?.name ?? t('Item unavailable'),
            labelStyle: { fill: 'var(--save-map-text)', fontSize: 12 }, labelBgStyle: { fill: 'var(--save-map-panel)' },
            labelBgPadding: [8, 5] as [number, number], labelBgBorderRadius: 5,
        };
    }), [map, byId, t]);
    const baseCoreEdges = useMemo<CargoEdge[]>(() => map.coreLinks.map(link => {
        const source = byId.get(link.source)!.position, target = byId.get(link.target)!.position;
        return { id: `core-cargo-${link.source}-${link.target}`, source: String(link.source), target: String(link.target), type: 'saveCargo',
            ...cargoHandles(source, target),
            data: { highlighted: false, dimmed: false, animate: true,
                coreRoute: { source: project(source), target: project(target), bidirectional: link.bidirectional } },
            label: link.items.map(item => item?.name ?? t('Item unavailable')).join(' · '),
            labelStyle: { fill: 'var(--save-map-text)' }, labelBgStyle: { fill: 'var(--save-map-panel)' },
        };
    }), [map, byId, t]);
    const [projectEdges] = useState(createCargoEdgeProjector);
    const edges = useMemo(() => projectEdges(showBuildings ? baseEdges : baseCoreEdges, ghosts,
        showBuildings ? selected?.id : selectedCoreId, showLinks, display.animateCargo),
    [projectEdges, baseEdges, baseCoreEdges, ghosts, selected?.id, selectedCoreId, showLinks, showBuildings, display.animateCargo]);
    const fitNodes = useMemo(() => baseNodes.filter(node => showBounds || node.type !== 'saveCoreBounds'), [baseNodes, showBounds]);
    const focusCore = useCallback((id: string) => {
        setFocusedCore(id);
        if (id === '') resetLevels();
        void fitView({ ...fitOptions, duration: motionDuration(), nodes: id === '' ? fitNodes : fitNodes.filter(node => node.data.entity.core.core.id === Number(id)) });
    }, [setFocusedCore, resetLevels, fitView, fitNodes]);
    const initialFit = useMemo(() => ({ ...fitOptions, ...(initialCoreId === null ? {} : {
        nodes: fitNodes.filter(node => node.data.entity.core.core.id === initialCoreId).map(node => ({ id: node.id })),
    }) }), [fitNodes, initialCoreId]);
    const onNodeClick = useCallback<NodeMouseHandler<MapNode>>((_event, node) => {
        if (node.type === 'saveBuilding' && !node.data.ghost) selectMarker(node.data.entity.id);
    }, [selectMarker]);
    const closeInspector = useCallback(() => selectEntity(null), [selectEntity]);
    const onEdgeClick = useCallback<EdgeMouseHandler<CargoEdge>>((_event, edge) => selectMarker(Number(edge.source)), [selectMarker]);
    const onFitView = useCallback(() => { setFocusedCore(''); resetLevels(); }, [setFocusedCore, resetLevels]);
    const fitDuration = motionDuration();
    const controlFitOptions = useMemo(() => ({ ...fitOptions, duration: fitDuration }), [fitDuration]);

    return <section aria-label={t('Snapshot map')} className="save-map" onKeyDown={event => {
        if (event.key === 'Escape') selectEntity(null);
    }}>
        <div className="save-map-toolbar">
            <label className="save-map-focus"><span className="sr-only">{t('Focus Core')}</span><SaveMapIcon name="focus" />
                <select className="select select-bordered select-sm" value={scopeId === null ? '' : String(scopeId)} onChange={event => focusCore(event.target.value)}>
                    <option value="">{t('All Cores')}</option>
                    {cores.map(entity => <option key={entity.id} value={entity.id}>{coreName(entity)}</option>)}
                </select>
            </label>
            <SaveMapSearch entities={map.entities} entityName={entityName} coreName={coreName} onSelect={focusEntity} />
        </div>
        {showBounds && cores.some(entity => !entity.core.core.bounds) && <p className="save-map-notice">
            {t('Some Core bounds are unavailable. Try re-importing the save.')}
        </p>}
        <div className="save-map-content">
            <div className={`save-map-canvas${moving ? ' is-moving' : ''}`}>
                <SaveMapCoreLabels peers={corePositions}>
                    <ReactFlow<MapNode, CargoEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodeOrigin={nodeOrigin}
                        colorMode={theme} attributionPosition="bottom-left" ariaLabelConfig={flowLabels} defaultViewport={viewport ?? undefined}
                        onMoveStart={onMoveStart} onMoveEnd={onMoveEnd}
                        fitView={viewport === null} fitViewOptions={initialFit} minZoom={0.005} maxZoom={3}
                        nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false}
                        elementsSelectable={false} deleteKeyCode={null} onlyRenderVisibleElements
                        onNodeClick={onNodeClick} onPaneClick={closeInspector} onEdgeClick={onEdgeClick}>
                        {display.showGrid && <MapGrid />}
                        <Controls position="bottom-left" showInteractive={false} fitViewOptions={controlFitOptions}
                            onZoomIn={onZoom} onZoomOut={onZoom} onFitView={onFitView} />
                    </ReactFlow>
                </SaveMapCoreLabels>
                {showBuildingDetail && scopeId !== null && <SaveMapLevels level={currentLevel} count={levelCount} coreName={coreName(byId.get(scopeId)!)}
                    onChange={level => { selectEntity(null); setLevelLimit(scopeId, level); }} />}
                <SaveMapSettings value={display} onChange={setDisplay} layers={layers} onLayersChange={setLayers} />
            </div>
            {selected && <aside className="save-map-inspector">
                {hasBuildingLayers &&
                    <SaveMapBuildingLayers stack={selectedStack} level={selected.level!} onSelect={selectMarker} onClose={closeInspector} />}
                <SaveMapDetails entity={selected} coreName={coreName(selected)}
                    connected={selected.connectedBuildingId === null ? undefined : byId.get(selected.connectedBuildingId)}
                    onClose={hasBuildingLayers ? undefined : closeInspector} onSelect={focusEntity} onFocusCore={id => focusCore(String(id))} onOpenCore={onOpenCore} />
            </aside>}
        </div>
    </section>;
}

export function SaveMap({ workspace, initialCoreId, onOpenCore }: {
    workspace: SaveWorkspace; initialCoreId: number | null; onOpenCore: (id: number) => void;
}) {
    const map = useSubscription([appIds.subscriptions.SAVES_MAP, workspace.id]);
    if (!map || !map.entities.length) return null;
    return <ReactFlowProvider><SaveMapCanvas map={map} workspace={workspace} initialCoreId={initialCoreId} onOpenCore={onOpenCore} /></ReactFlowProvider>;
}
