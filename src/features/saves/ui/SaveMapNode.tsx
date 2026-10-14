import { memo, useMemo, type CSSProperties } from 'react';
import { Handle, Position, useStore, type Node, type NodeProps } from '@xyflow/react';
import { BuildingImage } from '@/shared/ui';
import { useTranslation } from '@/shared/i18n';
import type { SaveMapEntity } from '../map';
import { placeCoreLabels, type CoreLabelPeer } from './map-display';
import { SaveMapResourceMarker } from './SaveMapResourceMarker';

export type MapNode = Node<{
    entity: SaveMapEntity;
    name: string;
    selected: boolean;
    related: boolean;
    showNames: boolean;
    showResources: boolean;
    labelPeers?: CoreLabelPeer[];
    powerColor?: string;
    onSelect: (id: number) => void;
}, 'saveBuilding' | 'saveCoreBounds'>;

export const SaveMapCoreBounds = memo(function SaveMapCoreBounds({ data }: NodeProps<MapNode>) {
    return <svg width="100%" height="100%" aria-hidden="true" className="pointer-events-none overflow-visible">
        <rect width="100%" height="100%" fill="var(--save-map-accent)" fillOpacity={data.selected ? 0.055 : 0.02}
            stroke={data.selected ? 'var(--save-map-accent)' : 'var(--save-map-border)'} strokeOpacity={data.selected ? 0.65 : 0.8}
            strokeWidth={data.selected ? 2 : 1} vectorEffect="non-scaling-stroke" />
    </svg>;
});

function powerStyle(color?: string): CSSProperties | undefined {
    return color ? { borderColor: color, backgroundColor: `color-mix(in srgb, ${color} 16%, var(--save-map-panel))` } : undefined;
}

function CoreMarker({ data }: { data: MapNode['data'] }) {
    const { name, selected, powerColor, labelPeers, entity } = data;
    const { t } = useTranslation();
    // Keep just the few Core markers legible at world scale. Building markers stay spatial.
    const zoom = useStore(state => state.transform[2]);
    const scale = Math.max(1, 0.75 / zoom);
    const placements = useMemo(() => placeCoreLabels(labelPeers ?? [], zoom), [labelPeers, zoom]);
    const label = placements.get(entity.id) ?? { x: 0, y: Math.max(36, 48 * zoom) / 2 + 26 };
    return <div className={`save-map-core-marker ${selected ? 'is-selected' : ''}`}
        style={{ ...powerStyle(powerColor), transform: `scale(${scale})` }}>
        <BuildingImage buildingId="base_core" building={{ name }} size="small" />
        <span className="save-map-core-label" style={{ left: `calc(50% + ${label.x / (scale * zoom)}px)`,
            top: `calc(50% + ${label.y / (scale * zoom)}px)`, transform: `translate(-50%, -50%) scale(${Math.max(1, 1 / (scale * zoom))})` }}>
            <span>{name}</span>{zoom < 0.12 && <small>{t('{count} buildings', { count: entity.core.buildings.length })}</small>}
        </span>
    </div>;
}

export const SaveMapNode = memo(function SaveMapNode({ data, width = 72 }: NodeProps<MapNode>) {
    const { entity, name, selected, related, powerColor, showNames, showResources, onSelect } = data;
    const { t } = useTranslation();
    // Only update building detail density at the threshold, not on every zoom or pan frame.
    const showDetail = useStore(state => state.transform[2] >= 0.45);
    const detail = entity.detail;
    const resource = detail?.resources[0];
    const networkId = (detail?.instance ?? entity.core.core).powerNetworkId;
    const networkLabel = powerColor && networkId !== null ? t('Power network {number}', { number: networkId }) : undefined;
    return <>
        {[Position.Top, Position.Right, Position.Bottom, Position.Left].flatMap(position =>
            (['target', 'source'] as const).map(type => <Handle key={`${type}-${position}`} id={`${type}-${position}`}
                type={type} position={position} className="!pointer-events-none !opacity-0" />))}
        <button type="button" className={`nodrag nopan save-map-marker ${detail ? '' : 'is-core'} ${selected ? 'is-selected' : ''} ${related ? 'is-related' : ''}`}
            style={powerColor ? { '--save-map-network-color': powerColor } as CSSProperties : undefined} aria-label={name} aria-pressed={selected}
            title={[name, resource?.name, networkLabel].filter(Boolean).join(' · ')} onClick={() => onSelect(entity.id)}>
            {detail ? <>
                <BuildingImage buildingId={detail.building.id} building={detail.building} size="large" className="save-map-building-image" />
                {resource && showResources && showDetail && <SaveMapResourceMarker key={resource.itemId} resource={resource} markerSize={width} />}
                {showDetail && <span className={`save-map-building-label ${selected || showNames ? 'is-visible' : ''}`}>{name}</span>}
            </> : <CoreMarker data={data} />}
        </button>
    </>;
});
