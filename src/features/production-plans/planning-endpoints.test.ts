import { createUkladTestHarness } from "@ukladjs/core/testing";
import { afterEach, expect, it } from "vitest";
import { appIds } from "@/app/uklad/catalog";
import type { AppState } from "@/app/uklad/model";
import { createAppRuntime } from "@/app/uklad/runtime";
import { registerApplicationModules } from "@/app/uklad/register";
import { normalizeBases } from "@/platform/web/legacy-storage/bases-storage";
import {
  getFlowInputBuildings,
  resolveLinkedOutput,
} from "@/utils/productionPlanInputs";
import { resolveOutputBuilding } from "@/utils/planOutputAllocations";
import { canUsePlanningOutput } from "./planning-endpoints";

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => runtimes.splice(0).forEach((runtime) => runtime.dispose()));

function setup(mode: AppState["basesMode"] = "planning") {
  const runtime = createAppRuntime();
  runtimes.push(runtime);
  runtime.registerModule(registerApplicationModules);
  const harness = createUkladTestHarness(runtime);
  harness.restoreState({
    ...harness.getState(),
    basesMode: mode,
    itemsList: [
      { id: "ore", name: "Ore", type: "raw" },
      { id: "plate", name: "Plate", type: "processed" },
      { id: "wire", name: "Wire", type: "processed" },
    ],
    buildingsList: [
      { id: "package_dispatcher", name: "Rail output", type: "logistics" },
      { id: "package_receiver", name: "Rail input", type: "logistics" },
      {
        id: "smelter",
        name: "Smelter",
        type: "production",
        recipes: [
          {
            output: { id: "plate", amount_per_minute: 60 },
            inputs: [{ id: "ore", amount_per_minute: 60 }],
          },
          {
            output: { id: "wire", amount_per_minute: 30 },
            inputs: [{ id: "plate", amount_per_minute: 60 }],
          },
        ],
      },
    ],
    basesList: ["source", "consumer", "third"].map((id) => ({
      id,
      name: id,
      productions: [],
      buildings: [],
    })),
  });
  const base = (id: string) =>
    harness.getState().basesList.find((base) => base.id === id)!;
  const createPlan = (baseId: string, item: string) => {
    harness.dispatchSync([appIds.events.BASES_SET_SELECTED_BASE, baseId]);
    harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
    harness.dispatchSync([
      appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM,
      item,
    ]);
    return base(baseId).productions.at(-1)!;
  };
  return { harness, base, createPlan };
}

it("creates one owned output, follows edits and rail capacity, and retains ownership through storage normalization", () => {
  const { harness, base, createPlan } = setup();
  const plan = createPlan("source", "plate");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME,
    "Plates",
  ]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT,
    300,
  ]);
  expect(base("source").buildings).toHaveLength(1);
  const output = base("source").buildings[0];
  expect(output).toMatchObject({
    buildingTypeId: "package_dispatcher",
    planningOwnerPlanId: plan.id,
    sourceProductionId: plan.id,
    name: "Plates output",
  });
  expect(resolveOutputBuilding(output, base("source"))).toMatchObject({
    selectedItemId: "plate",
    ratePerMinute: 200,
  });
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT,
    90,
  ]);
  expect(
    resolveOutputBuilding(base("source").buildings[0], base("source"))
      .ratePerMinute,
  ).toBe(90);
  createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  const restored = normalizeBases(
    JSON.parse(JSON.stringify(harness.getState().basesList)),
  );
  expect(restored[0].buildings[0].planningOwnerPlanId).toBe(plan.id);
  const input = restored[1].buildings.find(
    (building) => building.sectionType === "inputs",
  )!;
  expect(input.planningOwnerPlanId).toBe(restored[1].productions[0].id);
  expect(restored[1].productions[0].inputs?.[0].planningOwnerPlanId).toBe(
    input.planningOwnerPlanId,
  );
  expect(
    getFlowInputBuildings(restored[1].productions[0].inputs, restored),
  ).toHaveLength(1);
});

