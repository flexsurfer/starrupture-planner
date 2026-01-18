import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position as ReactFlowPosition } from '@xyflow/react';

import type { Item, Building, ProductionNode, OrbitalCargoLauncherNode } from './types';
import type { Corporation, Level } from '../../state/db';
import { buildProductionFlow, getItemName } from './productionFlowBuilder';
import { ItemImage, BuildingImage } from '../ui';

export interface FlowDataGenerationParams {
    targetItemId: string;
    targetAmount: number;
    buildings: Building[];
    corporations: Corporation[];
    levels: Level[];
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
 * 1. Builds the production flow using the separate flow builder
 * 2. Creates a Dagre graph for automatic layout
 * 3. Converts flow nodes to React Flow nodes with custom styling
 * 4. Converts flow edges to React Flow edges with labels
 * 5. Applies the calculated positions to all nodes
 */
export const generateReactFlowData = ({
    targetItemId,
    targetAmount,
    buildings,
    corporations,
    levels,
    items,
    getItemColor,
    getBuildingColor
}: FlowDataGenerationParams): FlowData => {
    // Use fallback of 1 if amount is 0 or invalid (for temporary empty input state)
    const validAmount = targetAmount > 0 ? targetAmount : 1;

    // Build the production flow using our separate module
    const { nodes: flowNodes, edges: flowEdges } = buildProductionFlow({
        targetItemId,
        targetAmount: validAmount
    }, buildings, corporations, levels);

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

    // Calculate total power consumption across all nodes
    const totalPowerConsumption = flowNodes.reduce((sum, node) => sum + node.totalPower, 0);

    // Convert flow nodes to React Flow nodes with positioning and styling
    const reactFlowNodes: Node[] = flowNodes.map((node, index) => {
        const nodeWithPosition = dagreGraph.node(`node_${index}`);

        // Helper function to check if node is Orbital Cargo Launcher
        const isOrbitalCargoLauncher = (n: ProductionNode): n is OrbitalCargoLauncherNode => {
            return n.buildingId === 'orbital_cargo_launcher';
        };

        const isLauncher = isOrbitalCargoLauncher(node);

        return {
            id: `node_${index}`,
            type: 'default',
            position: { x: nodeWithPosition.x - 100, y: nodeWithPosition.y - 60 },
            data: {
                label: isLauncher ? (
                    // Special rendering for Orbital Cargo Launcher
                    <div className="text-center p-2">
                        <div className="text-xs font-semibold mb-1">
                            x{node.buildingCount.toFixed(2)}
                        </div>
                        <div className="text-xs font-semibold mb-2  absolute top-[-10px] right-[-10px] bg-base-100">
                            <div className="badge badge-sm badge-outline badge-primary">
                                ⚡ {node.totalPower}
                            </div>
                        </div>
                        {/* Launcher icon - using a rocket emoji since no image yet */}
                        <div
                            className="w-20 h-20 mx-auto mb-2 rounded-full flex items-center justify-center text-3xl bg-yellow-500"
                        >
                            <BuildingImage
                                buildingId={"launcher"}
                                className="w-19 h-19 rounded-full object-cover"
                                size="medium"
                            />
                        </div>
                        {/* Launcher information */}
                        <div className="text-xs font-semibold mb-1">
                            {node.buildingName}
                        </div>
                        <div className="text-xs text-orange-500 mb-2">
                            {node.outputAmount} items/min
                        </div>
                        {/* Item and reward info */}
                        <div className="flex items-center gap-2 justify-center mb-2">
                            <div className="relative flex-shrink-0">
                                <ItemImage
                                    itemId={node.outputItem}
                                    className="border-1 shadow-sm"
                                    style={{ borderColor: getItemColor(node.outputItem) }}
                                    size="small"
                                />
                            </div>
                            <div className="text-left">
                                <div className="text-xs opacity-75 leading-tight">
                                    {getItemName(node.outputItem, items)}
                                </div>
                                <div className="text-xs leading-tight text-orange-500">
                                    {node.pointsPerItem} pts/item
                                </div>
                            </div>
                        </div>
                        {/* Launch time and level cost */}
                        <div className="text-xs space-y-1">
                            <div className="text-green-500 font-semibold">
                                Level Cost: {node.totalPoints} pts
                            </div>
                            <div className="text-yellow-500 font-semibold">
                                Total Launch Time: {(node.launchTime).toFixed(1)} min
                            </div>
                            <div className="text-blue-500 font-semibold border-t border-base-300 pt-1 mt-2">
                                Total ⚡: {Math.ceil(totalPowerConsumption)}
                            </div>
                        </div>
                    </div>
                ) : (
                    // Standard rendering for production buildings
                    <div className="text-center p-2">
                        <div className="text-xs font-semibold mb-1">
                            x{node.buildingCount.toFixed(2)}
                        </div>
                        {/* Building icon */}
                        <div
                            className="w-20 h-20 mx-auto mb-2 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: getBuildingColor(node.buildingId) }}
                        >
                            <BuildingImage
                                buildingId={node.buildingId}
                                className="w-19 h-19 rounded-full object-cover"
                                size="medium"
                            />
                        </div>
                        {/* Building information */}
                        <div className="text-xs font-semibold mb-1">
                            {node.buildingName}
                        </div>
                        <div className="text-xs font-semibold mb-2  absolute top-[-10px] right-[-10px] bg-base-100">
                            <div className="badge badge-sm badge-outline badge-primary">
                                ⚡ {node.totalPower}
                            </div>
                        </div>
                        {/* Item image and info inline */}
                        <div className="flex items-center gap-2 justify-center">
                            <div className="relative flex-shrink-0">
                                <ItemImage
                                    itemId={node.outputItem}
                                    className="border-1 shadow-sm"
                                    style={{ borderColor: getItemColor(node.outputItem) }}
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

            const reactFlowEdge = {
                id: edgeId,
                source: fromNodeId,
                target: toNodeId,
                type: 'default',
                style: { stroke: getItemColor(edge.itemId), strokeWidth: 2 },
                label: `${getItemName(edge.itemId, items)} (${edge.amount.toFixed(1)}/min)`,
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
