import React, { useEffect, useMemo } from 'react';
import {
    ReactFlow,
    type Node,
    type Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    useReactFlow,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import type { Item, Corporation, Building as DbBuilding } from '../../../state/db';
import type { Building, ProductionFlowResult } from '../../planner/core/types';
import { buildProductionFlow } from '../../planner/core/productionFlowBuilder';
import { generateReactFlowData } from '../../planner/visualization/plannerFlowUtils';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

interface EmbeddedFlowDiagramInnerProps {
    selectedItemId: string;
    targetAmount: number;
    interactive?: boolean;
    /** Whether to include the Orbital Cargo Launcher in the diagram (default: true) */
    includeLauncher?: boolean;
}

/**
 * Inner component that uses useReactFlow hook
 */
const EmbeddedFlowDiagramInner: React.FC<EmbeddedFlowDiagramInnerProps> = ({
    selectedItemId,
    targetAmount,
    interactive = true,
    includeLauncher = false
}) => {
    const { fitView } = useReactFlow();

    // State subscriptions for data needed to build flow
    const theme = useSubscription<'light' | 'dark'>([SUB_IDS.THEME]);
    const buildings = useSubscription<DbBuilding[]>([SUB_IDS.BUILDINGS]);
    const corporations = useSubscription<Corporation[]>([SUB_IDS.CORPORATIONS]);
    const items = useSubscription<Item[]>([SUB_IDS.ITEMS]);

    // Calculate production flow
    const productionFlow = useMemo((): ProductionFlowResult => {
        if (!selectedItemId || !buildings || buildings.length === 0) {
            return { nodes: [], edges: [] };
        }
        
        const validAmount = targetAmount > 0 ? targetAmount : 1;
        // Cast DbBuilding[] to Building[] - the planner types expect non-optional heat
        return buildProductionFlow(
            { targetItemId: selectedItemId, targetAmount: validAmount },
            buildings as Building[],
            corporations,
            includeLauncher
        );
    }, [selectedItemId, targetAmount, buildings, corporations, includeLauncher]);

    // Generate React Flow data
    const reactFlowData = useMemo((): { nodes: Node[]; edges: Edge[] } => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return { nodes: [], edges: [] };
        }

        return generateReactFlowData({
            flowNodes: productionFlow.nodes,
            flowEdges: productionFlow.edges,
            items
        });
    }, [productionFlow, items]);

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Update React Flow nodes and edges when data changes
    useEffect(() => {
        if (reactFlowData) {
            setNodes(reactFlowData.nodes);
            setEdges(reactFlowData.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [reactFlowData, setNodes, setEdges]);

    // Auto-fit view when item or target changes
    useEffect(() => {
        // Small delay to ensure DOM is updated
        setTimeout(() => { 
            if (nodes.length > 0) { 
                fitView({ duration: 300, padding: 0.1 }); 
            } 
        }, 10);
    }, [selectedItemId, targetAmount, nodes.length, fitView]);

    return (
        <div className={`w-full h-full min-h-[300px] ${!interactive ? 'pointer-events-none' : ''}`}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                colorMode={theme}
                onNodesChange={interactive ? onNodesChange : undefined}
                onEdgesChange={interactive ? onEdgesChange : undefined}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                attributionPosition="bottom-left"
                fitView
                panOnDrag={interactive}
                zoomOnScroll={interactive}
                zoomOnPinch={interactive}
                zoomOnDoubleClick={interactive}
                nodesDraggable={interactive}
                nodesConnectable={false}
                elementsSelectable={interactive}
            >
                <Background />
                {interactive && <Controls showInteractive={false} />}
            </ReactFlow>
        </div>
    );
};

interface EmbeddedFlowDiagramProps {
    selectedItemId: string;
    targetAmount: number;
    className?: string;
    interactive?: boolean;
    /** Whether to include the Orbital Cargo Launcher in the diagram (default: true) */
    includeLauncher?: boolean;
}

/**
 * Embedded flow diagram component for production plan sections
 * Takes selectedItemId and targetAmount as props instead of reading from global state
 */
export const EmbeddedFlowDiagram: React.FC<EmbeddedFlowDiagramProps> = ({
    selectedItemId,
    targetAmount,
    className = '',
    interactive = true,
    includeLauncher = false
}) => {
    return (
        <div className={`${className}`}>
            <ReactFlowProvider>
                <EmbeddedFlowDiagramInner
                    selectedItemId={selectedItemId}
                    targetAmount={targetAmount}
                    interactive={interactive}
                    includeLauncher={includeLauncher}
                />
            </ReactFlowProvider>
        </div>
    );
};
