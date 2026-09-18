import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Panel,
  SelectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  ConnectionLineType,
  MarkerType,
  ConnectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { BaseLayoutBuilding, RailTier } from "@/app/uklad/model";
import { resolveLayoutBuildingRecipe } from "@/features/base-layout/recipe-resolution";
import {
  gridToPixels,
  GRID_CELL_SIZE,
} from "@/features/base-layout/utils/gridUtils";
import { validateConnection } from "@/features/base-layout/utils/connectionValidator";
import LayoutBuildingNode from "./LayoutBuildingNode";
import LayoutConnectionEdge from "./LayoutConnectionEdge";
import VirtualConnectionEdge from "./VirtualConnectionEdge";

interface LayoutCanvasProps {
  baseId: string;
  className?: string;
}

const nodeTypes = {
  layoutBuilding: LayoutBuildingNode,
};

const edgeTypes = {
  layoutConnection: LayoutConnectionEdge,
  virtualConnection: VirtualConnectionEdge,
};

interface ConnectionDragState {
  fromNodeId: string;
  itemId: string;
  validTargetIds: string[];
}

function getClientPositionFromPointerEvent(
  event: MouseEvent | TouchEvent,
): { clientX: number; clientY: number } | null {
  if ("changedTouches" in event && event.changedTouches.length > 0) {
    const touch = event.changedTouches[0];
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
    };
  }

  if ("clientX" in event && "clientY" in event) {
    return {
      clientX: event.clientX,
      clientY: event.clientY,
    };
  }

  return null;
}

function areSelectedIdsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const normalizedLeft = [...left].sort();
  const normalizedRight = [...right].sort();

  return normalizedLeft.every((id, index) => id === normalizedRight[index]);
}

