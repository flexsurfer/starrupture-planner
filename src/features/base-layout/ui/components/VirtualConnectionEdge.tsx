import { memo } from "react";
import type { EdgeProps } from "@xyflow/react";
import { EdgeLabelRenderer, getStraightPath } from "@xyflow/react";
import type { VirtualEdge } from "@/features/base-layout/utils/layoutBalanceCalculator";

interface VirtualConnectionEdgeData {
  virtualEdge: VirtualEdge;
}

const VirtualConnectionEdge = memo((props: EdgeProps) => {
  const { sourceX, sourceY, targetX, targetY, markerEnd } = props;
  const data = props.data as VirtualConnectionEdgeData | undefined;
  if (!data) return null;

  const { virtualEdge } = data;
  const [edgePath, labelX, labelY] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const fulfillment =
    virtualEdge.maxRate > 0 ? virtualEdge.rate / virtualEdge.maxRate : 1;
  const strokeColor =
    fulfillment >= 0.99
      ? "#a78bfa" // purple – fully satisfied
      : fulfillment >= 0.5
        ? "#facc15" // yellow – partial
        : "#f87171"; // red – severe shortage

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={2}
        strokeDasharray="6 4"
        markerEnd={typeof markerEnd === "string" ? markerEnd : undefined}
        style={{ pointerEvents: "none" }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "none",
          }}
          className="nodrag nopan"
        >
          <span
            className="text-[10px] font-mono px-1 rounded select-none"
            style={{ color: strokeColor, background: "rgba(15,15,20,0.75)" }}
          >
            {Math.round(virtualEdge.rate)}/{Math.round(virtualEdge.maxRate)}/min
          </span>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

VirtualConnectionEdge.displayName = "VirtualConnectionEdge";
export default VirtualConnectionEdge;
