import dagre from 'dagre';
import { Position } from '@xyflow/react';
import type { Edge, Node } from '@xyflow/react';
import type { FlowEdge, FlowNode, Item } from '@/features/planner/types';
import { getItemName } from '@/utils/itemUtils';

export type PlannerFlowGraphNode = Omit<Node, 'data'> & {
    flowNode: FlowNode;
    outputColor: string;
};

export interface PlannerFlowGraph {
    nodes: PlannerFlowGraphNode[];
    edges: Edge[];
    items: Item[];
}

function getItemColor(itemId: string, items: Item[]): string {
    const item = items.find((candidate) => candidate.id === itemId);
    const colors = {
        raw: '#3b82f6',
        processed: '#8b5cf6',
        component: '#06d6a0',
        ammo: '#f59e0b',
        final: '#10b981',
    } as const;
    return item ? (colors[item.type as keyof typeof colors] || '#6b7280') : '#6b7280';
}

/**
 * A pure, view-ready graph. React node labels are deliberately created in the
 * diagram component, so subscriptions do not import presentation components.
 */
export function buildPlannerFlowGraph(flowNodes: FlowNode[], flowEdges: FlowEdge[], items: Item[]): PlannerFlowGraph {
    const graph = new dagre.graphlib.Graph();
    graph.setDefaultEdgeLabel(() => ({}));
    graph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 100 });

    flowNodes.forEach((_, index) => {
        graph.setNode(`node_${index}`, { width: 200, height: 120 });
    });

    const nodeIdByFlowKey = new Map<string, string>();
    flowNodes.forEach((node, index) => {
        const key = node.nodeType === 'input' && node.baseBuildingId
            ? `${node.buildingId}_${node.recipeIndex}_${node.outputItem}_${node.baseBuildingId}`
            : `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
        nodeIdByFlowKey.set(key, `node_${index}`);
    });

    flowEdges.forEach((edge) => {
        const source = nodeIdByFlowKey.get(edge.from);
        const target = nodeIdByFlowKey.get(edge.to);
        if (source && target) graph.setEdge(source, target);
    });

    dagre.layout(graph);

    const nodes: PlannerFlowGraphNode[] = flowNodes.map((flowNode, index) => {
        const position = graph.node(`node_${index}`);
        return {
            id: `node_${index}`,
            type: 'default',
            position: { x: position.x - 100, y: position.y - 60 },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
            flowNode,
            outputColor: getItemColor(flowNode.outputItem, items),
        };
    });

    const edgeIds = new Set<string>();
    const edges: Edge[] = [];
    flowEdges.forEach((edge) => {
        const source = nodeIdByFlowKey.get(edge.from);
        const target = nodeIdByFlowKey.get(edge.to);
        if (!source || !target) return;

        const id = `${source}-${target}-${edge.itemId}`;
        if (edgeIds.has(id)) return;
        edgeIds.add(id);
        const color = getItemColor(edge.itemId, items);
        edges.push({
            id,
            source,
            target,
            type: 'default',
            style: { stroke: color, strokeWidth: 2 },
            label: `${getItemName(edge.itemId, items)} (${edge.amount.toFixed(1)}/min)`,
            labelStyle: { fontSize: 12, fontWeight: 'bold', color },
        });
    });

    return { nodes, edges, items };
}
