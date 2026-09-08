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
    useReactFlow,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useSubscription } from '@/app/uklad/bindings';
import type { ProductionFlowResult } from '@/features/planner/types';
import { generateReactFlowData } from '@/features/planner/ui/visualization';
import { useConnectedNodeHighlight } from '@/features/planner/ui/visualization/useConnectedNodeHighlight';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

interface EmbeddedFlowDiagramInnerProps {
    /** Pre-computed production flow result from a subscription */
    productionFlow: ProductionFlowResult;
    interactive?: boolean;
    onSelectRecipe?: (itemId: string, recipeKey: string) => void;
}

/**
 * Inner component that uses useReactFlow hook
 */
const EmbeddedFlowDiagramInner: React.FC<EmbeddedFlowDiagramInnerProps> = ({
    productionFlow,
    interactive = true,
    onSelectRecipe,
}) => {
    const { fitView } = useReactFlow();

    // State subscriptions for rendering
    const theme = useSubscription([appIds.subscriptions.UI_THEME]);
    const items = useSubscription([appIds.subscriptions.ITEMS_LIST]);

    // Generate React Flow data from pre-computed production flow
    const reactFlowData = useMemo((): { nodes: Node[]; edges: Edge[] } => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return { nodes: [], edges: [] };
        }

        return generateReactFlowData({
            flowNodes: productionFlow.nodes,
            flowEdges: productionFlow.edges,
            items,
            onSelectRecipe,
        });
    }, [productionFlow, items, onSelectRecipe]);

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const {
        nodes: highlightedNodes,
        edges: highlightedEdges,
        onNodeDragStart,
        onNodeDragStop,
    } = useConnectedNodeHighlight(nodes, edges, interactive);

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
                nodes={highlightedNodes}
                edges={highlightedEdges}
                colorMode={theme}
                onNodesChange={interactive ? onNodesChange : undefined}
                onEdgesChange={interactive ? onEdgesChange : undefined}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                attributionPosition="bottom-left"
                fitView
                minZoom={0.1}
                selectNodesOnDrag={false}
                onNodeDragStart={interactive ? onNodeDragStart : undefined}
                onNodeDragStop={interactive ? onNodeDragStop : undefined}
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
    onSelectRecipe?: (itemId: string, recipeKey: string) => void;
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
    onSelectRecipe,
}) => {
    return (
        <div className={`${className}`}>
            <ReactFlowProvider>
                <EmbeddedFlowDiagramInner
                    productionFlow={productionFlow}
                    interactive={interactive}
                    onSelectRecipe={onSelectRecipe}
                />
            </ReactFlowProvider>
        </div>
    );
};
