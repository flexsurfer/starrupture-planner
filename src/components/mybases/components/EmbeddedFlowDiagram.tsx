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
import type { Item } from '../../../state/db';
import type { ProductionFlowResult } from '../../planner/core/types';
import { generateReactFlowData } from '../../planner/visualization/plannerFlowUtils';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

interface EmbeddedFlowDiagramInnerProps {
    /** Pre-computed production flow result from a subscription */
    productionFlow: ProductionFlowResult;
    interactive?: boolean;
}

/**
 * Inner component that uses useReactFlow hook
 */
const EmbeddedFlowDiagramInner: React.FC<EmbeddedFlowDiagramInnerProps> = ({
    productionFlow,
    interactive = true,
}) => {
    const { fitView } = useReactFlow();

    // State subscriptions for rendering
    const theme = useSubscription<'light' | 'dark'>([SUB_IDS.UI_THEME]);
    const items = useSubscription<Item[]>([SUB_IDS.ITEMS_LIST]);

    // Generate React Flow data from pre-computed production flow
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

    // Auto-fit view when production flow changes
    useEffect(() => {
        // Small delay to ensure DOM is updated
        setTimeout(() => { 
            if (nodes.length > 0) { 
                fitView({ duration: 300, padding: 0.1 }); 
            } 
        }, 10);
    }, [productionFlow, nodes.length, fitView]);

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
    /** Pre-computed production flow result from a subscription */
    productionFlow: ProductionFlowResult;
    className?: string;
    interactive?: boolean;
}

/**
 * Embedded flow diagram component for production plan sections.
 * Receives a pre-computed ProductionFlowResult from the state layer (subscription)
 * and handles only the visualization concerns.
 */
export const EmbeddedFlowDiagram: React.FC<EmbeddedFlowDiagramProps> = ({
    productionFlow,
    className = '',
    interactive = true,
}) => {
    return (
        <div className={`${className}`}>
            <ReactFlowProvider>
                <EmbeddedFlowDiagramInner
                    productionFlow={productionFlow}
                    interactive={interactive}
                />
            </ReactFlowProvider>
        </div>
    );
};
