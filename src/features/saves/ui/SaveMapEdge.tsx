import { memo, useId, useMemo, type CSSProperties } from 'react';
import { BaseEdge, getSmoothStepPath, useStore, type Edge, type EdgeProps, type XYPosition } from '@xyflow/react';
import { coreCargoPath } from './map-display';

export type CargoEdge = Edge<{
    highlighted: boolean; dimmed: boolean; animate: boolean;
    coreRoute?: { source: XYPosition; target: XYPosition; bidirectional: boolean };
}, 'saveCargo'>;

export const SaveMapEdge = memo(function SaveMapEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    data, label, labelStyle, labelBgStyle }: EdgeProps<CargoEdge>) {
    // React Flow zooms an HTML ancestor of each SVG; vector-effect alone cannot undo that scale.
    const zoom = useStore(state => state.transform[2]);
    const scale = 1 / zoom;
    const markerId = useId();
    // Camera movement changes screen sizing, not world geometry.
    const buildingPath = useMemo(() => getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
        borderRadius: 24, offset: 32 }), [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition]);
    const coreRoute = data?.coreRoute;
    const corePath = useMemo(() => coreRoute ? coreCargoPath(coreRoute.source, coreRoute.target, zoom, coreRoute.bidirectional) : null,
        [coreRoute, zoom]);
    const geometry = coreRoute ? corePath : buildingPath;
    if (!geometry) return null;
    const [path, labelX, labelY] = geometry;
    const arrowSize = (coreRoute ? 7 : 10) * scale;
    return <g className={`save-map-route ${coreRoute ? 'is-core-route' : ''} ${data?.highlighted ? 'is-highlighted' : ''} ${data?.dimmed ? 'is-dimmed' : ''} ${data?.animate ? 'is-moving' : ''} ${zoom < 0.2 ? 'is-overview' : ''}`}
        style={{ '--save-map-route-scale': scale } as CSSProperties}>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={arrowSize} markerHeight={arrowSize}
            markerUnits="userSpaceOnUse" orient="auto">
            <path d="M2 1 8 5 2 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker></defs>
        <path d={path} className="save-map-route-casing" fill="none" />
        <BaseEdge id={id} path={path} className="save-map-route-line" markerEnd={`url(#${markerId})`} interactionWidth={18 * scale} />
        <path d={path} className="save-map-route-cargo" fill="none" />
        {label && <BaseEdge path={path} style={{ stroke: 'none', pointerEvents: 'none' }} interactionWidth={0}
            label={label} labelX={labelX} labelY={labelY} labelStyle={{ ...labelStyle, fontSize: 12 * scale }} labelBgStyle={labelBgStyle}
            labelBgPadding={[8 * scale, 5 * scale]} labelBgBorderRadius={5 * scale} />}
    </g>;
});
