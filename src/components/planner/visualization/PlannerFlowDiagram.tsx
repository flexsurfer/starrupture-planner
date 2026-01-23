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
import type { Item, Building, FlowNode, FlowEdge } from '../core/types';
import type { Corporation } from '../../../state/db';
import { generateReactFlowData } from './plannerFlowUtils';
import { buildProductionFlow } from '../core/productionFlowBuilder';
import { usePlannerColors } from '../hooks';

interface PlannerFlowDiagramProps {
    selectedItemId: string;
    targetAmount: number;
    onFlowDataChange?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

/**
 * Flow diagram component for the production planner
 * Handles the React Flow visualization with automatic layout
 */
export const PlannerFlowDiagram: React.FC<PlannerFlowDiagramProps> = ({ selectedItemId, targetAmount, onFlowDataChange }) => {
    const { fitView } = useReactFlow();

    // State subscriptions
    const theme = useSubscription<'light' | 'dark'>([SUB_IDS.THEME]);
    const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);
    const items = useSubscription<Item[]>([SUB_IDS.ITEMS]);
    const corporations = useSubscription<Corporation[]>([SUB_IDS.CORPORATIONS]);

    // Color system
    const { getItemColor, getBuildingColor } = usePlannerColors();

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Generate flow data when inputs change
    useEffect(() => {
        if (selectedItemId) {
            const validAmount = targetAmount > 0 ? targetAmount : 1;

            // Build the raw production flow (used for stats and diagram)
            const { nodes: flowNodes, edges: flowEdges } = buildProductionFlow({ targetItemId: selectedItemId, targetAmount: validAmount }, buildings, corporations);

            // Expose raw flow data to parent component for stats calculations
            if (onFlowDataChange) {
                onFlowDataChange(flowNodes, flowEdges);
            }

            // Generate React Flow formatted data for visualization
            const { nodes: newNodes, edges: newEdges } = generateReactFlowData({ flowNodes, flowEdges, items, getItemColor, getBuildingColor });

            setNodes(newNodes);
            setEdges(newEdges);
        } else {
            setNodes([]);
            setEdges([]);
            if (onFlowDataChange) {
                onFlowDataChange([], []);
            }
        }
    }, [selectedItemId, targetAmount, buildings, corporations, items, onFlowDataChange]);

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
