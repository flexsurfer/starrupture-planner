/**
 * Production Planner Component
 * 
 * This component provides the main UI for the production planner feature.
 * It allows users to select any producible item and visualizes the complete
 * production chain using React Flow with automatic layout via Dagre.
 * 
 * Features:
 * - Item selection dropdown (excludes raw materials)
 * - Interactive flow diagram with zoom/pan controls
 * - Dark/light theme support
 * - Minimap for navigation
 * - Building count calculations and material flow rates
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    ReactFlow,
    type Node,
    type Edge,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    useReactFlow,
    ReactFlowProvider,
    Position
} from '@xyflow/react';
import dagre from 'dagre';
import '@xyflow/react/dist/style.css';

import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../state/sub-ids';
import { ItemImage, BuildingImage } from './ui';

import type { Item, Building, ProductionNode, OrbitalCargoLauncherNode } from './planner/types';
import type { Corporation } from '../state/db';
import { buildProductionFlow, getItemName } from './planner/productionFlowBuilder';


// Define node and edge types outside component to prevent React Flow warnings
const nodeTypes = {};
const edgeTypes = {};

/**
 * Inner component that uses useReactFlow hook for fitView functionality
 */
const PlannerPageInner: React.FC = () => {
    const { fitView } = useReactFlow();
    // Theme subscription for dark/light mode support
    const theme = useSubscription<'light' | 'dark'>([SUB_IDS.THEME]);
    const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);
    const items = useSubscription<Item[]>([SUB_IDS.ITEMS]);
    const corporations = useSubscription<Corporation[]>([SUB_IDS.CORPORATIONS]);
    const levels = useSubscription<any[]>([SUB_IDS.LEVELS]);
    const selectedPlannerItem = useSubscription<string | null>([SUB_IDS.SELECTED_PLANNER_ITEM]);

    // Component state
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [targetAmount, setTargetAmount] = useState<number>(60);

    // Helper function to find the default output rate for an item
    const getDefaultOutputRate = useCallback((itemId: string): number => {
        for (const building of buildings) {
            for (const recipe of building.recipes) {
                if (recipe.output.id === itemId) {
                    return recipe.output.amount_per_minute;
                }
            }
        }
        return 60; // fallback if not found
    }, []);

    // Color system for items (matching ItemsPage badge colors)
    const getItemColor = useCallback((itemId: string): string => {
        const item = (items).find(i => i.id === itemId);
        if (!item) return '#6b7280'; // neutral gray

        const colorMap = {
            raw: '#3b82f6',      // blue (primary)
            processed: '#8b5cf6', // purple (secondary)
            component: '#06d6a0', // teal (accent)
            ammo: '#f59e0b',     // amber (warning)
            final: '#10b981',    // green (success)
        };

        return colorMap[item.type as keyof typeof colorMap] || '#6b7280';
    }, []);

    // Color system for buildings
    const getBuildingColor = useCallback((buildingId: string): string => {
        const colorMap = {
            ore_excavator: '#3b82f6',    // red - extraction
            helium_extractor: '#06b6d4', // cyan - gas extraction  
            smelter: '#f97316',          // orange - basic processing
            furnace: '#dc2626',          // red - high heat processing
            fabricator: '#8b5cf6',       // purple - manufacturing
        };

        return colorMap[buildingId as keyof typeof colorMap] || '#6b7280';
    }, []);
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Memoized list of selectable items (excludes raw materials)
    const selectableItems = useMemo(() => {
        return items.filter(item => item.type !== 'raw');
    }, []);

    /**
     * Converts the flow builder output to React Flow format and applies layout
     * 
     * This function:
     * 1. Builds the production flow using the separate flow builder
     * 2. Creates a Dagre graph for automatic layout
     * 3. Converts flow nodes to React Flow nodes with custom styling
     * 4. Converts flow edges to React Flow edges with labels
     * 5. Applies the calculated positions to all nodes
     */
    const generateReactFlowData = useCallback((targetItemId: string, amount: number) => {
        // Use fallback of 1 if amount is 0 or invalid (for temporary empty input state)
        const validAmount = amount > 0 ? amount : 1;

        // Build the production flow using our separate module
        const { nodes: flowNodes, edges: flowEdges } = buildProductionFlow({
            targetItemId,
            targetAmount: validAmount
        }, buildings, corporations, levels);

        // Create Dagre graph for automatic layout
        // Dagre arranges nodes in a hierarchical layout (left-to-right)
        const dagreGraph = new dagre.graphlib.Graph();
        dagreGraph.setDefaultEdgeLabel(() => ({}));
        dagreGraph.setGraph({ rankdir: 'LR', ranksep: 150, nodesep: 100 });

        // Add all nodes to the layout graph
        flowNodes.forEach((_, index) => {
            dagreGraph.setNode(`node_${index}`, { width: 200, height: 120 });
        });

        // Add edges to define the layout relationships
        flowEdges.forEach((edge) => {
            const fromIndex = flowNodes.findIndex(node => {
                const nodeId = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
                return nodeId === edge.from;
            });
            const toIndex = flowNodes.findIndex(node => {
                const nodeId = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
                return nodeId === edge.to;
            });

            if (fromIndex !== -1 && toIndex !== -1) {
                dagreGraph.setEdge(`node_${fromIndex}`, `node_${toIndex}`);
            }
        });

        // Calculate positions using Dagre
        dagre.layout(dagreGraph);

        // Convert flow nodes to React Flow nodes with positioning and styling
        const reactFlowNodes: Node[] = flowNodes.map((node, index) => {
            const nodeWithPosition = dagreGraph.node(`node_${index}`);

            // Helper function to check if node is Orbital Cargo Launcher
            const isOrbitalCargoLauncher = (n: ProductionNode): n is OrbitalCargoLauncherNode => {
                return n.buildingId === 'orbital_cargo_launcher';
            };

            const isLauncher = isOrbitalCargoLauncher(node);

            return {
                id: `node_${index}`,
                type: 'default',
                position: { x: nodeWithPosition.x - 100, y: nodeWithPosition.y - 60 },
                data: {
                    label: isLauncher ? (
                        // Special rendering for Orbital Cargo Launcher
                        <div className="text-center p-2">
                            <div className="text-xs font-semibold mb-1">
                                x{node.buildingCount.toFixed(2)}
                            </div>
                            {/* Launcher icon - using a rocket emoji since no image yet */}
                            <div
                                className="w-20 h-20 mx-auto mb-2 rounded-full flex items-center justify-center text-3xl bg-yellow-500"
                            >
                                <BuildingImage
                                    buildingId={"launcher"}
                                    className="w-19 h-19 rounded-full object-cover"
                                    size="medium"
                                />
                            </div>
                            {/* Launcher information */}
                            <div className="text-xs font-semibold mb-1">
                                {node.buildingName}
                            </div>
                            <div className="text-xs text-orange-500 mb-2">
                                {node.outputAmount} items/min
                            </div>
                            {/* Item and reward info */}
                            <div className="flex items-center gap-2 justify-center mb-2">
                                <div className="relative flex-shrink-0">
                                    <ItemImage
                                        itemId={node.outputItem}
                                        className="border-1 shadow-sm"
                                        style={{ borderColor: getItemColor(node.outputItem) }}
                                        size="small"
                                        showFallback={false}
                                    />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs opacity-75 leading-tight">
                                        {getItemName(node.outputItem, items)}
                                    </div>
                                    <div className="text-xs leading-tight text-orange-500">
                                        {node.pointsPerItem} pts/item
                                    </div>
                                </div>
                            </div>
                            {/* Launch time and level cost */}
                            <div className="text-xs space-y-1">
                                <div className="text-green-500 font-semibold">
                                    Level Cost: {node.totalPoints} pts
                                </div>
                                <div className="text-yellow-500 font-semibold">
                                    Total Launch Time: {(node.launchTime).toFixed(1)} min
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Standard rendering for production buildings
                        <div className="text-center p-2">
                            <div className="text-xs font-semibold mb-1">
                                x{node.buildingCount.toFixed(2)}
                            </div>
                            {/* Building icon */}
                            <div
                                className="w-20 h-20 mx-auto mb-2 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: getBuildingColor(node.buildingId) }}
                            >
                                <BuildingImage
                                    buildingId={node.buildingId}
                                    className="w-19 h-19 rounded-full object-cover"
                                    size="medium"
                                />
                            </div>
                            {/* Building information */}
                            <div className="text-xs font-semibold mb-2">
                                {node.buildingName}
                            </div>
                            {/* Item image and info inline */}
                            <div className="flex items-center gap-2 justify-center">
                                <div className="relative flex-shrink-0">
                                    <ItemImage
                                        itemId={node.outputItem}
                                        className="border-1 shadow-sm"
                                        style={{ borderColor: getItemColor(node.outputItem) }}
                                        size="small"
                                        showFallback={false}
                                    />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs opacity-75 leading-tight">
                                        {getItemName(node.outputItem, items)}
                                    </div>
                                    <div className="text-xs leading-tight"
                                        style={{ color: getItemColor(node.outputItem) }}>
                                        {node.outputAmount.toFixed(1)}/min
                                    </div>
                                </div>
                            </div>
                        </div>
                    ),
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            };
        });

        // Create a mapping from internal node IDs to React Flow node IDs
        const nodeIdMap = new Map<string, string>();
        flowNodes.forEach((node, index) => {
            const nodeKey = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
            nodeIdMap.set(nodeKey, `node_${index}`);
        });

        // Convert flow edges to React Flow edges with labels
        const reactFlowEdges: Edge[] = [];
        const edgeIdSet = new Set<string>();

        flowEdges.forEach((edge) => {
            const fromNodeId = nodeIdMap.get(edge.from);
            const toNodeId = nodeIdMap.get(edge.to);

            if (fromNodeId && toNodeId) {
                const edgeId = `${fromNodeId}-${toNodeId}-${edge.itemId}`;

                // Safety check: prevent duplicate React Flow edges
                if (edgeIdSet.has(edgeId)) {
                    return;
                }
                edgeIdSet.add(edgeId);

                const reactFlowEdge = {
                    id: edgeId,
                    source: fromNodeId,
                    target: toNodeId,
                    type: 'default',
                    style: { stroke: getItemColor(edge.itemId), strokeWidth: 2 },
                    label: `${getItemName(edge.itemId, items)} (${edge.amount.toFixed(1)}/min)`,
                    labelStyle: { fontSize: 12, fontWeight: 'bold', color: getItemColor(edge.itemId) },
                };
                reactFlowEdges.push(reactFlowEdge);
            }
        });

        // Set the new state
        setNodes(reactFlowNodes);
        setEdges(reactFlowEdges);
    }, [setNodes, setEdges, getItemColor, getBuildingColor, items, buildings, corporations, levels]);

    /**
     * Handles item selection from the dropdown
     * Regenerates the flow diagram when a new item is selected
     */
    const handleItemSelect = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        const itemId = event.target.value;
        setSelectedItemId(itemId);

        if (itemId) {
            // Set target amount to the default output rate of one building for this item
            const defaultOutput = getDefaultOutputRate(itemId);
            setTargetAmount(defaultOutput);
            generateReactFlowData(itemId, defaultOutput);
            // Fit view after generating new data
            setTimeout(() => {
                fitView({ duration: 300, padding: 0.1 });
            }, 10);
        } else {
            setNodes([]);
            setEdges([]);
        }
    }, [generateReactFlowData, getDefaultOutputRate, setNodes, setEdges, fitView]);

    // Handle selectedPlannerItem from global state
    React.useEffect(() => {
        if (selectedPlannerItem && selectedPlannerItem !== selectedItemId) {
            const defaultOutput = getDefaultOutputRate(selectedPlannerItem);
            setSelectedItemId(selectedPlannerItem);
            setTargetAmount(defaultOutput);
        }
    }, [selectedPlannerItem, selectedItemId, getDefaultOutputRate]);

    // Force regeneration of the current selection when the component updates
    React.useEffect(() => {
        if (selectedItemId) {
            generateReactFlowData(selectedItemId, targetAmount);
            // Fit view after nodes are updated (with a small delay to ensure DOM is updated)
            setTimeout(() => {
                fitView({ duration: 300, padding: 0.1 });
            }, 10);
        }
    }, [selectedItemId, targetAmount, generateReactFlowData, fitView]);

    return (
        <div className="h-full flex flex-col bg-base-100">
            {/* Header Section */}
            <div className="p-2 lg:p-4 bg-base-200 shadow-lg flex-shrink-0">
                {/* Mobile Layout - Compact */}
                <div className="flex flex-col gap-2 sm:hidden">
                    <select
                        className="select select-bordered select-sm w-full text-xs"
                        value={selectedItemId}
                        onChange={handleItemSelect}
                    >
                        <option value="">Choose an item to produce...</option>
                        {selectableItems.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name} ({item.type})
                            </option>
                        ))}
                    </select>

                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-base-content/70 whitespace-nowrap">Target/min:</span>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={targetAmount === 0 ? '' : targetAmount}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                    setTargetAmount(0);
                                } else {
                                    const numValue = Number(value);
                                    if (numValue >= 1) {
                                        setTargetAmount(numValue);
                                    }
                                }
                            }}
                            onBlur={(e) => {
                                const value = Number(e.target.value);
                                if (value < 1 || isNaN(value)) {
                                    setTargetAmount(1);
                                }
                            }}
                            className="input input-bordered input-sm w-20 text-xs"
                        />
                    </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden sm:flex flex-row items-end gap-4 lg:gap-6">
                    <div className="form-control flex-1">
                        <select
                            className="select select-bordered select-sm lg:select-md w-full"
                            value={selectedItemId}
                            onChange={handleItemSelect}
                        >
                            <option value="">Choose an item...</option>
                            {selectableItems.map((item) => (
                                <option key={item.id} value={item.id}>
                                    {item.name} ({item.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-control">
                        <label className="label pb-1">
                            <span className="label-text font-semibold text-sm lg:text-base">Target (per min):</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={targetAmount === 0 ? '' : targetAmount}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value === '') {
                                    setTargetAmount(0);
                                } else {
                                    const numValue = Number(value);
                                    if (numValue >= 1) {
                                        setTargetAmount(numValue);
                                    }
                                }
                            }}
                            onBlur={(e) => {
                                const value = Number(e.target.value);
                                if (value < 1 || isNaN(value)) {
                                    setTargetAmount(1);
                                }
                            }}
                            className="input input-bordered input-sm lg:input-md w-24 lg:w-28"
                        />
                    </div>
                </div>
            </div>

            {/* Flow Diagram Section */}
            <div className="flex-1 min-h-0">
                {selectedItemId ? (
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
                ) : (
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
                )}
            </div>
        </div>
    );
};

/**
 * Main Production Planner component wrapper with ReactFlowProvider
 */
const PlannerPage: React.FC = () => {
    return (
        <ReactFlowProvider>
            <PlannerPageInner />
        </ReactFlowProvider>
    );
};

export default PlannerPage;