import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position as ReactFlowPosition } from '@xyflow/react';
import type { BaseLogisticsViewModel } from '../types';
import type { BaseDetailStats } from '../types';
import type { EnergyGroup } from '../../../state/db';
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

  // Build energy grid nodes — sum local generation/consumption per group
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
      dagreGraph.setNode(nodeId, { width: GRID_NODE_WIDTH, height: GRID_NODE_HEIGHT });

      // Edges from bases to grid and grid to bases (using local values)
      for (const model of models) {
        const stats = baseStats[model.baseId];
        if (stats?.energyGroupId !== groupId) continue;
        const baseNodeId = `base-${model.baseId}`;
        const gen = stats.localEnergyGeneration ?? 0;
        const cons = stats.energyConsumption ?? 0;

        if (gen > 0) {
          const edgeId = `energy-${model.baseId}-to-${groupId}`;
          edges.push({
            id: edgeId,
            source: baseNodeId,
            target: nodeId,
            type: 'default',
            animated: true,
            style: { stroke: '#f59e0b', strokeWidth: 2, strokeDasharray: '5 5' },
            label: `+${Math.round(gen)} MW`,
            labelStyle: { fontSize: 10, fill: '#f59e0b' },
            data: { type: 'energy', baseId: model.baseId, groupId } as unknown as Record<string, unknown>,
          });
          dagreGraph.setEdge(baseNodeId, nodeId);
        }
        if (cons > 0) {
          const edgeId = `energy-${groupId}-to-${model.baseId}`;
          edges.push({
            id: edgeId,
            source: nodeId,
            target: baseNodeId,
            type: 'default',
            animated: true,
            style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5 5' },
            label: `-${Math.round(cons)} MW`,
            labelStyle: { fontSize: 10, fill: '#ef4444' },
            data: { type: 'energy', baseId: model.baseId, groupId } as unknown as Record<string, unknown>,
          });
          dagreGraph.setEdge(nodeId, baseNodeId);
        }
      }
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

  // Apply dagre layout
  dagre.layout(dagreGraph);

  // Position nodes from dagre output
  for (const node of nodes) {
    const positioned = dagreGraph.node(node.id);
    if (positioned) {
      const width = node.type === 'energyGrid' ? GRID_NODE_WIDTH : BASE_NODE_WIDTH;
      const height = node.type === 'energyGrid' ? GRID_NODE_HEIGHT : BASE_NODE_HEIGHT;
      node.position = {
        x: positioned.x - width / 2,
        y: positioned.y - height / 2,
      };
      node.sourcePosition = ReactFlowPosition.Right;
      node.targetPosition = ReactFlowPosition.Left;
    }
  }

  return { nodes, edges };
}
