import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position as ReactFlowPosition } from '@xyflow/react';

import type { Item, FlowNode, FlowEdge } from '../core/types';
import { getItemName } from '../core/productionFlowBuilder';
import { ItemImage, BuildingImage } from '../../ui';

export interface FlowDataGenerationParams {
    flowNodes: FlowNode[];
    flowEdges: FlowEdge[];
    items: Item[];
    getItemColor: (itemId: string) => string;
    getBuildingColor: (buildingId: string) => string;
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
export const generateReactFlowData = ({
    flowNodes,
    flowEdges,
    items,
    getItemColor
}: FlowDataGenerationParams): FlowData => {

    // Create Dagre graph for automatic layout
    // Dagre arranges nodes in a hierarchical layout (left-to-right)
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 100 });

    // Add all nodes to the layout graph
    flowNodes.forEach((_, index) => {
        dagreGraph.setNode(`node_${index}`, { width: 200, height: 120 });
    });

    // Add edges to define the layout relationships
    flowEdges.forEach((edge) => {
        const fromIndex = flowNodes.findIndex(node => {
            const nodeId = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
            return nodeId === edge.from;
        });
        const toIndex = flowNodes.findIndex(node => {
            const nodeId = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
            return nodeId === edge.to;
        });

        if (fromIndex !== -1 && toIndex !== -1) {
            dagreGraph.setEdge(`node_${fromIndex}`, `node_${toIndex}`);
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
                    // Standard rendering for production buildings
                    <div className="text-center p-2">

                        {/* Fractional count badge at bottom center */}
                        {Math.ceil(node.buildingCount) > 1 && (
                            <div className="text-xs font-semibold absolute top-[-8px] right-[-8px]">
                                <div className="badge badge-sm badge-secondary">
                                    {Math.ceil(node.buildingCount)}
                                </div>
                            </div>
                        )}

                        {/* Building count badge in center-right (link connection area) */}
                        <div className="absolute top-1/2 right-0 transform -translate-y-1/2 translate-x-1/2 z-50">
                            <div className="badge badge-sm badge-primary">
                                x{node.buildingCount.toFixed(2)}
                            </div>
                        </div>

                        {/* Building information */}
                        <div className="text-xs font-semibold mb-1">
                            {node.buildingName}
                        </div>

                        {/* Building icon */}
                        <div className="flex items-center gap-2 justify-center">
                            <BuildingImage
                                buildingId={node.buildingId}
                                className="w-19 h-19 rounded-full object-cover"
                                size="medium"
                            />
                        </div>

                        {/* Item image and info inline */}
                        <div className="flex items-center gap-2 justify-center">
                            <div className="relative flex-shrink-0">
                                <ItemImage
                                    itemId={node.outputItem}
                                    size="small"
                                />
                            </div>
                            <div className="text-left">
                                <div className="text-xs opacity-75 leading-tight">
                                    {getItemName(node.outputItem, items)}
                                </div>
                                <div className="text-xs leading-tight"
                                    style={{ color: getItemColor(node.outputItem) }}>
                                    {node.outputAmount.toFixed(1)}/min
                                </div>
                            </div>
                        </div>
                        <div className="text-xs font-semibold absolute bottom-1 right-1">
                            ⚡{node.powerPerBuilding}
                            🔥{node.heatPerBuilding}
                        </div>
                    </div>
                ),
            },
            sourcePosition: ReactFlowPosition.Right,
            targetPosition: ReactFlowPosition.Left,
        };
    });

    // Create a mapping from internal node IDs to React Flow node IDs
    const nodeIdMap = new Map<string, string>();
    flowNodes.forEach((node, index) => {
        const nodeKey = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
        nodeIdMap.set(nodeKey, `node_${index}`);
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
