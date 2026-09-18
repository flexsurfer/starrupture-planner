import { useRuntime } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import { memo, useMemo } from "react";
import type { EdgeProps } from "@xyflow/react";
import { EdgeLabelRenderer, getStraightPath } from "@xyflow/react";
import type { BaseLayoutConnection } from "@/app/uklad/model";
import type { ConnectionTransferRate } from "@/features/base-layout/utils/layoutBalanceCalculator";
import { getRailCapacity } from "@/features/base-layout/utils/layoutBalanceCalculator";

interface LayoutConnectionEdgeData {
  connection: BaseLayoutConnection;
  baseId: string;
  transferRate?: ConnectionTransferRate;
  selected?: boolean;
}

const LABEL_SPACING = 180; // pixels between repeated labels
const EDGE_HIT_WIDTH = 20; // wider invisible stroke for easier interaction

const LayoutConnectionEdge = memo((props: EdgeProps) => {
  const runtime = useRuntime();
  const { sourceX, sourceY, targetX, targetY, markerEnd, id } = props;

  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  // Calculate angle of the line for rotating labels
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const edgeLength = Math.sqrt(dx * dx + dy * dy);
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  // Flip text so it's never upside-down
  const flipped = angleDeg > 90 || angleDeg < -90;
  const displayAngle = flipped ? angleDeg + 180 : angleDeg;

  // Generate repeated label positions along the edge
  const labelPositions = useMemo(() => {
    if (edgeLength < 40) return [{ x: labelX, y: labelY }];

    const count = Math.max(1, Math.floor(edgeLength / LABEL_SPACING));
    const positions: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      positions.push({
        x: sourceX + dx * t,
        y: sourceY + dy * t,
      });
    }
    // Always have at least the midpoint
    if (positions.length === 0) {
      positions.push({ x: labelX, y: labelY });
    }
    return positions;
  }, [sourceX, sourceY, dx, dy, edgeLength, labelX, labelY]);

  const data = props.data as LayoutConnectionEdgeData | undefined;

  if (!data) {
    return null;
  }

  const { connection, baseId, transferRate, selected } = data;
  const maxRate = transferRate?.maxRate ?? getRailCapacity(connection.railTier);
  const currentRate = transferRate?.currentRate ?? 0;
  const tierName = transferRate?.tierName ?? `mk${connection.railTier}`;
  const labelText = `${tierName} ${Math.round(currentRate)}/${maxRate}`;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    runtime.dispatch([
      appIds.events.BASE_LAYOUT_REMOVE_CONNECTION,
      baseId,
      connection.id,
    ]);
  };

  // Color the line based on utilisation
  const utilisation = maxRate > 0 ? currentRate / maxRate : 0;
  const strokeColor =
    utilisation >= 0.95
      ? "#f87171" // red – at capacity
      : utilisation >= 0.5
        ? "#facc15" // yellow – moderate
        : "#888"; // grey – low / idle

  return (
    <>
      {/* Invisible wider path for easier interaction */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={EDGE_HIT_WIDTH}
        className="react-flow__edge-interaction"
      />
      {/* Selection highlight glow */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={8}
          strokeOpacity={0.4}
        />
      )}
      {/* Visible path */}
      <path
        d={edgePath}
        fill="none"
        stroke={selected ? "#38bdf8" : strokeColor}
        strokeWidth={selected ? 3 : 2}
        markerEnd={typeof markerEnd === "string" ? markerEnd : undefined}
      />
      <EdgeLabelRenderer>
        {labelPositions.map((pos, i) => (
          <div
            key={`${id}-label-${i}`}
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${pos.x}px,${pos.y}px) rotate(${displayAngle}deg)`,
              pointerEvents: "all",
              whiteSpace: "nowrap",
            }}
            className="nodrag nopan"
          >
            <span
              className="text-[10px] font-mono px-1 rounded bg-base-200/80 text-base-content/90 select-none cursor-pointer"
              onDoubleClick={handleRemove}
              title="Double-click to remove"
            >
              {labelText}
            </span>
          </div>
        ))}
      </EdgeLabelRenderer>
    </>
  );
});

LayoutConnectionEdge.displayName = "LayoutConnectionEdge";

export default LayoutConnectionEdge;
