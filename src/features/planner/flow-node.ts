import type { PlannerFlowNode } from "./types";

/** One identity shared by demand edges, diagram nodes, and table cards. */
export function getFlowNodeId(node: PlannerFlowNode): string {
  if (node.nodeType === "target") return `target:${node.outputItem}`;
  const key = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}`;
  return node.nodeType === "input" && node.baseBuildingId
    ? `${key}_${node.baseBuildingId}`
    : key;
}

/** Each selected item ends at its special demand node or its original producer. */
export function getTargetNodeIds(
  nodes: PlannerFlowNode[],
  targetItemIds: string[],
): Set<string> {
  const targets = new Set(targetItemIds);
  const separateTargets = new Set(
    nodes
      .filter((node) => node.nodeType === "target")
      .map((node) => node.outputItem),
  );
  return new Set(
    nodes
      .filter(
        (node) =>
          node.nodeType === "target" ||
          (node.nodeType === "production" &&
            targets.has(node.outputItem) &&
            !separateTargets.has(node.outputItem)),
      )
      .map(getFlowNodeId),
  );
}
