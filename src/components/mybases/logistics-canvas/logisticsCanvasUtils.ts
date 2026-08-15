import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position as ReactFlowPosition } from '@xyflow/react';
import type { BaseLogisticsViewModel } from '../types';
import type { BaseDetailStats } from '../types';
import type { EnergyGroup } from '@/state/db';
import type { BaseNetworkNodeData } from './BaseNetworkNode';
import type { EnergyGridNodeData } from './EnergyGridNode';

export type LayerFilter = 'links' | 'energy' | 'broken' | 'utilization';

interface BuildCanvasParams {
  models: BaseLogisticsViewModel[];
  baseStats: Record<string, BaseDetailStats>;
  energyGroups: EnergyGroup[];
  activeLayers: Set<LayerFilter>;
}

interface CanvasData {
  nodes: Node[];
  edges: Edge[];
}

const BASE_NODE_WIDTH = 260;
const BASE_NODE_HEIGHT = 200;
const GRID_NODE_WIDTH = 200;
const GRID_NODE_HEIGHT = 140;

export function buildLogisticsCanvasData({
  models,
  baseStats,
  energyGroups,
  activeLayers,
}: BuildCanvasParams): CanvasData {
  const showLinks = activeLayers.has('links');
  const showEnergy = activeLayers.has('energy');
  const showBroken = activeLayers.has('broken');

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 200, nodesep: 120 });

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const baseNodeIds = new Set(models.map((model) => `base-${model.baseId}`));

  // Build base nodes — use local energy values (not pooled) for per-base display
  for (const model of models) {
    const stats = baseStats[model.baseId];
    const localGen = stats?.localEnergyGeneration ?? 0;
    const localCons = stats?.energyConsumption ?? 0;
    const energyBalance = localGen - localCons;

    const warnings: string[] = [];
    const brokenInputs = model.incomingInputs.filter(
      (input) => input.linkedOutputStatus && input.linkedOutputStatus !== 'ok'
    );
    if (brokenInputs.length > 0) {
      warnings.push(`${brokenInputs.length} broken link${brokenInputs.length > 1 ? 's' : ''}`);
    }
    const unassignedOutputs = model.outputs.filter((output) => !output.itemId);
    if (unassignedOutputs.length > 0) {
      warnings.push(`${unassignedOutputs.length} unassigned output${unassignedOutputs.length > 1 ? 's' : ''}`);
    }
    if (stats?.isEnergyInsufficient) {
      warnings.push('Energy deficit');
    }

    const nodeData: BaseNetworkNodeData = {
      baseId: model.baseId,
      baseName: model.baseName,
      outgoingLinkCount: model.outputs.length,
      incomingInputCount: model.incomingInputs.length,
      energyGeneration: localGen,
      energyConsumption: localCons,
      energyBalance,
      energyGroupName: stats?.energyGroupName,
      hasWarnings: warnings.length > 0,
      warnings,
      outputs: model.outputs.map((output) => ({
        id: output.baseBuildingId,
        itemName: output.itemName,
        ratePerMinute: output.ratePerMinute,
        capacityPerMinute: output.capacityPerMinute,
      })),
      inputs: model.incomingInputs.map((input) => ({
        id: input.baseBuildingId,
        itemName: input.itemName,
        ratePerMinute: input.ratePerMinute,
        hasBrokenLink: !!input.linkedOutputStatus && input.linkedOutputStatus !== 'ok',
      })),
    };

    const nodeId = `base-${model.baseId}`;
    nodes.push({
      id: nodeId,
      type: 'baseNetwork',
      position: { x: 0, y: 0 },
      data: nodeData as unknown as Record<string, unknown>,
    });
    dagreGraph.setNode(nodeId, { width: BASE_NODE_WIDTH, height: BASE_NODE_HEIGHT });
  }

  // Build energy grid nodes — sum local generation/consumption per group.
  // Grids are laid out manually (floating above their member bases) rather than
  // through dagre, and each base gets a single net energy edge on dedicated
  // top/bottom handles so energy never shares a point with item links.
  const gridMembers = new Map<string, string[]>();
  if (showEnergy) {
    const groupMap = new Map<string, { generation: number; consumption: number; baseCount: number }>();
    for (const model of models) {
      const stats = baseStats[model.baseId];
      const groupId = stats?.energyGroupId;
      if (!groupId) continue;
      const existing = groupMap.get(groupId) || { generation: 0, consumption: 0, baseCount: 0 };
      existing.generation += stats.localEnergyGeneration ?? 0;
      existing.consumption += stats.energyConsumption ?? 0;
      existing.baseCount += 1;
      groupMap.set(groupId, existing);
    }

    for (const [groupId, pooled] of groupMap.entries()) {
      const group = energyGroups.find((g) => g.id === groupId);
      if (!group) continue;

      const gridNodeData: EnergyGridNodeData = {
        groupId,
        groupName: group.name,
        totalGeneration: pooled.generation,
        totalConsumption: pooled.consumption,
        balance: pooled.generation - pooled.consumption,
        baseCount: pooled.baseCount,
      };

      const nodeId = `grid-${groupId}`;
      nodes.push({
        id: nodeId,
        type: 'energyGrid',
        position: { x: 0, y: 0 },
        data: gridNodeData as unknown as Record<string, unknown>,
      });

      // One net energy edge per base: producer -> grid (orange) or grid -> consumer (red).
      const members: string[] = [];
      for (const model of models) {
        const stats = baseStats[model.baseId];
        if (stats?.energyGroupId !== groupId) continue;
        const baseNodeId = `base-${model.baseId}`;
        members.push(baseNodeId);

        const net = (stats.localEnergyGeneration ?? 0) - (stats.energyConsumption ?? 0);
        if (net === 0) continue;

        const isProducer = net > 0;
        const magnitude = Math.abs(net);
        const color = isProducer ? '#f59e0b' : '#ef4444';
        edges.push({
          id: `energy-${model.baseId}-${groupId}`,
          source: isProducer ? baseNodeId : nodeId,
          target: isProducer ? nodeId : baseNodeId,
          sourceHandle: 'energy-out',
          targetHandle: 'energy-in',
          type: 'default',
          animated: true,
          style: { stroke: color, strokeWidth: 2, strokeDasharray: '5 5' },
          label: `${isProducer ? '+' : '-'}${Math.round(magnitude)} MW`,
          labelStyle: { fontSize: 10, fill: color },
          data: { type: 'energy', baseId: model.baseId, groupId, groupName: group.name } as unknown as Record<string, unknown>,
        });
      }
      gridMembers.set(nodeId, members);
    }
  }

  // Track which broken inputs are already represented by link edges.
  const coveredBrokenInputIds = new Set<string>();

  // Build item link edges (output -> input between bases)
  if (showLinks) {
    for (const model of models) {
      for (const output of model.outputs) {
        for (const input of output.linkedInputs) {
          if (input.baseId === model.baseId) continue;

          const isBroken = !!input.linkedOutputStatus && input.linkedOutputStatus !== 'ok';
          if (!showBroken && isBroken) continue;

          if (isBroken) {
            coveredBrokenInputIds.add(`${input.baseId}:${input.baseBuildingId}`);
          }

          const sourceId = `base-${model.baseId}`;
          const targetId = `base-${input.baseId}`;
          const edgeId = `link-${model.baseId}-${output.baseBuildingId}-${input.baseId}-${input.baseBuildingId}`;

          const rate = input.ratePerMinute ?? output.ratePerMinute ?? 0;
          const itemLabel = input.itemName || output.itemName || 'item';
          const label = `${itemLabel} ${Math.round(rate)}/min`;

          edges.push({
            id: edgeId,
            source: sourceId,
            target: targetId,
            sourceHandle: 'item-out',
            targetHandle: 'item-in',
            type: 'default',
            animated: !isBroken,
            style: {
              stroke: isBroken ? '#ef4444' : '#3b82f6',
              strokeWidth: isBroken ? 2 : Math.max(1.5, Math.min(4, rate / 50)),
              strokeDasharray: isBroken ? '4 4' : undefined,
            },
            label,
            labelStyle: { fontSize: 10, fill: isBroken ? '#ef4444' : '#3b82f6' },
            data: {
              type: 'item',
              sourceBaseId: model.baseId,
              outputId: output.baseBuildingId,
              targetBaseId: input.baseId,
              inputId: input.baseBuildingId,
              itemName: input.itemName || output.itemName,
              ratePerMinute: rate,
              isBroken,
            } as unknown as Record<string, unknown>,
          });
          dagreGraph.setEdge(sourceId, targetId);
        }
      }
    }
  }

  // Draw broken links that weren't covered by item edges.
  if (showBroken) {
    for (const model of models) {
      for (const input of model.incomingInputs) {
        if (!input.linkedOutputStatus || input.linkedOutputStatus === 'ok') continue;
        if (!input.sourceBaseId) continue;

        const inputKey = `${model.baseId}:${input.baseBuildingId}`;
        if (coveredBrokenInputIds.has(inputKey)) continue;

        const sourceId = `base-${input.sourceBaseId}`;
        const targetId = `base-${model.baseId}`;
        if (!baseNodeIds.has(sourceId) || !baseNodeIds.has(targetId)) continue;

        const edgeId = `broken-${input.sourceBaseId}-${input.baseBuildingId}-${model.baseId}`;

        edges.push({
          id: edgeId,
          source: sourceId,
          target: targetId,
          sourceHandle: 'item-out',
          targetHandle: 'item-in',
          type: 'default',
          style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '4 4' },
          label: `BROKEN: ${input.itemName || 'unknown'}`,
          labelStyle: { fontSize: 10, fill: '#ef4444', fontWeight: 'bold' },
          data: {
            type: 'broken',
            sourceBaseId: input.sourceBaseId,
            targetBaseId: model.baseId,
            inputId: input.baseBuildingId,
            itemName: input.itemName,
          } as unknown as Record<string, unknown>,
        });
        dagreGraph.setEdge(sourceId, targetId);
      }
    }
  }

  // Apply dagre layout (base nodes + item links only — grids are placed manually)
  dagre.layout(dagreGraph);

  // Position base nodes from dagre output
  const basePositions = new Map<string, { x: number; y: number }>();
  for (const node of nodes) {
    if (node.type === 'energyGrid') continue;
    const positioned = dagreGraph.node(node.id);
    if (positioned) {
      node.position = {
        x: positioned.x - BASE_NODE_WIDTH / 2,
        y: positioned.y - BASE_NODE_HEIGHT / 2,
      };
      node.sourcePosition = ReactFlowPosition.Right;
      node.targetPosition = ReactFlowPosition.Left;
      basePositions.set(node.id, node.position);
    }
  }

  // Float each energy grid above the horizontal span of its member bases so its
  // vertical energy edges stay clear of the horizontal item links.
  const GRID_VERTICAL_GAP = 80;
  for (const node of nodes) {
    if (node.type !== 'energyGrid') continue;
    const memberPositions = (gridMembers.get(node.id) || [])
      .map((id) => basePositions.get(id))
      .filter((p): p is { x: number; y: number } => !!p);
    if (memberPositions.length === 0) {
      node.position = { x: 0, y: 0 };
      continue;
    }
    const avgCenterX =
      memberPositions.reduce((sum, p) => sum + p.x + BASE_NODE_WIDTH / 2, 0) / memberPositions.length;
    const minY = Math.min(...memberPositions.map((p) => p.y));
    node.position = {
      x: avgCenterX - GRID_NODE_WIDTH / 2,
      y: minY - GRID_NODE_HEIGHT - GRID_VERTICAL_GAP,
    };
  }

  return { nodes, edges };
}
