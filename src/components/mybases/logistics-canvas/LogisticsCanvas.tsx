import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Controls,
  MiniMap,
  Background,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import { EVENT_IDS } from '../../../state/event-ids';
import type { EnergyGroup } from '../../../state/db';
import type { BaseLogisticsViewModel, BaseDetailStats } from '../types';
import { BaseNetworkNode } from './BaseNetworkNode';
import { EnergyGridNode } from './EnergyGridNode';
import { buildLogisticsCanvasData, type LayerFilter } from './logisticsCanvasUtils';

const nodeTypes = {
  baseNetwork: BaseNetworkNode,
  energyGrid: EnergyGridNode,
};

const edgeTypes = {};

const EMPTY_MODELS: BaseLogisticsViewModel[] = [];
const EMPTY_ENERGY_GROUPS: EnergyGroup[] = [];

interface EdgeDetailData {
  type: string;
  sourceBaseId?: string;
  targetBaseId?: string;
  outputId?: string;
  inputId?: string;
  itemName?: string;
  ratePerMinute?: number;
  isBroken?: boolean;
  baseId?: string;
  groupId?: string;
  groupName?: string;
}

interface EdgeDetailPanelProps {
  edgeData: EdgeDetailData;
  onClose: () => void;
}

const EdgeDetailPanel: React.FC<EdgeDetailPanelProps> = ({ edgeData, onClose }) => (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 bg-base-100 border border-base-300 rounded-lg shadow-xl p-3 min-w-[280px] max-w-[380px]">
    <div className="flex items-start justify-between gap-2 mb-2">
      <span className="font-bold text-sm">
        {edgeData.type === 'item' ? '↔ Item Link' : edgeData.type === 'energy' ? '⚡ Energy Link' : '🔗 Broken Link'}
      </span>
      <button type="button" className="btn btn-xs btn-ghost" onClick={onClose}>✕</button>
    </div>
    <div className="space-y-1 text-xs">
      {edgeData.itemName && (
        <div className="flex justify-between">
          <span className="text-base-content/70">Item</span>
          <span className="font-medium">{edgeData.itemName}</span>
        </div>
      )}
      {edgeData.ratePerMinute != null && (
        <div className="flex justify-between">
          <span className="text-base-content/70">Rate</span>
          <span className="font-mono">{Math.round(edgeData.ratePerMinute)}/min</span>
        </div>
      )}
      {edgeData.isBroken && (
        <div className="text-error font-medium">Link is broken</div>
      )}
      {edgeData.type === 'energy' && (edgeData.groupName || edgeData.groupId) && (
        <div className="flex justify-between">
          <span className="text-base-content/70">Grid</span>
          <span className="font-medium">{edgeData.groupName || edgeData.groupId}</span>
        </div>
      )}
    </div>
  </div>
);

const LogisticsCanvasInner: React.FC = () => {
  const { fitView } = useReactFlow();

  const theme = useSubscription<'light' | 'dark'>([SUB_IDS.UI_THEME]);
  const models = useSubscription<BaseLogisticsViewModel[]>([SUB_IDS.BASES_LOGISTICS_VIEW_MODELS]) || EMPTY_MODELS;
  const energyGroups = useSubscription<EnergyGroup[]>([SUB_IDS.ENERGY_GROUPS_LIST]) || EMPTY_ENERGY_GROUPS;

  // Compute base stats from bases (inline to avoid new subscription)
  const baseStatsMap = useSubscription<Record<string, BaseDetailStats> | null>([SUB_IDS.BASES_ALL_DETAIL_STATS]);

  const [selectedEdgeData, setSelectedEdgeData] = useState<EdgeDetailData | null>(null);
  // Energy grids are hidden by default — toggled via the on-canvas button.
  const [showEnergy, setShowEnergy] = useState(false);
  const activeLayers = useMemo<Set<LayerFilter>>(() => {
    const layers = new Set<LayerFilter>(['links', 'broken']);
    if (showEnergy) layers.add('energy');
    return layers;
  }, [showEnergy]);

  // Build canvas data
  const canvasData = useMemo(() => {
    if (models.length === 0) return { nodes: [], edges: [] };
    return buildLogisticsCanvasData({
      models,
      baseStats: baseStatsMap || {},
      energyGroups,
      activeLayers,
    });
  }, [models, baseStatsMap, energyGroups, activeLayers]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(canvasData.nodes);
    setEdges(canvasData.edges);
  }, [canvasData, setNodes, setEdges]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodes.length > 0) fitView({ duration: 300, padding: 0.15 });
    }, 50);
    return () => clearTimeout(timer);
  }, [models.length, fitView, nodes.length]);

  const handleNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'baseNetwork') {
      const data = node.data as unknown as { baseId: string };
      dispatch([EVENT_IDS.BASES_OPEN_BASE, data.baseId, 'base']);
    }
    setSelectedEdgeData(null);
  }, []);

  const handleEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setSelectedEdgeData((edge.data as unknown as EdgeDetailData) || null);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedEdgeData(null);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        colorMode={theme}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesConnectable={false}
        attributionPosition="bottom-left"
      >
        <Panel position="top-right">
          <button
            type="button"
            onClick={() => setShowEnergy((v) => !v)}
            aria-pressed={showEnergy}
            title={showEnergy ? 'Hide energy grids' : 'Show energy grids'}
            className={`btn btn-sm gap-1.5 shadow ${
              showEnergy ? 'btn-warning' : 'bg-base-100 border border-base-300 text-base-content/80'
            }`}
          >
            <span>⚡</span>
            <span>Energy grids: {showEnergy ? 'On' : 'Off'}</span>
          </button>
        </Panel>
        <Background />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'energyGrid') return '#f59e0b';
            return '#6366f1';
          }}
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>

      {selectedEdgeData && (
        <EdgeDetailPanel
          edgeData={selectedEdgeData}
          onClose={() => setSelectedEdgeData(null)}
        />
      )}
    </div>
  );
};

export const LogisticsCanvas: React.FC = () => (
  <ReactFlowProvider>
    <LogisticsCanvasInner />
  </ReactFlowProvider>
);