it("claims only free outputs, selects the receiver, and frees the source on removal", () => {
  const { harness, base, createPlan } = setup();
  createPlan("source", "plate");
  const output = base("source").buildings[0];
  const consumer = createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  const input = base("consumer").buildings.find(
    (building) => building.sectionType === "inputs",
  )!;
  expect(input).toMatchObject({
    buildingTypeId: "package_receiver",
    planningOwnerPlanId: consumer.id,
    linkedOutput: { baseId: "source", buildingId: output.id },
  });
  expect(base("consumer").productions[0].inputs).toMatchObject([
    { id: input.id },
  ]);
  expect(base("consumer").productions[0].requiredBuildings).toEqual([
    { buildingId: "smelter", count: 1 },
  ]);
  const third = createPlan("third", "wire");
  expect(
    canUsePlanningOutput(
      harness.getState().basesList,
      base("source"),
      output,
      "third",
      third,
    ),
  ).toBe(false);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  expect(
    base("third").buildings.filter(
      (building) => building.sectionType === "inputs",
    ),
  ).toEqual([]);
  harness.dispatchSync([appIds.events.BASES_SET_SELECTED_BASE, "consumer"]);
  harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, consumer.id]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    input.id,
  ]);
  expect(
    base("consumer").buildings.some((building) => building.id === input.id),
  ).toBe(false);
  expect(base("consumer").productions[0].inputs).toEqual([]);
  expect(
    canUsePlanningOutput(
      harness.getState().basesList,
      base("source"),
      output,
      "third",
      third,
    ),
  ).toBe(true);
});

it("deletes owned endpoints without stale downstream supply, leaving the downstream plan removable", () => {
  const { harness, base, createPlan } = setup();
  const source = createPlan("source", "plate");
  const output = base("source").buildings[0];
  const consumer = createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_DELETE_SECTION,
    "source",
    source.id,
  ]);
  expect(base("source").buildings).toEqual([]);
  expect(base("consumer").productions).toHaveLength(1);
  expect(
    getFlowInputBuildings(
      base("consumer").productions[0].inputs,
      harness.getState().basesList,
    ),
  ).toEqual([]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME,
    "Still here",
  ]);
  expect(base("consumer").productions[0].inputs).toHaveLength(1);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_DELETE_SECTION,
    "consumer",
    consumer.id,
  ]);
  expect(base("consumer").buildings).toEqual([]);
});

it("preserves manual output allocations without rewriting existing plan snapshots", () => {
  const { harness, base, createPlan } = setup();
  const source = createPlan("source", "plate");
  const output = base("source").buildings[0];
  const consumer = createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  const input = base("consumer").buildings.find(
    (building) => building.sectionType === "inputs",
  )!;
  const beforeSwitch = harness.getState().basesList;
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "advanced"]);
  expect(harness.getState().basesList).toEqual(beforeSwitch);
  harness.dispatchSync([
    appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
    "source",
    output.id,
    {
      sourceProductionId: source.id,
      allocationMode: "fixed",
      requestedRatePerMinute: 20,
    },
  ]);
  const savedInputSnapshot = structuredClone(
    base("consumer").productions[0].inputs?.[0],
  );
  harness.dispatchSync([
    appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
    "consumer",
    input.id,
    "plate",
    10,
  ]);
  expect(base("consumer").productions[0].inputs?.[0]).toEqual(
    savedInputSnapshot,
  );
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "planning"]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    input.id,
  ]);
  expect(
    base("consumer").buildings.find((building) => building.id === input.id),
  ).toBeDefined();
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_DELETE_SECTION,
    "consumer",
    consumer.id,
  ]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_DELETE_SECTION,
    "source",
    source.id,
  ]);
  expect(base("consumer").buildings.map((building) => building.id)).toEqual([
    input.id,
  ]);
  expect(base("source").buildings.map((building) => building.id)).toEqual([
    output.id,
  ]);
});

