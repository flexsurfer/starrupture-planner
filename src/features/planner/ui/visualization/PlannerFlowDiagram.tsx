import { useFlowLabels } from '@/shared/i18n/useFlowLabels';
import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import {
    ReactFlow,
    type Node,
    type Edge,
    type OnNodesChange,
    ControlButton,
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
import type { PlannerNodePositions } from '../../node-positions';

// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = { production: ProductionFlowEdge };
const proOptions = { hideAttribution: true };
const fitViewOptions = { duration: 300, padding: 0.1 };

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
    const activeTab = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TAB]);
    const tabId = activeTab?.id;
    const nodePositions = activeTab?.nodePositions;
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
    const handleNodesChange = useCallback<OnNodesChange>((changes) => {
        onNodesChange(changes);
        // React Flow sends dragging=false on drop and for completed keyboard moves.
        const moved: PlannerNodePositions = {};
        for (const change of changes) {
            if (change.type === 'position' && change.dragging === false && change.position) {
                moved[change.id] = { ...change.position };
            }
        }
        if (tabId && Object.keys(moved).length) runtime.dispatch([appIds.events.PLANNER_SET_NODE_POSITIONS, tabId, moved]);
    }, [onNodesChange, runtime, tabId]);
    const resetNodePositions = () => {
        if (!tabId) return;
        runtime.dispatch([appIds.events.PLANNER_RESET_NODE_POSITIONS, tabId]);
        // Commit the automatic coordinates before React Flow measures the graph for fitView.
        flushSync(() => {
            onNodesChange(flowGraph.nodes.map(({ id, position }) => ({ type: 'position', id, position, dragging: false })));
        });
        void fitView(fitViewOptions);
    };
    const {
        nodes: highlightedNodes,
        edges: highlightedEdges,
        onNodeDragStart,
        onNodeDragStop,
    } = usePinnableNodeHighlight(nodes, edges, true, { pinnedNodeId, onPinnedNodeChange });

    useEffect(() => {
        setNodes(current => {
            const byId = new Map(current.map(node => [node.id, node]));
            return renderedNodes.map(node => {
                const previous = byId.get(node.id);
                return {
                    ...previous,
                    ...node,
                    position: previous?.dragging ? previous.position : nodePositions?.[node.id] ?? node.position,
                };
            });
        });
    }, [renderedNodes, nodePositions, setNodes]);

    useEffect(() => { setEdges(flowGraph.edges); }, [flowGraph.edges, setEdges]);

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
        const timer = setTimeout(() => { void fitView(fitViewOptions); }, 10);
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
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                proOptions={proOptions}
                minZoom={0.1}
                maxZoom={2}
                defaultViewport={viewport ?? undefined}
                onMove={rememberViewport}
                selectNodesOnDrag={false}
                onNodeDragStart={onNodeDragStart}
                onNodeDragStop={onNodeDragStop}
            >
                <Background />
                <Controls>
                    <ControlButton
                        title={t('Reset node positions')}
                        aria-label={t('Reset node positions')}
                        onClick={resetNodePositions}
                    >
                        <svg viewBox="3 3 18 18" className="size-3! max-h-none! max-w-none! shrink-0" style={{ fillOpacity: 1 }} aria-hidden="true">
                            <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.93 9h-2.02A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z" />
                        </svg>
                    </ControlButton>
                </Controls>
            </ReactFlow>
        </div>
    );
};
