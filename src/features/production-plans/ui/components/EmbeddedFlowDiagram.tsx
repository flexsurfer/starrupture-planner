import { appIds } from '@/app/uklad/catalog';
import React, { useEffect, useId, useMemo } from 'react';
import {
    ReactFlow,
    type Node,
    type Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    useReactFlow,
    useStore,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useSubscription } from '@/app/uklad/bindings';
import type { ProductionFlowResult } from '@/features/planner/types';
import type { PlannerFlowDirection } from '@/features/planner/flow-graph';
import { generateReactFlowData } from '@/features/planner/ui/visualization';
import { ProductionFlowEdge } from '@/features/planner/ui/visualization/ProductionFlowEdge';
import { usePinnableNodeHighlight } from '@/features/planner/ui/visualization/usePinnableNodeHighlight';
import { addDiagramInputRequirements } from '@/features/production-plans/diagram-inputs';
import type { NodeInputActions } from '@/features/planner/ui/visualization/NodeInputButton';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = { production: ProductionFlowEdge };

interface EmbeddedFlowDiagramInnerProps extends NodeInputActions {
    /** Pre-computed production flow result from a subscription */
    productionFlow: ProductionFlowResult;
    interactive?: boolean;
    nodesDraggable?: boolean;
    zoomOnScroll?: boolean;
    direction?: PlannerFlowDirection;
    targetItemId?: string;
    onSelectRecipe?: (itemId: string, recipeKey: string) => void;
}

/**
 * Inner component that uses useReactFlow hook
 */
const EmbeddedFlowDiagramInner: React.FC<EmbeddedFlowDiagramInnerProps> = ({
    productionFlow,
    interactive = true,
    nodesDraggable = interactive,
    zoomOnScroll = interactive,
    direction = 'LR',
    targetItemId,
    onSelectRecipe,
    renderInputDialog,
    onRevertInput,
    inputDisabledReason,
}) => {
    const { fitView } = useReactFlow();
    const backgroundId = useId();
    const width = useStore(state => state.width);
    const height = useStore(state => state.height);

    // State subscriptions for rendering
    const theme = useSubscription([appIds.subscriptions.UI_THEME]);
    const items = useSubscription([appIds.subscriptions.ITEMS_LIST]);
    const buildings = useSubscription([appIds.subscriptions.BUILDINGS_LIST]);
    const mode = useSubscription([appIds.subscriptions.BASES_MODE]);

    // Generate React Flow data from pre-computed production flow
    const reactFlowData = useMemo((): { nodes: Node[]; edges: Edge[] } => {
        if (!productionFlow || productionFlow.nodes.length === 0) {
            return { nodes: [], edges: [] };
        }

        const diagram = addDiagramInputRequirements(productionFlow, buildings);
        return generateReactFlowData({
            flowNodes: diagram.nodes,
            flowEdges: diagram.edges,
            inputRequirements: diagram.requirements,
            showMissingInputs: mode !== 'planning',
            items,
            onSelectRecipe,
            direction,
            targetItemId,
            renderInputDialog: interactive ? renderInputDialog : undefined,
            onRevertInput: interactive ? onRevertInput : undefined,
            inputDisabledReason,
        });
    }, [productionFlow, items, buildings, mode, onSelectRecipe, direction, targetItemId, renderInputDialog, onRevertInput, inputDisabledReason, interactive]);

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const {
        nodes: highlightedNodes,
        edges: highlightedEdges,
        resetHighlight,
        onNodeDragStart,
        onNodeDragStop,
    } = usePinnableNodeHighlight(nodes, edges, interactive);

    // Update React Flow nodes and edges when data changes
    useEffect(() => {
        // A recalculated plan may reuse node IDs for different buildings.
        resetHighlight();
        if (reactFlowData) {
            setNodes(reactFlowData.nodes);
            setEdges(reactFlowData.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [reactFlowData, setNodes, setEdges, resetHighlight]);

    // Auto-fit view when production flow changes
    useEffect(() => {
        // Small delay to ensure DOM is updated
        const timer = setTimeout(() => {
            if (nodes.length > 0) { 
                fitView({ duration: 300, padding: 0.1 }); 
            } 
        }, 10);
        return () => clearTimeout(timer);
    }, [productionFlow, nodes.length, fitView, direction, width, height]);

    return (
        <div className={`w-full h-full min-h-0 ${!interactive ? 'pointer-events-none' : ''}`}>
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
                zoomOnScroll={interactive && zoomOnScroll}
                preventScrolling={interactive && zoomOnScroll}
                zoomOnPinch={interactive}
                zoomOnDoubleClick={interactive}
                nodesDraggable={interactive && nodesDraggable}
                nodesConnectable={false}
                elementsSelectable={interactive}
            >
                <Background id={backgroundId} />
                {interactive && <Controls showInteractive={false} />}
            </ReactFlow>
        </div>
    );
};

interface EmbeddedFlowDiagramProps extends NodeInputActions {
    /** Pre-computed production flow result from a subscription */
    productionFlow: ProductionFlowResult;
    className?: string;
    interactive?: boolean;
    nodesDraggable?: boolean;
    zoomOnScroll?: boolean;
    direction?: PlannerFlowDirection;
    targetItemId?: string;
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
    nodesDraggable,
    zoomOnScroll,
    direction,
    targetItemId,
    onSelectRecipe,
    renderInputDialog,
    onRevertInput,
    inputDisabledReason,
}) => {
    return (
        <div className={`${className}`}>
            <ReactFlowProvider>
                <EmbeddedFlowDiagramInner
                    productionFlow={productionFlow}
                    interactive={interactive}
                    nodesDraggable={nodesDraggable}
                    zoomOnScroll={zoomOnScroll}
                    direction={direction}
                    targetItemId={targetItemId}
                    onSelectRecipe={onSelectRecipe}
                    renderInputDialog={renderInputDialog}
                    onRevertInput={onRevertInput}
                    inputDisabledReason={inputDisabledReason}
                />
            </ReactFlowProvider>
        </div>
    );
};