it("does not add outputs to Advanced plans or recreate an output removed manually", () => {
  const { harness, base, createPlan } = setup("advanced");
  const old = createPlan("source", "plate");
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "planning"]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME,
    "Existing plan",
  ]);
  expect(base("source").productions[0].id).toBe(old.id);
  expect(base("source").buildings).toEqual([]);
  createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.BASES_REMOVE_BUILDING,
    base("consumer").buildings[0].id,
  ]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT,
    40,
  ]);
  expect(base("consumer").buildings).toEqual([]);
});

it("rejects cyclic connections and stops automatic inputs when the source changes item", () => {
  const { harness, base, createPlan } = setup();
  const source = createPlan("source", "plate");
  const output = base("source").buildings[0];
  createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  const consumerOutput = base("consumer").buildings[0];
  expect(
    canUsePlanningOutput(
      harness.getState().basesList,
      base("consumer"),
      consumerOutput,
      "source",
      source,
    ),
  ).toBe(false);
  harness.dispatchSync([appIds.events.BASES_SET_SELECTED_BASE, "source"]);
  harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, source.id]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM,
    "wire",
  ]);
  const input = base("consumer").productions[0].inputs![0];
  expect(resolveLinkedOutput(input, harness.getState().basesList).status).toBe(
    "item-changed",
  );
  expect(getFlowInputBuildings([input], harness.getState().basesList)).toEqual(
    [],
  );
});

it("removes saved input snapshots when a receiver is deleted manually", () => {
  const { harness, base, createPlan } = setup();
  createPlan("source", "plate");
  const output = base("source").buildings[0];
  createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  const input = base("consumer").productions[0].inputs![0];
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "advanced"]);
  harness.dispatchSync([appIds.events.BASES_REMOVE_BUILDING, input.id]);
  expect(base("consumer").productions[0].inputs).toEqual([]);
  expect(harness.getState().productionPlanModalState.selectedInputIds).toEqual(
    [],
  );
});

it("keeps an input shared in Advanced mode when its original owner is deleted", () => {
  const { harness, base, createPlan } = setup();
  createPlan("source", "plate");
  const output = base("source").buildings[0];
  const owner = createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  const input = base("consumer").productions[0].inputs![0];
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "advanced"]);
  const other = createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    input.id,
  ]);
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "planning"]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_DELETE_SECTION,
    "consumer",
    owner.id,
  ]);
  expect(
    base("consumer").buildings.find((building) => building.id === input.id)
      ?.planningOwnerPlanId,
  ).toBeUndefined();
  expect(base("consumer").productions[0].id).toBe(other.id);
  expect(
    base("consumer").productions[0].inputs?.[0].planningOwnerPlanId,
  ).toBeUndefined();
  expect(
    getFlowInputBuildings(
      base("consumer").productions[0].inputs,
      harness.getState().basesList,
    ),
  ).toHaveLength(1);
});

it("removes the owned input even while the plan name edit is incomplete", () => {
  const { harness, base, createPlan } = setup();
  createPlan("source", "plate");
  const output = base("source").buildings[0];
  createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    output.id,
  ]);
  const input = base("consumer").productions[0].inputs![0];
  harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, ""]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    input.id,
  ]);
  expect(
    base("consumer").buildings.some((building) => building.id === input.id),
  ).toBe(false);
  expect(base("consumer").productions[0].inputs).toEqual([]);
});

