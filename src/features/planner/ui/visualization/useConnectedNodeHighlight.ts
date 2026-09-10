import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Edge, Node, OnNodeDrag } from '@xyflow/react';

const HIGHLIGHT_COLOR = '#f59e0b';
const DIMMED_OPACITY = 0.35;
const HIGHLIGHT_Z_INDEX = 1000;

interface ConnectedNodeHighlightResult {
    nodes: Node[];
    edges: Edge[];
    pinnedNodeId: string | null;
    toggleNodePin: (nodeId: string) => void;
    resetHighlight: () => void;
    onNodeDragStart: OnNodeDrag;
    onNodeDragStop: OnNodeDrag;
}

/**
 * Highlights the node being dragged, its directly connected neighbours, and
 * the edges between them. Pinning keeps this highlight active between gestures.
 */
export const useConnectedNodeHighlight = (
    nodes: Node[],
    edges: Edge[],
    enabled = true,
): ConnectedNodeHighlightResult => {
    const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
    const [pinnedNodeId, setPinnedNodeId] = useState<string | null>(null);
    const visiblePinnedNodeId = enabled && nodes.some((node) => node.id === pinnedNodeId)
        ? pinnedNodeId : null;
    const highlightedNodeId = enabled ? visiblePinnedNodeId ?? activeNodeId : null;

    useEffect(() => {
        if (pinnedNodeId && !nodes.some(node => node.id === pinnedNodeId)) {
            setPinnedNodeId(null);
        }
    }, [nodes, pinnedNodeId]);

    const toggleNodePin = useCallback((nodeId: string) => {
        setPinnedNodeId((current) => current === nodeId ? null : nodeId);
        setActiveNodeId(null);
    }, []);

    const resetHighlight = useCallback(() => {
        setPinnedNodeId(null);
        setActiveNodeId(null);
    }, []);

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
                draggable: node.id === visiblePinnedNodeId ? false : node.draggable,
                style: {
                    ...node.style,
                    opacity: isConnected ? 1 : DIMMED_OPACITY,
                    ...(isActive && {
                        boxShadow: `0 0 0 3px ${HIGHLIGHT_COLOR}, 0 0 18px ${HIGHLIGHT_COLOR}`,
                    }),
                },
            };
        });
    }, [connectedNodeIds, highlightedNodeId, nodes, visiblePinnedNodeId]);

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
                zIndex: isConnected ? HIGHLIGHT_Z_INDEX : edge.zIndex,
                style: {
                    ...edge.style,
                    opacity: isConnected ? 1 : DIMMED_OPACITY,
                    ...(isConnected && {
                        stroke: HIGHLIGHT_COLOR,
                        strokeWidth: Math.max(originalStrokeWidth + 1, 4),
                    }),
                },
                labelStyle: {
                    ...edge.labelStyle,
                    opacity: isConnected ? 1 : DIMMED_OPACITY,
                    ...(isConnected && {
                        outline: `2px solid ${HIGHLIGHT_COLOR}`,
                        zIndex: HIGHLIGHT_Z_INDEX + 1,
                    }),
                },
            };
        });
    }, [edges, highlightedNodeId]);

    const onNodeDragStart = useCallback<OnNodeDrag>(
        (_event, node) => {
            if (enabled) {
                setActiveNodeId(node.id);
            }
        },
        [enabled],
    );

    const onNodeDragStop = useCallback<OnNodeDrag>(
        () => {
            setActiveNodeId(null);
        },
        [],
    );

    return {
        nodes: highlightedNodes,
        edges: highlightedEdges,
        pinnedNodeId: visiblePinnedNodeId,
        toggleNodePin,
        resetHighlight,
        onNodeDragStart,
        onNodeDragStop,
    };
};
