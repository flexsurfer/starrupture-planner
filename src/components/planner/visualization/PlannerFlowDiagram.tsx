import React, { useEffect } from 'react';
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

import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';

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
    const selectedItemId = useSubscription<string | null>([SUB_IDS.SELECTED_PLANNER_ITEM]);
    const theme = useSubscription<'light' | 'dark'>([SUB_IDS.THEME]);
    const reactFlowData = useSubscription<{ nodes: Node[]; edges: Edge[] }>([SUB_IDS.PLANNER_REACT_FLOW_DATA]);

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Update React Flow nodes and edges when subscription data changes
    useEffect(() => {
        if (reactFlowData) {
            setNodes(reactFlowData.nodes);
            setEdges(reactFlowData.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [reactFlowData, setNodes, setEdges]);

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
