import React, { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface EnergyGridNodeData {
  groupId: string;
  groupName: string;
  totalGeneration: number;
  totalConsumption: number;
  balance: number;
  baseCount: number;
}

function formatMW(value: number): string {
  if (!value) return '0';
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export const EnergyGridNode: React.FC<NodeProps> = memo(({ data }) => {
  const d = data as unknown as EnergyGridNodeData;
  const isDeficit = d.balance < 0;

  return (
    <div className={`rounded-xl border-2 shadow-lg min-w-[180px] overflow-hidden ${
      isDeficit ? 'border-error/60 bg-error/5' : 'border-warning/60 bg-warning/5'
    }`}>
      {/* Energy handles on the bottom — grid floats above its member bases */}
      <Handle id="energy-in" type="target" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-warning" style={{ left: '42%' }} />
      <Handle id="energy-out" type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-warning" style={{ left: '58%' }} />

      {/* Header */}
      <div className="px-3 py-2 border-b border-warning/30 bg-warning/10">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">⚡</span>
          <span className="font-bold text-sm truncate">{d.groupName}</span>
        </div>
        <div className="text-xs text-base-content/60">{d.baseCount} bases</div>
      </div>

      {/* Stats */}
      <div className="px-3 py-2 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-base-content/70">Generated</span>
          <span className="font-mono font-medium text-success">+{formatMW(d.totalGeneration)} MW</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base-content/70">Consumed</span>
          <span className="font-mono font-medium text-error">-{formatMW(d.totalConsumption)} MW</span>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-warning/30">
          <span className="font-medium">Balance</span>
          <span className={`font-mono font-bold ${isDeficit ? 'text-error' : 'text-success'}`}>
            {d.balance >= 0 ? '+' : ''}{formatMW(d.balance)} MW
          </span>
        </div>
      </div>
    </div>
  );
});

EnergyGridNode.displayName = 'EnergyGridNode';
