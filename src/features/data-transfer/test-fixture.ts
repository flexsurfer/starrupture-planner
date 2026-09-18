import { createAppState } from "@/app/uklad/initial-state";
import { createPlannerTab } from "@/features/planner/state";

export function archiveFixture() {
  const state = createAppState();
  state.basesMode = "advanced";
  state.energyGroups = [
    { id: "grid", name: "Shared grid" },
    { id: "unused-grid", name: "Unused grid" },
  ];
  state.basesList = [
    {
      id: "source",
      name: "Smelting",
      coreLevel: 3,
      energyGroupId: "grid",
      buildings: [
        {
          id: "output",
          buildingTypeId: "truck",
          sectionType: "outputs",
          selectedItemId: "plate",
          ratePerMinute: 42,
        },
      ],
      productions: [],
    },
    {
      id: "target",
      name: "Assembly",
      coreLevel: 2,
      energyGroupId: "grid",
      buildings: [
        {
          id: "input",
          buildingTypeId: "truck",
          sectionType: "inputs",
          selectedItemId: "plate",
          ratePerMinute: 10,
          planningOwnerPlanId: "production",
          linkedOutput: {
            baseId: "source",
            buildingId: "output",
            itemIdSnapshot: "plate",
            ratePerMinuteSnapshot: 10,
          },
        },
        {
          id: "planned-output",
          buildingTypeId: "truck",
          sectionType: "outputs",
          sourceProductionId: "production",
          planningOwnerPlanId: "production",
          allocationMode: "fixed",
          requestedRatePerMinute: 12,
          capacityPerMinute: 60,
          priority: 1,
        },
      ],
      productions: [
        {
          id: "production",
          name: "Frames",
          selectedItemId: "frame",
          targetAmount: 20,
          active: true,
          status: "active",
          corporationLevel: { corporationId: "corp", level: 2 },
          recipeSelections: { frame: "assembler:alt" },
          requiredBuildings: [{ buildingId: "assembler", count: 2 }],
          inputs: [
            {
              id: "input",
              buildingTypeId: "truck",
              sectionType: "inputs",
              linkedOutput: { baseId: "source", buildingId: "output" },
            },
          ],
        },
      ],
    },
  ];
  state.plannerTabs = [
    {
      ...createPlannerTab("single", "Single plan", "single", "table"),
      selectedItemId: "frame",
      targetAmount: 25,
      recipeSelections: { frame: "assembler:alt" },
      selectedCorporationLevel: { corporationId: "corp", level: 2 },
      flowDirection: "BT",
      groupByStage: true,
    },
    {
      ...createPlannerTab("multi", "Multi plan", "multi"),
      multiTargets: [
        { itemId: "frame", amount: 10 },
        { itemId: "wire", amount: 30 },
      ],
    },
  ];
  return state;
}