const LayoutCanvas = ({ baseId, className }: LayoutCanvasProps) => {
  const runtime = useRuntime();
  const theme = useSubscription([appIds.subscriptions.UI_THEME]);
  const buildings = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_BUILDINGS_BY_BASE_ID,
    baseId,
  ]);
  const connections = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_CONNECTIONS_BY_BASE_ID,
    baseId,
  ]);
  const buildingsById = useSubscription([
    appIds.subscriptions.BUILDINGS_BY_ID_MAP,
  ]);
  const connectorMode = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_CONNECTOR_MODE,
  ]);
  const selectedRailTier = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_SELECTED_RAIL_TIER,
  ]);
  const transferRates = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_CONNECTION_TRANSFER_RATES,
    baseId,
  ]);
  const selectedBuildingIds = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_SELECTED_BUILDING_IDS,
  ]);
  const selectedConnectionIds = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_SELECTED_CONNECTION_IDS,
  ]);
  const transferMode = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_TRANSFER_MODE,
  ]);
  const virtualEdges = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_VIRTUAL_EDGES_FOR_SELECTION,
    baseId,
  ]);
  const isVirtual = transferMode === "virtual";
  const { screenToFlowPosition, fitView } = useReactFlow();
  const hasInitializedView = useRef(false);
  const suppressNextNodeClick = useRef(false);
  const suppressNextPaneClick = useRef(false);
  const didCompleteConnection = useRef(false);
  const connectionDragRef = useRef<ConnectionDragState | null>(null);
  const [connectionDrag, setConnectionDrag] =
    useState<ConnectionDragState | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isCtrlHeld, setIsCtrlHeld] = useState(false);
  // Default drag behaviour: pan. Ctrl+drag: selection box.
  const panOnDrag = !connectorMode && !isCtrlHeld;
  const selectionOnDrag = !connectorMode && isCtrlHeld;
  const allowsSingleSelection = !connectorMode;

  const setActiveConnectionDrag = useCallback(
    (nextDrag: ConnectionDragState | null) => {
      connectionDragRef.current = nextDrag;
      setConnectionDrag(nextDrag);
    },
    [],
  );

  // Convert layout buildings to ReactFlow nodes.
  // Does NOT track selectedBuildingIds — selection is handled in its own effect
  // below so that a click never triggers a full rebuild of every node.
  useEffect(() => {
    setNodes((currentNodes) => {
      // Preserve each node's current selected state rather than resetting it.
      const selectedById = new Map(
        currentNodes.map((n) => [n.id, n.selected ?? false]),
      );

      return buildings.map((building) => {
        const pixelPos = gridToPixels(building.x, building.y);
        const isConnectionSource = connectionDrag?.fromNodeId === building.id;
        const isSelected = selectedById.get(building.id) ?? false;
        return {
          id: building.id,
          type: "layoutBuilding",
          position: pixelPos,
          data: {
            building,
            baseId,
            connectorMode,
            transferMode,
            isConnectionSource,
            isConnectionTarget:
              connectionDrag?.validTargetIds.includes(building.id) ?? false,
            selected: isSelected,
          },
          draggable: !connectorMode,
          selectable: true,
          selected: isSelected,
        };
      });
    });
  }, [
    buildings,
    baseId,
    connectorMode,
    transferMode,
    connectionDrag,
    setNodes,
  ]);

  // Lightweight effect that patches only the nodes whose selection changed.
  // Keeps data object references stable for unchanged nodes so React.memo works.
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const isSelected = selectedBuildingIds.includes(node.id);
        if (
          node.selected === isSelected &&
          (node.data as { selected?: boolean }).selected === isSelected
        ) {
          return node;
        }
        return {
          ...node,
          selected: isSelected,
          data: { ...(node.data as object), selected: isSelected },
        };
      }),
    );
  }, [selectedBuildingIds, setNodes]);

  // Fit view only once on initial load when there are buildings
  useEffect(() => {
    if (!hasInitializedView.current && buildings.length > 0) {
      hasInitializedView.current = true;
      // Small delay to ensure nodes are rendered
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 200 });
      }, 100);
    }
  }, [buildings.length, fitView]);

  // Convert layout connections to ReactFlow edges.
  // Does NOT track selectedConnectionIds — selection is handled separately below.
  useEffect(() => {
    if (isVirtual) {
      setEdges([]);
      return;
    }

    setEdges((currentEdges) => {
      const selectedById = new Map(
        currentEdges.map((e) => [e.id, e.selected ?? false]),
      );

      return connections.map((connection) => {
        const rates = transferRates?.[connection.id];
        const isSelected = selectedById.get(connection.id) ?? false;
        return {
          id: connection.id,
          source: connection.fromBuildingId,
          target: connection.toBuildingId,
          type: "layoutConnection",
          selected: isSelected,
          data: {
            connection,
            baseId,
            transferRate: rates,
            selected: isSelected,
          },
          style: {
            stroke: "#888",
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        };
      });
    });
  }, [connections, baseId, transferRates, isVirtual, setEdges]);

  // Inject virtual highlight edges when a building is selected in virtual mode.
  useEffect(() => {
    if (!isVirtual) return;
    setEdges(
      (virtualEdges ?? []).map((ve) => ({
        id: ve.id,
        source: ve.fromBuildingId,
        target: ve.toBuildingId,
        type: "virtualConnection",
        selectable: false,
        data: { virtualEdge: ve },
      })),
    );
  }, [virtualEdges, isVirtual, setEdges]);

  // Lightweight effect that patches only the edges whose selection changed.
  useEffect(() => {
    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        const isSelected = selectedConnectionIds.includes(edge.id);
        if (
          edge.selected === isSelected &&
          (edge.data as { selected?: boolean })?.selected === isSelected
        ) {
          return edge;
        }
        return {
          ...edge,
          selected: isSelected,
          data: { ...(edge.data as object), selected: isSelected },
        };
      }),
    );
  }, [selectedConnectionIds, setEdges]);

  // Handle node drag end - update building position
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!node.data.building) return;

      suppressNextNodeClick.current = true;
      suppressNextPaneClick.current = true;

      if (
        selectedBuildingIds.length > 1 &&
        selectedBuildingIds.includes(node.id)
      ) {
        return;
      }

      // Convert pixel position back to grid coordinates
      const gridX = Math.round(node.position.x / GRID_CELL_SIZE);
      const gridY = Math.round(node.position.y / GRID_CELL_SIZE);

      // Dispatch move event
      runtime.dispatch([
        appIds.events.BASE_LAYOUT_MOVE_BUILDING,
        baseId,
        node.id,
        gridX,
        gridY,
      ]);
    },
    [baseId, selectedBuildingIds, runtime],
  );

  const handleSelectionDragStop = useCallback(
    (_event: React.MouseEvent, draggedNodes: Node[]) => {
      if (draggedNodes.length === 0) {
        return;
      }

      suppressNextNodeClick.current = true;
      suppressNextPaneClick.current = true;

      runtime.dispatch([
        appIds.events.BASE_LAYOUT_SET_SELECTION,
        draggedNodes.map((node) => node.id),
        [],
      ]);

      const moves = draggedNodes
        .filter((node) => node.data.building)
        .map((node) => ({
          layoutBuildingId: node.id,
          newX: Math.round(node.position.x / GRID_CELL_SIZE),
          newY: Math.round(node.position.y / GRID_CELL_SIZE),
        }));

      if (moves.length === 0) {
        return;
      }

      if (moves.length === 1) {
        const [move] = moves;
        runtime.dispatch([
          appIds.events.BASE_LAYOUT_MOVE_BUILDING,
          baseId,
          move.layoutBuildingId,
          move.newX,
          move.newY,
        ]);
        return;
      }

      runtime.dispatch([
        appIds.events.BASE_LAYOUT_MOVE_BUILDINGS,
        baseId,
        moves,
      ]);
    },
    [baseId, runtime],
  );

  const getSourceItemId = useCallback(
    (sourceBuilding: BaseLayoutBuilding): string | null => {
      if (sourceBuilding.buildingType === "dispatcher") {
        return null; // Dispatchers have no output — they cannot be a connection source
      }

      if (sourceBuilding.buildingType === "receiver") {
        return sourceBuilding.itemId;
      }

      const sourceBuildingDef = buildingsById[sourceBuilding.buildingId];
      const sourceRecipe = resolveLayoutBuildingRecipe(
        sourceBuilding,
        sourceBuildingDef,
      );

      return sourceRecipe?.output.id ?? null;
    },
    [buildingsById],
  );

  const validateConnectionAttempt = useCallback(
    (
      sourceId: string,
      targetId: string,
    ): {
      isValid: boolean;
      itemId: string | null;
    } => {
      if (sourceId === targetId) {
        return { isValid: false, itemId: null };
      }

      const sourceBuilding = buildings.find(
        (building) => building.id === sourceId,
      );
      const targetBuilding = buildings.find(
        (building) => building.id === targetId,
      );

      if (!sourceBuilding || !targetBuilding) {
        return { isValid: false, itemId: null };
      }

      const itemId = getSourceItemId(sourceBuilding);
      if (!itemId) {
        return { isValid: false, itemId: null };
      }

      const validation = validateConnection(
        sourceBuilding,
        targetBuilding,
        itemId,
        connectorMode ?? selectedRailTier,
        buildingsById,
        connections,
      );

      return {
        isValid: validation.isValid,
        itemId,
      };
    },
    [
      buildings,
      buildingsById,
      connections,
      connectorMode,
      getSourceItemId,
      selectedRailTier,
    ],
  );

  const startConnectionDrag = useCallback(
    (sourceId: string) => {
      const sourceBuilding = buildings.find(
        (building) => building.id === sourceId,
      );
      if (!sourceBuilding) {
        setActiveConnectionDrag(null);
        return;
      }

      const itemId = getSourceItemId(sourceBuilding);
      if (!itemId) {
        setActiveConnectionDrag(null);
        return;
      }

      const validTargetIds = buildings
        .filter((building) => building.id !== sourceId)
        .filter(
          (building) =>
            validateConnectionAttempt(sourceId, building.id).isValid,
        )
        .map((building) => building.id);

      setActiveConnectionDrag({
        fromNodeId: sourceId,
        itemId,
        validTargetIds,
      });
    },
    [
      buildings,
      getSourceItemId,
      setActiveConnectionDrag,
      validateConnectionAttempt,
    ],
  );

  // Handle connection creation
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (isVirtual) return;
      if (!connection.source || !connection.target) return;

      const validation = validateConnectionAttempt(
        connection.source,
        connection.target,
      );
      if (!validation.isValid || !validation.itemId) {
        return;
      }

      // Use connector mode rail tier; fall back to the user's persisted selection
      const railTier: RailTier = connectorMode ?? selectedRailTier;
      didCompleteConnection.current = true;

      // Dispatch add connection event
      runtime.dispatch([
        appIds.events.BASE_LAYOUT_ADD_CONNECTION,
        baseId,
        connection.source,
        connection.target,
        validation.itemId,
        railTier,
      ]);

      // Clear connection drag state
      setActiveConnectionDrag(null);
    },
    [
      baseId,
      connectorMode,
      isVirtual,
      runtime,
      selectedRailTier,
      setActiveConnectionDrag,
      validateConnectionAttempt,
    ],
  );

  const handleConnectStart = useCallback(
    (
      _event: MouseEvent | TouchEvent,
      params: { nodeId?: string | null; handleType?: string | null },
    ) => {
      if (isVirtual) return;
      didCompleteConnection.current = false;

      if (params.handleType !== "source" || !params.nodeId) {
        setActiveConnectionDrag(null);
        return;
      }

      startConnectionDrag(params.nodeId);
    },
    [isVirtual, setActiveConnectionDrag, startConnectionDrag],
  );

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (isVirtual) return;
      if (didCompleteConnection.current) {
        didCompleteConnection.current = false;
        setActiveConnectionDrag(null);
        return;
      }

      const activeConnectionDrag = connectionDragRef.current;

      if (!activeConnectionDrag) {
        return;
      }

      const clientPosition = getClientPositionFromPointerEvent(event);
      if (!clientPosition) {
        setActiveConnectionDrag(null);
        return;
      }

      const dropTarget = document.elementFromPoint(
        clientPosition.clientX,
        clientPosition.clientY,
      );

      if (!(dropTarget instanceof Element)) {
        setActiveConnectionDrag(null);
        return;
      }

      const targetNode = dropTarget.closest(".react-flow__node");
      const targetId = targetNode?.getAttribute("data-id");

      if (
        targetId &&
        activeConnectionDrag.validTargetIds.includes(targetId) &&
        targetId !== activeConnectionDrag.fromNodeId
      ) {
        handleConnect({
          source: activeConnectionDrag.fromNodeId,
          target: targetId,
          sourceHandle: null,
          targetHandle: null,
        });
        return;
      }

      setActiveConnectionDrag(null);
    },
    [isVirtual, handleConnect, setActiveConnectionDrag],
  );

  // Handle drop from palette
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const data = event.dataTransfer.getData("application/reactflow");
      if (!data) return;

      try {
        const { itemId, buildingId, recipeIndex, paletteMode } =
          JSON.parse(data);

        // Convert screen position to flow position
        const flowPosition = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        // Convert flow position to grid coordinates
        const gridX = Math.round(flowPosition.x / GRID_CELL_SIZE);
        const gridY = Math.round(flowPosition.y / GRID_CELL_SIZE);

        // Dispatch add building event based on palette mode
        if (paletteMode === "receiver") {
          runtime.dispatch([
            appIds.events.BASE_LAYOUT_ADD_BUILDING,
            baseId,
            gridX,
            gridY,
            itemId,
            "package_receiver",
            0,
            "receiver",
            100,
          ]);
        } else if (paletteMode === "dispatcher") {
          runtime.dispatch([
            appIds.events.BASE_LAYOUT_ADD_BUILDING,
            baseId,
            gridX,
            gridY,
            itemId,
            "package_dispatcher",
            0,
            "dispatcher",
            undefined,
            100,
          ]);
        } else {
          runtime.dispatch([
            appIds.events.BASE_LAYOUT_ADD_BUILDING,
            baseId,
            gridX,
            gridY,
            itemId,
            buildingId,
            recipeIndex,
          ]);
        }
      } catch (error) {
        console.error("Failed to parse drag data:", error);
      }
    },
    [baseId, screenToFlowPosition, runtime],
  );

  // Allow drop
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  // Handle node click when in connector mode
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (suppressNextNodeClick.current) {
        suppressNextNodeClick.current = false;
        return;
      }

      if (!connectorMode || isVirtual) {
        if (!allowsSingleSelection) {
          return;
        }

        // Ctrl+click multi-select is handled natively by ReactFlow (multiSelectionKeyCode="Control")
        // and flows through handleSelectionChange. Regular single-click dispatches here.
        if (!event.ctrlKey && !event.metaKey) {
          runtime.dispatch([
            appIds.events.BASE_LAYOUT_SET_SELECTED_BUILDING,
            node.id,
          ]);
        }
        return;
      }

      if (!connectionDrag) {
        // Start connection drag
        startConnectionDrag(node.id);
      } else {
        if (connectionDrag.fromNodeId === node.id) {
          setActiveConnectionDrag(null);
          return;
        }

        // Complete connection
        if (connectionDrag.validTargetIds.includes(node.id)) {
          handleConnect({
            source: connectionDrag.fromNodeId,
            target: node.id,
            sourceHandle: null,
            targetHandle: null,
          });
          return;
        }
      }
    },
    [
      allowsSingleSelection,
      connectorMode,
      isVirtual,
      runtime,
      connectionDrag,
      handleConnect,
      setActiveConnectionDrag,
      startConnectionDrag,
    ],
  );

  const handleSelectionChange = useCallback(
    ({
      nodes: selectedNodes,
      edges: selectedEdges,
    }: {
      nodes: Node[];
      edges: Edge[];
    }) => {
      // Only handle ctrl+click and ctrl+drag box-selection events.
      //
      // Regular clicks and programmatic selections (e.g. balance table row click)
      // happen without Ctrl held, so this gate blocks them. Without the gate,
      // programmatic setNodes/setEdges calls trigger onSelectionChange before both
      // effects have finished, causing an intermediate dispatch that clears the
      // connection selection and starts a flicker loop.
      if (connectorMode || !isCtrlHeld) return;

      const nextSelectedNodeIds = selectedNodes.map((node) => node.id);
      const nextSelectedEdgeIds = selectedEdges.map((edge) => edge.id);

      if (
        areSelectedIdsEqual(nextSelectedNodeIds, selectedBuildingIds) &&
        areSelectedIdsEqual(nextSelectedEdgeIds, selectedConnectionIds)
      ) {
        return;
      }

      runtime.dispatch([
        appIds.events.BASE_LAYOUT_SET_SELECTION,
        nextSelectedNodeIds,
        nextSelectedEdgeIds,
      ]);
    },
    [
      connectorMode,
      isCtrlHeld,
      selectedBuildingIds,
      selectedConnectionIds,
      runtime,
    ],
  );

  // Handle pane click - cancel connection drag and clear selections
  const handlePaneClick = useCallback(() => {
    if (suppressNextPaneClick.current) {
      suppressNextPaneClick.current = false;
      return;
    }

    if (connectionDrag) {
      setActiveConnectionDrag(null);
    }
    if (selectedBuildingIds.length > 0 || selectedConnectionIds.length > 0) {
      runtime.dispatch([appIds.events.BASE_LAYOUT_SET_SELECTION, [], []]);
    }
  }, [
    runtime,
    connectionDrag,
    setActiveConnectionDrag,
    selectedBuildingIds.length,
    selectedConnectionIds.length,
  ]);

  // Handle edge click - select connection
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!allowsSingleSelection) {
        return;
      }
      event.stopPropagation();
      suppressNextPaneClick.current = true;

      // Ctrl+click multi-select is handled natively by ReactFlow and flows through
      // handleSelectionChange. Regular single-click dispatches here.
      if (!event.ctrlKey && !event.metaKey) {
        runtime.dispatch([
          appIds.events.BASE_LAYOUT_SET_SELECTED_CONNECTION,
          edge.id,
        ]);
      }
    },
    [allowsSingleSelection, runtime],
  );

  // Track Ctrl/Cmd key: held = selection-box drag; released = pan drag.
  // Reset on window blur so the flag never gets stuck when the user Alt+Tabs.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setIsCtrlHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Meta") setIsCtrlHeld(false);
    };
    const onBlur = () => setIsCtrlHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  // Handle keyboard events - Delete key removes the selected building or connection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Delete") {
        return;
      }

      if (selectedBuildingIds.length > 0) {
        runtime.dispatch([appIds.events.BASE_LAYOUT_DELETE_SELECTED_BUILDING]);
        return;
      }

      if (selectedConnectionIds.length > 0) {
        runtime.dispatch([
          appIds.events.BASE_LAYOUT_DELETE_SELECTED_CONNECTION,
        ]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBuildingIds.length, selectedConnectionIds.length, runtime]);

  return (
    <div className={className}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onSelectionChange={handleSelectionChange}
        onSelectionDragStop={handleSelectionDragStop}
        onPaneClick={handlePaneClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeTypes={nodeTypes as any}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edgeTypes={edgeTypes as any}
        colorMode={theme}
        elementsSelectable={allowsSingleSelection}
        connectionLineType={ConnectionLineType.Bezier}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        snapToGrid
        snapGrid={[GRID_CELL_SIZE, GRID_CELL_SIZE]}
        autoPanOnNodeDrag={false}
        panOnDrag={panOnDrag}
        selectionOnDrag={selectionOnDrag}
        multiSelectionKeyCode="Control"
        selectNodesOnDrag={false}
        selectionMode={SelectionMode.Full}
        connectionMode={ConnectionMode.Strict}
      >
        <Background gap={GRID_CELL_SIZE} size={2} />
        <Controls />
        <Panel
          position="top-right"
          className="bg-base-200 p-2 rounded-lg shadow-lg text-sm"
        >
          <div className="text-base-content/70" style={{ display: "none" }}>
            <div>Zoom: Scroll wheel</div>
            <div>Pan: Drag background · Ctrl+drag: box-select</div>
            <div>Move: Drag buildings</div>
            {connectorMode && (
              <div className="mt-2 pt-2 border-t border-base-300">
                <div className="text-primary font-semibold">
                  🔗 Connector Mode: Tier {connectorMode}
                </div>
                <div className="text-xs">
                  {connectionDrag
                    ? "Click on target building"
                    : "Click on source building"}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default LayoutCanvas;
