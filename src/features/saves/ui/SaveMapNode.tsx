import { memo, useContext, type CSSProperties } from 'react';
import { Handle, useStore, type Position, type Node, type NodeProps } from '@xyflow/react';
import { BuildingImage } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { SaveMapEntity } from '../map';
import { CORE_MARKER_SIZE, coreMarkerSize } from '../map-coordinates';
import { CoreLabelsContext } from './core-labels-context';
import { SaveMapResourceMarker } from './SaveMapResourceMarker';
import type { PowerNetworkStyle } from './power-network-style';
import { SaveMapIcon } from './SaveMapIcon';
import { BUILDING_DETAIL_ZOOM } from './map-viewport';
import { SaveCoreSharedBadge } from './SaveCoreSharedBadge';

export type MapNode = Node<{
    entity: SaveMapEntity;
    name: string;
    selected: boolean;
    related: boolean;
    showNames: boolean;
    showResources: boolean;
    ports: { id: string; type: 'source' | 'target'; position: Position }[];
    powerColor?: string;
    powerBorderStyle?: PowerNetworkStyle['borderStyle'];
    hasLayers?: boolean;
    ghost?: boolean;
    onSelect: (id: number) => void;
}, 'saveBuilding' | 'saveCoreBounds'>;

export const SaveMapCoreBounds = memo(function SaveMapCoreBounds({ data }: NodeProps<MapNode>) {
    return <svg width="100%" height="100%" aria-hidden="true" className="pointer-events-none overflow-visible">
        <rect width="100%" height="100%" fill="var(--save-map-accent)" fillOpacity={data.selected ? 0.055 : 0.02}
            stroke={data.selected ? 'var(--save-map-accent)' : 'var(--save-map-border)'} strokeOpacity={data.selected ? 0.65 : 0.8}
            strokeWidth={data.selected ? 2 : 1} vectorEffect="non-scaling-stroke" />
    </svg>;
});

function NetworkBadge({ networkId }: { networkId: number | null }) {
    const { formatNumber } = useTranslation();
    return networkId === null ? null : <span className="save-map-network-badge" aria-hidden="true">#{formatNumber(networkId)}</span>;
}

function CoreMarker({ data }: { data: MapNode['data'] }) {
    const { name, selected, powerColor, entity } = data;
    // Keep Core icons and names compact at every zoom. Building markers stay spatial.
    const { zoom, placements } = useContext(CoreLabelsContext);
    const scale = coreMarkerSize(zoom) / CORE_MARKER_SIZE;
    const placement = placements.get(entity.id);
    const label = placement ?? { x: 0, y: coreMarkerSize(zoom) * zoom / 2 + 11 };
    return <div className={`save-map-core-marker ${selected ? 'is-selected' : ''}`}
        style={{ transform: `scale(${scale})` }}>
        <BuildingImage buildingId="base_core" building={{ name }} size="small" />
        <SaveCoreSharedBadge coreOverview={entity.core} />
        {powerColor && <NetworkBadge networkId={entity.core.core.powerNetworkId} />}
        <span className={`save-map-core-label${placement ? '' : ' is-crowded'}`} style={{ left: `calc(50% + ${label.x / (scale * zoom)}px)`,
            top: `calc(50% + ${label.y / (scale * zoom)}px)`, transform: `translate(-50%, -50%) scale(${1 / (scale * zoom)})` }}>
            {name}
        </span>
    </div>;
}

export const SaveMapNode = memo(function SaveMapNode({ data, width = 72 }: NodeProps<MapNode>) {
    const { entity, name, selected, related, powerColor, powerBorderStyle, showNames, showResources, onSelect } = data;
    const { t, formatNumber } = useTranslation();
    // Only update building detail density at the threshold, not on every zoom or pan frame.
    const showDetail = useStore(state => state.transform[2] >= BUILDING_DETAIL_ZOOM);
    const detail = entity.detail;
    const resource = detail?.resources[0];
    const networkId = (detail?.instance ?? entity.core.core).powerNetworkId;
    const networkLabel = powerColor && networkId !== null ? t('Power network {number}', { number: networkId }) : undefined;
    const layerLabel = data.hasLayers ? t('Level {level} · Buildings above or below', { level: entity.level! }) : undefined;
    const ports = data.ports.map(port => <Handle key={port.id} {...port} className="!pointer-events-none !opacity-0" />);
    // Use the icon's alpha mask so cutaways keep their building shape without image components or badges.
    if (data.ghost) return <>{ports}<div aria-hidden="true" className="save-map-ghost"
        style={{ maskImage: `url("${import.meta.env.BASE_URL}icons/buildings/${detail!.building.id}.webp")` }} /></>;
    return <>
        {ports}
        <button type="button" className={`nodrag nopan save-map-marker ${detail ? '' : 'is-core'} ${selected ? 'is-selected' : ''} ${related ? 'is-related' : ''} ${powerColor ? 'has-power-network' : ''}`}
            style={powerColor ? { '--save-map-network-color': powerColor, '--save-map-network-border-style': powerBorderStyle } as CSSProperties : undefined}
            aria-label={name} aria-description={[networkLabel, layerLabel].filter(Boolean).join(' · ') || undefined} aria-pressed={selected}
            title={[name, resource?.name, networkLabel, layerLabel].filter(Boolean).join(' · ')}
            onClick={event => { event.stopPropagation(); onSelect(entity.id); }}>
            {detail ? <>
                <BuildingImage buildingId={detail.building.id} building={detail.building} size="large" className="save-map-building-image" />
                {layerLabel && showDetail && <span className="save-map-layer-badge" aria-hidden="true"><SaveMapIcon name="layers" />{formatNumber(entity.level!)}</span>}
                {powerColor && showDetail && <NetworkBadge networkId={networkId} />}
                {resource && showResources && showDetail && <SaveMapResourceMarker key={resource.itemId} resource={resource} markerSize={width} />}
                {showDetail && <span className={`save-map-building-label ${selected || showNames ? 'is-visible' : ''}`}>{name}</span>}
            </> : <CoreMarker data={data} />}
        </button>
    </>;
});
