import type { Node, Edge } from '@xyflow/react';
import type { Item, FlowNode, FlowEdge } from '@/features/planner/types';
import { buildPlannerFlowGraph, type PlannerFlowDirection } from '@/features/planner/flow-graph';
import { NodeCard } from './NodeCard';

export interface FlowDataGenerationParams {
    flowNodes: FlowNode[];
    flowEdges: FlowEdge[];
    items: Item[];
    onSelectRecipe?: (itemId: string, recipeKey: string) => void;
    direction?: PlannerFlowDirection;
    targetItemId?: string;
}

export interface FlowData {
    nodes: Node[];
    edges: Edge[];
}

/** Render embedded diagrams with the planner's default layout and edge styles. */
export const generateReactFlowData = ({ flowNodes, flowEdges, items, onSelectRecipe, direction = 'LR', targetItemId }: FlowDataGenerationParams): FlowData => {
    const graph = buildPlannerFlowGraph(flowNodes, flowEdges, items, [], direction);
    return {
        nodes: graph.nodes.map(({ flowNode, outputColor, ...node }) => ({
            ...node,
            style: {
                ...node.style,
                padding: 0,
                ...(flowNode.nodeType !== 'launcher' && flowNode.outputItem === targetItemId && {
                    borderColor: 'var(--color-primary)',
                }),
            },
            data: {
                label: <NodeCard node={flowNode} items={items} onSelectRecipe={onSelectRecipe} outputColor={outputColor} />,
            },
        })),
        edges: graph.edges,
    };
};
