import React, { useCallback, useEffect } from 'react';
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
import { SUB_IDS } from '../../state/sub-ids';
import type { Item, Building } from './types';
import type { Corporation, Level } from '../../state/db';
import { generateReactFlowData } from './plannerFlowUtils';
import { usePlannerColors } from './hooks';

interface PlannerFlowDiagramProps {
    selectedItemId: string;
    targetAmount: number;
}

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

/**
 * Flow diagram component for the production planner
 * Handles the React Flow visualization with automatic layout
 */
export const PlannerFlowDiagram: React.FC<PlannerFlowDiagramProps> = ({
    selectedItemId,
    targetAmount
}) => {
    const { fitView } = useReactFlow();
    
    // State subscriptions
    const theme = useSubscription<'light' | 'dark'>([SUB_IDS.THEME]);
    const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);
    const items = useSubscription<Item[]>([SUB_IDS.ITEMS]);
    const corporations = useSubscription<Corporation[]>([SUB_IDS.CORPORATIONS]);
    const levels = useSubscription<Level[]>([SUB_IDS.LEVELS]);
    
    // Color system
    const { getItemColor, getBuildingColor } = usePlannerColors();
    
    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Generate flow data when inputs change
    const updateFlowData = useCallback(() => {
        if (selectedItemId) {
            const { nodes: newNodes, edges: newEdges } = generateReactFlowData({
                targetItemId: selectedItemId,
                targetAmount,
                buildings,
                corporations,
                levels,
                items,
                getItemColor,
                getBuildingColor
            });
            
            setNodes(newNodes);
            setEdges(newEdges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [
        selectedItemId,
        targetAmount,
        buildings,
        corporations,
        levels,
        items,
        getItemColor,
        getBuildingColor,
        setNodes,
        setEdges
    ]);

    // Update flow data when dependencies change
    useEffect(() => {
        updateFlowData();
    }, [updateFlowData]);

    // Auto-fit view when nodes change
    useEffect(() => {
        if (nodes.length > 0) {
            // Small delay to ensure DOM is updated
            setTimeout(() => {
                fitView({ duration: 300, padding: 0.1 });
            }, 10);
        }
    }, [nodes, fitView]);

    if (!selectedItemId) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="text-6xl mb-4">🏭</div>
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
