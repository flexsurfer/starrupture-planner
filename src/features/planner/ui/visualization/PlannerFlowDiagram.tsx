import { useFlowLabels } from '@/shared/i18n/useFlowLabels';
import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
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
import { usePlannerInputActions } from './usePlannerInputActions';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = { production: ProductionFlowEdge };

/**
 * Flow diagram component for the production planner
 * Handles the React Flow visualization with automatic layout
 */
export const PlannerFlowDiagram: React.FC<{ onManageResource?: (itemId: string, amount: number) => void; sidebarOpen?: boolean }> = ({ onManageResource, sidebarOpen = false }) => {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const { onManageResources } = usePlannerInputActions(onManageResource);
    const onSelectRecipe = useCallback((itemId: string, recipeKey: string) => {
        runtime.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, itemId, recipeKey]);
    }, [runtime]);
    const flowLabels = useFlowLabels();
    const { fitView } = useReactFlow();
    const tabId = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TAB])?.id;
    const viewport = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_VIEWPORT]);
    const rememberViewport = useCallback((_event: unknown, next: { x: number; y: number; zoom: number }) => {
        if (tabId) runtime.dispatch([appIds.events.PLANNER_SET_VIEWPORT, tabId, next.x, next.y, next.zoom]);
    }, [runtime, tabId]);
    const pinnedNodeId = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_PINNED_NODE]);
    const onPinnedNodeChange = useCallback((nodeId: string | null) => {
        if (tabId) runtime.dispatch([appIds.events.PLANNER_SET_PINNED_NODE, tabId, nodeId]);
    }, [runtime, tabId]);
    const previousLayout = useRef<string | null>(null);

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
        },
        data: {
            label: <NodeCard onSelectRecipe={onSelectRecipe} node={flowNode} items={flowGraph.items!} outputColor={outputColor}
                onManageResources={selectedItemId.includes(flowNode.outputItem) ? undefined : onManageResources} />,
        },
    })), [flowGraph, onSelectRecipe, onManageResources, selectedItemId]);

    // React Flow state
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
    const {
        nodes: highlightedNodes,
        edges: highlightedEdges,
        onNodeDragStart,
        onNodeDragStop,
    } = usePinnableNodeHighlight(nodes, edges, true, { pinnedNodeId, onPinnedNodeChange });

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

    useEffect(() => {
        // Validate against the calculated graph, not the initially empty React Flow nodes.
        if (pinnedNodeId && !flowGraph.nodes.some(node => node.id === pinnedNodeId)) onPinnedNodeChange(null);
    }, [flowGraph, pinnedNodeId, onPinnedNodeChange]);

    const layoutKey = JSON.stringify([selectedItemId, direction, groupByStage, nodes.length, sidebarOpen]);
    // Restore the session camera on mount; still fit when the actual layout changes.
    useEffect(() => {
        if (!nodes.length) return;
        const layoutChanged = previousLayout.current !== null && previousLayout.current !== layoutKey;
        previousLayout.current = layoutKey;
        if (viewport && !layoutChanged) return;
        // Small delay to ensure DOM is updated
        const timer = setTimeout(() => { if (nodes.length > 0) { fitView({ duration: 300, padding: 0.1 }); } }, 10);
        return () => clearTimeout(timer);
    }, [layoutKey, nodes.length, viewport, fitView]);

    if (!selectedItemId.length) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="text-6xl mb-4">📐</div>
                    <h2 className="text-xl font-semibold text-base-content/80">{t("Select an item to view its production flow")}</h2>
                    <p className="text-base-content/60 mt-2">{t("Choose any processed item, component, or ammo to see the required buildings and resource flow.")}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full">
            <DiagramSettings />
            <ReactFlow
                ariaLabelConfig={flowLabels}
                nodes={highlightedNodes}
                edges={highlightedEdges}
                colorMode={theme}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                attributionPosition="bottom-left"
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={viewport ?? undefined}
                onMove={rememberViewport}
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
