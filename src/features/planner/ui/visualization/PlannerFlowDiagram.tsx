import { appIds } from '@/app/uklad/catalog';
import React, { useCallback, useEffect, useMemo } from 'react';
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

import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { ProductionFlowEdge } from './ProductionFlowEdge';
import { DiagramSettings } from './DiagramSettings';
import { NodeCard } from './NodeCard';
import { usePinnableNodeHighlight } from './usePinnableNodeHighlight';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = { production: ProductionFlowEdge };

/**
 * Flow diagram component for the production planner
 * Handles the React Flow visualization with automatic layout
 */
export const PlannerFlowDiagram: React.FC = () => {
    const runtime = useRuntime();
    const onSelectRecipe = useCallback((itemId: string, recipeKey: string) => {
        runtime.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, itemId, recipeKey]);
    }, [runtime]);
    const { fitView } = useReactFlow();

    // State subscriptions
    const selectedItemId = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS]);
    const groupByStage = useSubscription([appIds.subscriptions.PLANNER_GROUP_BY_STAGE]);
    const direction = useSubscription([appIds.subscriptions.PLANNER_FLOW_DIRECTION]);
    const theme = useSubscription([appIds.subscriptions.UI_THEME]);
    const flowGraph = useSubscription([appIds.subscriptions.PLANNER_FLOW_GRAPH]);
    const renderedNodes = useMemo<Node[]>(() => flowGraph.nodes.map(({ flowNode, outputColor, ...node }) => ({
        ...node,
        style: {
            ...node.style,
            padding: 0,
            ...(flowNode.nodeType !== 'launcher' && selectedItemId.includes(flowNode.outputItem) && {
                borderColor: 'var(--color-primary)',
            }),
        },
        data: {
            label: <NodeCard onSelectRecipe={onSelectRecipe} node={flowNode} items={flowGraph.items!} outputColor={outputColor} />,
        },
    })), [flowGraph, onSelectRecipe, selectedItemId]);

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const {
        nodes: highlightedNodes,
        edges: highlightedEdges,
        resetHighlight,
        onNodeDragStart,
        onNodeDragStop,
    } = usePinnableNodeHighlight(nodes, edges);

    // Update React Flow nodes and edges when subscription data changes
    useEffect(() => {
        // Pins belong only to the current calculation, even if node IDs survive.
        resetHighlight();
        if (flowGraph) {
            setNodes(renderedNodes);
            setEdges(flowGraph.edges);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [flowGraph, renderedNodes, setNodes, setEdges, resetHighlight]);

    // Auto-fit view when item changes
    useEffect(() => {
        // Small delay to ensure DOM is updated
        const timer = setTimeout(() => { if (nodes.length > 0) { fitView({ duration: 300, padding: 0.1 }); } }, 10);
        return () => clearTimeout(timer);
    }, [selectedItemId, direction, groupByStage, nodes.length, fitView]);

    if (!selectedItemId.length) {
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
        <div className="relative w-full h-full">
            <DiagramSettings />
            <ReactFlow
                nodes={highlightedNodes}
                edges={highlightedEdges}
                colorMode={theme}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                attributionPosition="bottom-left"
                minZoom={0.1}
                selectNodesOnDrag={false}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={onNodeDragStop}
            >
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};
