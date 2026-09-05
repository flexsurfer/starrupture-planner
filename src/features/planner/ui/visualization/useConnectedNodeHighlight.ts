import { useCallback, useMemo, useState } from 'react';
import type { Edge, Node } from '@xyflow/react';

const HIGHLIGHT_COLOR = '#f59e0b';
const DIMMED_OPACITY = 0.58;

interface ConnectedNodeHighlightResult {
    nodes: Node[];
    edges: Edge[];
    onNodeDragStart: (event: MouseEvent | TouchEvent, node: Node, nodes: Node[]) => void;
    onNodeDragStop: (event: MouseEvent | TouchEvent, node: Node, nodes: Node[]) => void;
}

/**
 * Highlights the node being dragged, its directly connected neighbours, and
 * the edges between them. The highlight is active only for the drag gesture.
 */
export const useConnectedNodeHighlight = (
    nodes: Node[],
    edges: Edge[],
    enabled = true,
): ConnectedNodeHighlightResult => {
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const highlightedNodeId = enabled ? activeNodeId : null;

    const connectedNodeIds = useMemo(() => {
        if (!highlightedNodeId) {
            return null;
        }

        const ids = new Set([highlightedNodeId]);

        edges.forEach((edge) => {
            if (edge.source === highlightedNodeId) {
                ids.add(edge.target);
            } else if (edge.target === highlightedNodeId) {
                ids.add(edge.source);
            }
        });

        return ids;
    }, [edges, highlightedNodeId]);

    const highlightedNodes = useMemo(() => {
        if (!connectedNodeIds) {
            return nodes;
        }

        return nodes.map((node) => {
            const isConnected = connectedNodeIds.has(node.id);
            const isActive = node.id === highlightedNodeId;

            return {
                ...node,
                style: {
                    ...node.style,
                    opacity: isConnected ? 1 : DIMMED_OPACITY,
                    ...(isActive && {
                        boxShadow: `0 0 0 3px ${HIGHLIGHT_COLOR}, 0 0 18px ${HIGHLIGHT_COLOR}`,
                    }),
                },
            };
        });
    }, [connectedNodeIds, highlightedNodeId, nodes]);

    const highlightedEdges = useMemo(() => {
        if (!highlightedNodeId) {
            return edges;
        }

        return edges.map((edge) => {
            const isConnected = edge.source === highlightedNodeId || edge.target === highlightedNodeId;
            const originalStrokeWidth = typeof edge.style?.strokeWidth === 'number'
                ? edge.style.strokeWidth
                : 2;

            return {
                ...edge,
                style: {
                    ...edge.style,
                    opacity: isConnected ? 1 : DIMMED_OPACITY,
                    ...(isConnected && {
                        stroke: HIGHLIGHT_COLOR,
                        strokeWidth: Math.max(originalStrokeWidth + 1, 4),
                    }),
                },
                labelStyle: edge.labelStyle
                    ? {
                        ...edge.labelStyle,
                        opacity: isConnected ? 1 : DIMMED_OPACITY,
                    }
                    : edge.labelStyle,
            };
        });
    }, [edges, highlightedNodeId]);

    const onNodeDragStart = useCallback(
        (_event: MouseEvent | TouchEvent, node: Node) => {
            if (enabled) {
                setActiveNodeId(node.id);
            }
        },
        [enabled],
    );

    const onNodeDragStop = useCallback(
        () => {
            setActiveNodeId(null);
        },
        [],
    );

    return {
        nodes: highlightedNodes,
        edges: highlightedEdges,
        onNodeDragStart,
        onNodeDragStop,
    };
};
