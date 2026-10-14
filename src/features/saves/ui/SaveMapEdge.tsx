import { memo, useId, type CSSProperties } from 'react';
import { BaseEdge, getSmoothStepPath, useStore, type Edge, type EdgeProps } from '@xyflow/react';

export type CargoEdge = Edge<{ highlighted: boolean; dimmed: boolean; animate: boolean }, 'saveCargo'>;

export const SaveMapEdge = memo(function SaveMapEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    data, label, labelStyle, labelBgStyle }: EdgeProps<CargoEdge>) {
    // React Flow zooms an HTML ancestor of each SVG; vector-effect alone cannot undo that scale.
    const zoom = useStore(state => state.transform[2]);
    const scale = 1 / zoom;
    const markerId = useId();
    const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
        borderRadius: Math.max(24, 6 * scale), offset: 32 });
    return <g className={`save-map-route ${data?.highlighted ? 'is-highlighted' : ''} ${data?.dimmed ? 'is-dimmed' : ''} ${data?.animate ? 'is-moving' : ''} ${zoom < 0.2 ? 'is-overview' : ''}`}
        style={{ '--save-map-route-scale': scale } as CSSProperties}>
        <defs><marker id={markerId} viewBox="0 0 10 10" refX="8" refY="5" markerWidth={10 * scale} markerHeight={10 * scale}
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
