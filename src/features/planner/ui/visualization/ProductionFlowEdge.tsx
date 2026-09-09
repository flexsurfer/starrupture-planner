import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';

/** Keep line contrast independent from the readable, two-line material label. */
export function ProductionFlowEdge(props: EdgeProps) {
    const [path, centerX, centerY] = getBezierPath(props);
    const itemName = String(props.data?.itemName ?? '');
    const rate = String(props.data?.rateLabel ?? '');

    return <>
        <BaseEdge id={props.id} path={path} style={props.style}
            markerStart={props.markerStart} markerEnd={props.markerEnd}
            interactionWidth={props.interactionWidth} />
        <EdgeLabelRenderer>
            <div
                className="pointer-events-none absolute rounded px-1.5 py-1 text-center font-normal text-base-content/60"
                style={{
                    transform: `translate(-50%, -50%) translate(${centerX}px, ${centerY}px)`,
                    maxWidth: 160,
                    background: 'color-mix(in oklab, var(--color-base-100) 94%, transparent)',
                    opacity: props.labelStyle?.opacity ?? 1,
                    outline: props.labelStyle?.outline,
                    zIndex: props.labelStyle?.zIndex,
                }}
            >
                <div className="text-sm leading-4">{itemName}</div>
                <div className="text-lg leading-6 tabular-nums">{rate}</div>
            </div>
        </EdgeLabelRenderer>
    </>;
}
