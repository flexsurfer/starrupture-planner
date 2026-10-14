import { useCallback, useMemo, useState } from 'react';
import { Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow, useStore } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { useFlowLabels } from '@/shared/i18n/useFlowLabels';
import type { SaveMap as MapData, SaveMapEntity } from '../map';
import type { SaveWorkspace } from '../types';
import type { SavePosition } from '../snapshot';
import { SaveMapCoreBounds, SaveMapNode, type MapNode } from './SaveMapNode';
import { SaveMapDetails } from './SaveMapDetails';
import { SaveMapIcon } from './SaveMapIcon';
import { SaveMapSearch } from './SaveMapSearch';
import { SaveMapEdge, type CargoEdge } from './SaveMapEdge';
import { SaveMapSettings, type MapLayers } from './SaveMapSettings';
import { cargoHandles, defaultMapDisplay } from './map-display';
import { powerNetworkStyles } from './power-network-style';
import './SaveMap.css';

const nodeTypes = { saveBuilding: SaveMapNode, saveCoreBounds: SaveMapCoreBounds };
const edgeTypes = { saveCargo: SaveMapEdge };
const nodeOrigin: [number, number] = [0.5, 0.5];
// Fixed projection, with no graph layout or relocation of buildings. +Y points down.
const project = (position: SavePosition) => ({ x: position.x / 10, y: position.y / 10 });
const fitOptions = { padding: 0.2, minZoom: 0.005, maxZoom: 1.5 };
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
    const theme = useSubscription([appIds.subscriptions.UI_THEME]);
    const { fitView, setCenter } = useReactFlow<MapNode>();
    const [selection, setSelection] = useState<{ id: number; snapshot: SaveWorkspace['snapshot'] } | null>(null);
    const [layers, setLayers] = useState<MapLayers>({ showLinks: true, showBounds: true, showPowerNetworks: false });
    const { showLinks, showBounds, showPowerNetworks } = layers;
    const [display, setDisplay] = useState(defaultMapDisplay);
    const [focusedCore, setFocusedCore] = useState(initialCoreId === null ? '' : String(initialCoreId));
    const powerStyles = useMemo(() => powerNetworkStyles(map.entities.map(entity =>
        (entity.detail?.instance ?? entity.core.core).powerNetworkId)), [map]);
    const coreName = useCallback((entity: SaveMapEntity) => entity.core.core.name ?? t('Core {number}', { number: entity.coreNumber }), [t]);
    const entityName = useCallback((entity: SaveMapEntity) => entity.detail
        ? entity.detail.instance.name ?? entity.detail.building.name : coreName(entity), [coreName]);
    const byId = useMemo(() => new Map(map.entities.map(entity => [entity.id, entity])), [map]);
    const cores = useMemo(() => map.entities.filter(entity => !entity.detail), [map]);
    const corePositions = useMemo(() => cores.map(core => ({ ...project(core.position), id: core.id, name: coreName(core),
        countLabel: t('{count} buildings', { count: core.core.buildings.length }) })), [cores, coreName, t]);
    // A building ID is local to its snapshot: re-import must not select an unrelated new building.
    const selected = selection?.snapshot === workspace.snapshot ? byId.get(selection.id) : undefined;
    const selectedCoreId = selected?.core.core.id;
    const selectEntity = useCallback((id: number) => setSelection({ id, snapshot: workspace.snapshot }), [workspace.snapshot]);
    const focusEntity = (id: number) => {
        const entity = byId.get(id);
        if (!entity) return;
        selectEntity(id);
        const point = project(entity.position);
        setFocusedCore('');
        void setCenter(point.x, point.y, { zoom: 1.2, duration: motionDuration() });
    };
    const nodes = useMemo<MapNode[]>(() => map.entities.flatMap(entity => {
        const networkId = (entity.detail?.instance ?? entity.core.core).powerNetworkId;
        const powerStyle = showPowerNetworks && networkId !== null ? powerStyles.get(networkId) : undefined;
        const data = { entity, name: entityName(entity), selected: entity.id === selected?.id,
            related: entity.id === selected?.connectedBuildingId, labelPeers: entity.detail ? undefined : corePositions, onSelect: selectEntity,
            showNames: display.showNames, showResources: display.showResources,
            powerColor: powerStyle?.color, powerBorderStyle: powerStyle?.borderStyle };
        const size = entity.detail ? display.buildingSize : 48;
        const marker: MapNode = {
            id: String(entity.id), type: 'saveBuilding', position: project(entity.position), width: size, height: size,
            style: { width: size, height: size },
            zIndex: data.selected ? 4 : entity.detail ? (data.related ? 2 : 0) : 3, data,
        };
        const bounds = !entity.detail && showBounds ? entity.core.core.bounds : null;
        if (!bounds) return [marker];
        const min = project(bounds.min), max = project(bounds.max);
        const area: MapNode = {
            id: `bounds-${entity.id}`, type: 'saveCoreBounds', position: min, origin: [0, 0],
            width: max.x - min.x, height: max.y - min.y, zIndex: -1,
            selectable: false, draggable: false, connectable: false, focusable: false,
            // React Flow enables wrapper pointer events for onNodeClick; bounds must remain transparent to input.
            style: { pointerEvents: 'none' },
            data: { ...data, selected: selectedCoreId === entity.id },
        };
        return [area, marker];
    }), [map, entityName, selectEntity, selected?.id, selected?.connectedBuildingId, selectedCoreId, showBounds, showPowerNetworks, powerStyles, corePositions,
        display.buildingSize, display.showNames, display.showResources]);
    const edges = useMemo<CargoEdge[]>(() => showLinks ? map.links.map(link => {
        const highlighted = selected?.id === link.source || selected?.id === link.target;
        return { id: `cargo-${link.source}`, source: String(link.source), target: String(link.target), type: 'saveCargo',
            ...cargoHandles(byId.get(link.source)!.position, byId.get(link.target)!.position),
            data: { highlighted, dimmed: !highlighted && selected !== undefined, animate: display.animateCargo },
            label: highlighted ? link.item?.name ?? t('Item unavailable') : undefined,
            labelStyle: { fill: 'var(--save-map-text)', fontSize: 12 }, labelBgStyle: { fill: 'var(--save-map-panel)' },
            labelBgPadding: [8, 5] as [number, number], labelBgBorderRadius: 5,
        };
    }) : [], [map, byId, selected, showLinks, display.animateCargo, t]);
    const initialFit = useMemo(() => ({ ...fitOptions, ...(initialCoreId === null ? {} : {
        nodes: nodes.filter(node => node.data.entity.core.core.id === initialCoreId).map(node => ({ id: node.id })),
    }) }), [nodes, initialCoreId]);

    return <section aria-label={t('Snapshot map')} className="save-map" onKeyDown={event => {
        if (event.key === 'Escape') setSelection(null);
    }}>
        <div className="save-map-toolbar">
            <label className="save-map-focus"><span className="sr-only">{t('Focus Core')}</span><SaveMapIcon name="focus" />
                <select className="select select-bordered select-sm" value={focusedCore} onChange={event => {
                    const id = event.target.value;
                    setFocusedCore(id);
                    void fitView({ ...fitOptions, duration: motionDuration(), nodes: id === '' ? nodes : nodes.filter(node => node.data.entity.core.core.id === Number(id)) });
                }}>
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
            <div className="save-map-canvas">
                <ReactFlow<MapNode, CargoEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodeOrigin={nodeOrigin}
                    colorMode={theme} attributionPosition="bottom-left" ariaLabelConfig={flowLabels} fitView fitViewOptions={initialFit} minZoom={0.005} maxZoom={3}
                    nodesDraggable={false} nodesConnectable={false} nodesFocusable={false} edgesFocusable={false}
                    elementsSelectable={false} deleteKeyCode={null} onlyRenderVisibleElements
                    onNodeClick={(_event, node) => { if (node.type === 'saveBuilding') selectEntity(node.data.entity.id); }}
                    onPaneClick={() => setSelection(null)} onEdgeClick={(_event, edge) => selectEntity(Number(edge.source))}>
                    {display.showGrid && <MapGrid />}
                    <Controls position="bottom-left" showInteractive={false} fitViewOptions={{ ...fitOptions, duration: motionDuration() }}
                        onFitView={() => setFocusedCore('')} />
                </ReactFlow>
                <SaveMapSettings value={display} onChange={setDisplay} layers={layers} onLayersChange={setLayers} />
            </div>
            {selected && <aside className="save-map-inspector">
                <SaveMapDetails entity={selected} coreName={coreName(selected)}
                    connected={selected.connectedBuildingId === null ? undefined : byId.get(selected.connectedBuildingId)}
                    onClose={() => setSelection(null)} onSelect={focusEntity} onOpenCore={onOpenCore} />
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
