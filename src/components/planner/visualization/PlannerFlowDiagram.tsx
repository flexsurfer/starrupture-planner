import { appIds } from '@/app/uklad/catalog';
import React, { useEffect, useMemo } from 'react';
import {
    ReactFlow,
    type Node,
    type Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useSubscription } from '@/app/uklad/bindings';
import { NodeCard } from './NodeCard';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

/**
 * Flow diagram component for the production planner
 * Handles the React Flow visualization with automatic layout
 */
export const PlannerFlowDiagram: React.FC = () => {
    const { fitView } = useReactFlow();

    // State subscriptions
    const selectedItemId = useSubscription([appIds.subscriptions.PLANNER_SELECTED_ITEM_ID]);
    const theme = useSubscription([appIds.subscriptions.UI_THEME]);
    const flowGraph = useSubscription([appIds.subscriptions.PLANNER_FLOW_GRAPH]);
    const renderedNodes = useMemo<Node[]>(() => flowGraph.nodes.map(({ flowNode, outputColor, ...node }) => ({
        ...node,
        data: {
            label: <NodeCard node={flowNode} items={flowGraph.items!} outputColor={outputColor} />,
        },
    })), [flowGraph]);

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Update React Flow nodes and edges when subscription data changes
    useEffect(() => {
        if (flowGraph) {
            setNodes(renderedNodes);
            setEdges(flowGraph.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [flowGraph, renderedNodes, setNodes, setEdges]);

    // Auto-fit view when item changes
    useEffect(() => {
        // Small delay to ensure DOM is updated
        setTimeout(() => { if (nodes.length > 0) { fitView({ duration: 300, padding: 0.1 }); } }, 10);
    }, [selectedItemId, nodes.length, fitView]);

    if (!selectedItemId) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="text-6xl mb-4">📐</div>
                    <h2 className="text-xl font-semibold text-base-content/80">
                        Select an item to view its production flow
                    </h2>
                    <p className="text-base-content/60 mt-2">
                        Choose any processed item, component, or ammo to see the required buildings and resource flow.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                colorMode={theme}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                attributionPosition="bottom-left"
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};
