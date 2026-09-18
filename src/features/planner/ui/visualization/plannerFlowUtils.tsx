import type { Node, Edge } from "@xyflow/react";
import type {
  Item,
  FlowNode,
  FlowEdge,
  RawMaterialDeficit,
} from "@/features/planner/types";
import {
  buildPlannerFlowGraph,
  type PlannerFlowDirection,
} from "@/features/planner/flow-graph";
import { NodeCard } from "./NodeCard";

export interface FlowDataGenerationParams {
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
  items: Item[];
  onSelectRecipe?: (itemId: string, recipeKey: string) => void;
  direction?: PlannerFlowDirection;
  targetItemId?: string;
  inputRequirements?: ReadonlyMap<string, RawMaterialDeficit>;
  showMissingInputs?: boolean;
}

export interface FlowData {
  nodes: Node[];
  edges: Edge[];
}

/** Render embedded diagrams with the planner's default layout and edge styles. */
export const generateReactFlowData = ({
  flowNodes,
  flowEdges,
  items,
  onSelectRecipe,
  direction = "LR",
  targetItemId,
  inputRequirements,
  showMissingInputs = false,
}: FlowDataGenerationParams): FlowData => {
  const graph = buildPlannerFlowGraph(
    flowNodes,
    flowEdges,
    items,
    [],
    direction,
  );
  return {
    nodes: graph.nodes.map(({ flowNode, outputColor, ...node }) => ({
      ...node,
      style: {
        ...node.style,
        padding: 0,
        ...(flowNode.nodeType !== "launcher" &&
          flowNode.outputItem === targetItemId && {
            borderColor: "var(--color-primary)",
          }),
        ...(flowNode.nodeType === "input" &&
          showMissingInputs &&
          inputRequirements?.has(flowNode.baseBuildingId ?? "") && {
            borderColor: "var(--color-error)",
          }),
      },
      data: {
        label: (
          <NodeCard
            node={flowNode}
            items={items}
            onSelectRecipe={onSelectRecipe}
            outputColor={outputColor}
            inputRequirement={
              flowNode.nodeType === "input"
                ? inputRequirements?.get(flowNode.baseBuildingId ?? "")
                : undefined
            }
            showMissingInput={showMissingInputs}
          />
        ),
      },
    })),
    edges: graph.edges,
  };
};
