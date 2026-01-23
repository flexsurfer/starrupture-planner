import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position as ReactFlowPosition } from '@xyflow/react';

import type { Item, FlowNode, FlowEdge } from '../core/types';
import { getItemName } from '../core/productionFlowBuilder';
import { NodeCard } from './NodeCard';

export interface FlowDataGenerationParams {
    flowNodes: FlowNode[];
    flowEdges: FlowEdge[];
    items: Item[];
}

export interface FlowData {
    nodes: Node[];
    edges: Edge[];
}

/**
 * Converts the flow builder output to React Flow format and applies layout
 *
 * This function:
 * 1. Creates a Dagre graph for automatic layout
 * 2. Converts flow nodes to React Flow nodes with custom styling
 * 3. Converts flow edges to React Flow edges with labels
 * 4. Applies the calculated positions to all nodes
 */
export const generateReactFlowData = ({ flowNodes, flowEdges, items }: FlowDataGenerationParams): FlowData => {
    // Color function for items (pure function based on items)
    const getItemColor = (itemId: string): string => {
        const item = items.find(i => i.id === itemId);
        if (!item) return '#6b7280'; // neutral gray

        const colorMap = {
            raw: '#3b82f6',      // blue (primary)
            processed: '#8b5cf6', // purple (secondary)
            component: '#06d6a0', // teal (accent)
            ammo: '#f59e0b',     // amber (warning)
            final: '#10b981',    // green (success)
        };

        return colorMap[item.type as keyof typeof colorMap] || '#6b7280';
    };

    // Create Dagre graph for automatic layout
    // Dagre arranges nodes in a hierarchical layout (left-to-right)
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 100 });

    // Add all nodes to the layout graph
    flowNodes.forEach((_, index) => {
        dagreGraph.setNode(`node_${index}`, { width: 200, height: 120 });
    });

    // Create a mapping from internal node IDs to React Flow node IDs
    const nodeIdMap = new Map<string, string>();
    flowNodes.forEach((node, index) => {
        const nodeKey = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
        nodeIdMap.set(nodeKey, `node_${index}`);
    });

    // Add edges to define the layout relationships
    flowEdges.forEach((edge) => {
        const fromNodeId = nodeIdMap.get(edge.from);
        const toNodeId = nodeIdMap.get(edge.to);
        if (fromNodeId && toNodeId) {
            dagreGraph.setEdge(fromNodeId, toNodeId);
        }
    });

    // Calculate positions using Dagre
    dagre.layout(dagreGraph);

    // Helper functions for node type checking

    // Convert flow nodes to React Flow nodes with positioning and styling
    const reactFlowNodes: Node[] = flowNodes.map((node, index) => {
        const nodeWithPosition = dagreGraph.node(`node_${index}`);

        return {
            id: `node_${index}`,
            type: 'default',
            position: { x: nodeWithPosition.x - 100, y: nodeWithPosition.y - 60 },
            data: {
                label: (
                    <NodeCard
                        node={node}
                        items={items}
                        getItemColor={getItemColor}
                    />
                ),
            },
            sourcePosition: ReactFlowPosition.Right,
            targetPosition: ReactFlowPosition.Left,
        };
    });

    // Convert flow edges to React Flow edges with labels
    const reactFlowEdges: Edge[] = [];
    const edgeIdSet = new Set<string>();

    flowEdges.forEach((edge) => {
        const fromNodeId = nodeIdMap.get(edge.from);
        const toNodeId = nodeIdMap.get(edge.to);

        if (fromNodeId && toNodeId) {
            const edgeId = `${fromNodeId}-${toNodeId}-${edge.itemId}`;

            // Safety check: prevent duplicate React Flow edges
            if (edgeIdSet.has(edgeId)) {
                return;
            }
            edgeIdSet.add(edgeId);

            const label = `${getItemName(edge.itemId, items)} (${edge.amount.toFixed(1)}/min)`;

            const reactFlowEdge = {
                id: edgeId,
                source: fromNodeId,
                target: toNodeId,
                type: 'default',
                style: { stroke: getItemColor(edge.itemId), strokeWidth: 2 },
                label: label,
                labelStyle: { fontSize: 12, fontWeight: 'bold', color: getItemColor(edge.itemId) },
            };
            reactFlowEdges.push(reactFlowEdge);
        }
    });

    return {
        nodes: reactFlowNodes,
        edges: reactFlowEdges
    };
};
