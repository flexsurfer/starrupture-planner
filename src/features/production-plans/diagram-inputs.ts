import type {
  Building,
  FlowEdge,
  FlowNode,
  ProductionFlowResult,
  RawMaterialDeficit,
} from "@/features/planner/types";

/** Adds display-only input requirements without changing the calculated production flow. */
export function addDiagramInputRequirements(
  flow: ProductionFlowResult,
  buildings: Building[],
) {
  const nodes = [...flow.nodes];
  const edges = [...flow.edges];
  const requirements = new Map<string, RawMaterialDeficit>();
  const buildingsById = new Map(
    buildings.map((building) => [building.id, building]),
  );

  for (const deficit of flow.rawMaterialDeficits ?? []) {
    if (deficit.missing <= 0) continue;
    const baseBuildingId = `required-input:${deficit.itemId}`;
    const node: FlowNode = {
      nodeType: "input",
      baseBuildingId,
      buildingId: "required-input",
      buildingName: "",
      recipeIndex: -2,
      outputItem: deficit.itemId,
      outputAmount: deficit.missing,
      buildingCount: 1,
      powerPerBuilding: 0,
      heatPerBuilding: 0,
      totalPower: 0,
      totalHeat: 0,
    };
    const from = `${node.buildingId}_${node.recipeIndex}_${node.outputItem}_${baseBuildingId}`;
    const connections: FlowEdge[] = [];

    for (const consumer of flow.nodes) {
      if (consumer.nodeType !== "production") continue;
      const recipe = buildingsById.get(consumer.buildingId)?.recipes?.[
        consumer.recipeIndex
      ];
      if (!recipe) continue;
      const required = recipe.inputs.reduce(
        (sum, input) =>
          sum +
          (input.id === deficit.itemId
            ? input.amount_per_minute * consumer.buildingCount
            : 0),
        0,
      );
      const to = `${consumer.buildingId}_${consumer.recipeIndex}_${consumer.outputItem}`;
      const supplied = flow.edges.reduce(
        (sum, edge) =>
          sum +
          (edge.to === to && edge.itemId === deficit.itemId ? edge.amount : 0),
        0,
      );
      const missing = required - supplied;
      if (missing > 0.0001)
        connections.push({ from, to, itemId: deficit.itemId, amount: missing });
    }

    nodes.push(node);
    edges.push(...connections);
    requirements.set(baseBuildingId, deficit);
  }

  return { nodes, edges, requirements };
}
