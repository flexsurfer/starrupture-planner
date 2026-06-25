import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface BaseNetworkNodeData {
  baseId: string;
  baseName: string;
  outgoingLinkCount: number;
  incomingInputCount: number;
  energyGeneration: number;
  energyConsumption: number;
  energyBalance: number;
  energyGroupName?: string;
  hasWarnings: boolean;
  warnings: string[];
  outputs: {
    id: string;
    itemName?: string;
    ratePerMinute: number;
    capacityPerMinute?: number;
  }[];
  inputs: {
    id: string;
    itemName?: string;
    ratePerMinute?: number;
    hasBrokenLink: boolean;
  }[];
}

function formatRate(value: number): string {
  if (!value || value <= 0) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export const BaseNetworkNode: React.FC<NodeProps> = memo(({ data }) => {
  const d = data as unknown as BaseNetworkNodeData;

  return (
    <div className="rounded-xl border-2 border-base-300 bg-base-100 shadow-lg min-w-[220px] max-w-[280px] overflow-hidden">
      {/* Item link handles (left = in, right = out) */}
      <Handle id="item-in" type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary" />
      <Handle id="item-out" type="source" position={Position.Right} className="!w-3 !h-3 !bg-secondary" />
      {/* Energy handles (top) — kept separate from item links so the two never share a point */}
      <Handle id="energy-in" type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-warning" style={{ left: '42%' }} />
      <Handle id="energy-out" type="source" position={Position.Top} className="!w-2.5 !h-2.5 !bg-warning" style={{ left: '58%' }} />

      {/* Header */}
      <div className={`px-3 py-2 border-b border-base-300 ${d.hasWarnings ? 'bg-warning/10' : 'bg-base-200/50'}`}>
        <div className="font-bold text-sm truncate">{d.baseName}</div>
        {d.energyGroupName && (
          <div className="text-xs text-base-content/60 truncate">⚡ {d.energyGroupName}</div>
        )}
      </div>

      {/* Stats */}
      <div className="px-3 py-2 space-y-1.5 text-xs">
        {/* Link summary */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-base-content/70">Outputs</span>
          <span className="font-mono font-medium">{d.outgoingLinkCount}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base-content/70">Inputs</span>
          <span className="font-mono font-medium">{d.incomingInputCount}</span>
        </div>

        {/* Energy */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-base-content/70">Energy</span>
          <span className={`font-mono font-medium ${d.energyBalance < 0 ? 'text-error' : 'text-success'}`}>
            {d.energyBalance >= 0 ? '+' : ''}{formatRate(d.energyBalance)} MW
          </span>
        </div>

        {/* Outputs */}
        {d.outputs.length > 0 && (
          <div className="pt-1 border-t border-base-300/50">
            <div className="text-base-content/50 mb-0.5">Outputs:</div>
            {d.outputs.slice(0, 4).map((output) => (
              <div key={output.id} className="flex items-center justify-between gap-1 pl-1">
                <span className="truncate max-w-[140px]">{output.itemName || 'unassigned'}</span>
                <span className="font-mono text-[10px]">{formatRate(output.ratePerMinute)}/min</span>
              </div>
            ))}
            {d.outputs.length > 4 && (
              <div className="text-base-content/50 pl-1">+{d.outputs.length - 4} more</div>
            )}
          </div>
        )}

        {/* Inputs */}
        {d.inputs.length > 0 && (
          <div className="pt-1 border-t border-base-300/50">
            <div className="text-base-content/50 mb-0.5">Inputs:</div>
            {d.inputs.slice(0, 4).map((input) => (
              <div key={input.id} className="flex items-center justify-between gap-1 pl-1">
                <span className={`truncate max-w-[140px] ${input.hasBrokenLink ? 'text-error' : ''}`}>
                  {input.itemName || 'empty'}{input.hasBrokenLink ? ' ✗' : ''}
                </span>
                <span className="font-mono text-[10px]">{formatRate(input.ratePerMinute || 0)}/min</span>
              </div>
            ))}
            {d.inputs.length > 4 && (
              <div className="text-base-content/50 pl-1">+{d.inputs.length - 4} more</div>
            )}
          </div>
        )}

        {/* Warnings */}
        {d.hasWarnings && (
          <div className="pt-1 border-t border-base-300/50">
            {d.warnings.slice(0, 2).map((warning, idx) => (
              <div key={idx} className="text-warning truncate">⚠ {warning}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

BaseNetworkNode.displayName = 'BaseNetworkNode';