it("checks saved dependencies after a receiver is manually disconnected", () => {
  const { harness, base, createPlan } = setup();
  const source = createPlan("source", "plate");
  const sourceOutput = base("source").buildings[0];
  createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    sourceOutput.id,
  ]);
  const consumerOutput = base("consumer").buildings[0];
  const savedInput = base("consumer").productions[0].inputs![0];

  harness.dispatchSync([appIds.events.BASES_SET_MODE, "advanced"]);
  harness.dispatchSync([
    appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
    "consumer",
    savedInput.id,
    "plate",
    60,
  ]);
  expect(base("consumer").productions[0].inputs![0]).toEqual(savedInput);
  expect(
    getFlowInputBuildings(
      base("consumer").productions[0].inputs,
      harness.getState().basesList,
    ),
  ).toHaveLength(1);
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "planning"]);
  harness.dispatchSync([appIds.events.BASES_SET_SELECTED_BASE, "source"]);
  harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, source.id]);

  expect(
    canUsePlanningOutput(
      harness.getState().basesList,
      base("consumer"),
      consumerOutput,
      "source",
      source,
    ),
  ).toBe(false);
  expect(
    harness.getSubscriptionValue([
      appIds.subscriptions.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS,
    ]),
  ).not.toEqual(
    expect.arrayContaining([
      expect.objectContaining({ baseBuildingId: consumerOutput.id }),
    ]),
  );
  const before = harness.getState();
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "consumer",
    consumerOutput.id,
  ]);
  expect(harness.getState()).toEqual(before);
});

it("validates existing linked inputs in Planning mode while allowing safe reuse and removal", () => {
  const { harness, base, createPlan } = setup();
  const source = createPlan("source", "plate");
  const sourceOutput = base("source").buildings[0];
  createPlan("consumer", "wire");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
    "source",
    sourceOutput.id,
  ]);
  const consumerOutput = base("consumer").buildings[0];
  createPlan("third", "wire");
  const thirdOutput = base("third").buildings[0];
  const state = harness.getState();
  harness.restoreState({
    ...state,
    basesList: state.basesList.map((candidate) =>
      candidate.id !== "source"
        ? candidate
        : {
            ...candidate,
            buildings: [
              ...candidate.buildings,
              ...[
                {
                  id: "cyclic-input",
                  baseId: "consumer",
                  outputId: consumerOutput.id,
                },
                { id: "safe-input", baseId: "third", outputId: thirdOutput.id },
                {
                  id: "self-input",
                  baseId: "source",
                  outputId: sourceOutput.id,
                },
              ].map((input) => ({
                id: input.id,
                buildingTypeId: "package_receiver",
                sectionType: "inputs",
                selectedItemId: input.id === "self-input" ? "plate" : "wire",
                ratePerMinute: 30,
                linkedOutput: {
                  baseId: input.baseId,
                  buildingId: input.outputId,
                },
              })),
            ],
          },
    ),
  });
  harness.dispatchSync([appIds.events.BASES_SET_SELECTED_BASE, "source"]);
  harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, source.id]);
  const visibleInputIds = () =>
    harness
      .getSubscriptionValue([
        appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA,
      ])
      .inputItems.map((input) => input.baseBuildingId);
  expect(visibleInputIds()).toEqual(["safe-input"]);
  const before = harness.getState();
  for (const inputId of ["cyclic-input", "self-input"]) {
    harness.dispatchSync([
      appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
      inputId,
    ]);
    expect(harness.getState()).toEqual(before);
  }
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    "safe-input",
  ]);
  expect(
    base("source").productions[0].inputs?.map((input) => input.id),
  ).toEqual(["safe-input"]);
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    "safe-input",
  ]);
  expect(base("source").productions[0].inputs).toEqual([]);

  // Advanced mode still exposes manual configuration; switching modes must not trap a selected input.
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "advanced"]);
  expect(visibleInputIds()).toEqual(
    expect.arrayContaining(["cyclic-input", "safe-input", "self-input"]),
  );
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    "cyclic-input",
  ]);
  expect(
    harness.getState().productionPlanModalState.selectedInputIds,
  ).toContain("cyclic-input");
  harness.dispatchSync([appIds.events.BASES_SET_MODE, "planning"]);
  expect(visibleInputIds()).toContain("cyclic-input");
  harness.dispatchSync([
    appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT,
    "cyclic-input",
  ]);
  expect(
    harness.getState().productionPlanModalState.selectedInputIds,
  ).not.toContain("cyclic-input");
  expect(visibleInputIds()).not.toContain("cyclic-input");
});
