import { useMemo, type ReactNode } from 'react';
import type { Edge, Node } from '@xyflow/react';
import { useConnectedNodeHighlight } from './useConnectedNodeHighlight';

/** Share pin controls and connection highlighting across all production diagrams. */
export function usePinnableNodeHighlight(nodes: Node[], edges: Edge[], enabled = true) {
    const highlight = useConnectedNodeHighlight(nodes, edges, enabled);
    const { nodes: highlightedNodes, pinnedNodeId, toggleNodePin } = highlight;
    const pinnableNodes = useMemo(() => enabled ? highlightedNodes.map((node) => {
        const isPinned = node.id === pinnedNodeId;
        const pinLabel = isPinned ? 'Unpin node' : 'Pin node to highlight connections';
        return {
            ...node,
            data: {
                ...node.data,
                label: <>
                    {node.data.label as ReactNode}
                    <button
                        type="button"
                        className={`nodrag nopan absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm ${isPinned ? 'border-amber-500 bg-amber-500 text-black' : 'border-base-content/25 bg-base-100 text-base-content/60 hover:text-amber-500'}`}
                        aria-label={pinLabel}
                        aria-pressed={isPinned}
                        title={pinLabel}
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleNodePin(node.id);
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M16 3 21 8 17 9 13 13 13 17 11 19 5 13 7 11 11 11 15 7Z" />
                            <path d="m9 15-6 6" />
                        </svg>
                    </button>
                </>,
            },
        };
    }) : highlightedNodes, [enabled, highlightedNodes, pinnedNodeId, toggleNodePin]);

    return { ...highlight, nodes: pinnableNodes };
}
