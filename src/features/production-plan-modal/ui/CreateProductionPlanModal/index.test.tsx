import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createUkladTestHarness } from "@ukladjs/core/testing";
import { memoryStorageAdapter, persist } from "@ukladjs/persist";
import { afterEach, expect, it, vi } from "vitest";
import { appIds, stateKeys } from "@/app/uklad/catalog";
import { UkladProvider } from "@/app/uklad/bindings";
import { createAppRuntime } from "@/app/uklad/runtime";
import { registerApplicationModules } from "@/app/uklad/register";
import { CreateProductionPlanModal } from "./index";

vi.mock("./components/DiagramSection", () => ({ DiagramSection: () => null }));

const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => {
  cleanup();
  runtimes.splice(0).forEach((runtime) => runtime.dispose());
});

function setup(planning = false) {
  const runtime = createAppRuntime();
  runtimes.push(runtime);
  runtime.registerModule(registerApplicationModules);
  const harness = createUkladTestHarness(runtime);
  harness.restoreState({
    ...harness.getState(),
    basesSelectedBaseId: "base",
    basesMode: planning ? "planning" : null,
    itemsList: [
      { id: "plate", name: "Plate", type: "processed" },
      { id: "ore", name: "Ore", type: "raw" },
    ],
    itemsById: {
      plate: { id: "plate", name: "Plate", type: "processed" },
      ore: { id: "ore", name: "Ore", type: "raw" },
    },
    buildingsList: [
      { id: "package_dispatcher", name: "Rail output", type: "logistics" },
      { id: "package_receiver", name: "Rail input", type: "logistics" },
      { id: "storage", name: "Storage", type: "storage" },
      {
        id: "smelter",
        name: "Smelter",
        type: "production",
        recipes: [
          {
            output: { id: "plate", amount_per_minute: 60 },
            inputs: [{ id: "ore", amount_per_minute: 60 }],
          },
        ],
      },
    ],
    basesList: [
      {
        id: "base",
        name: "Base",
        productions: [],
        buildings: [
          {
            id: "input",
            buildingTypeId: "storage",
            sectionType: "inputs",
            selectedItemId: "ore",
            ratePerMinute: 120,
          },
        ],
      },
      {
        id: "source",
        name: "Ore base",
        productions: [],
        buildings: [
          {
            id: "output",
            buildingTypeId: "package_dispatcher",
            sectionType: "outputs",
            selectedItemId: "ore",
            ratePerMinute: 60,
            name: "Ore output",
          },
        ],
      },
    ],
  });
  const storage = memoryStorageAdapter();
  persist(runtime, { storage, keys: [stateKeys.basesList] }).hydrate();
  harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
  render(
    <UkladProvider runtime={runtime}>
      <CreateProductionPlanModal />
    </UkladProvider>,
  );
  return { harness, storage };
}

it("autosaves creation and the last keystroke before Back, then restores after reload", async () => {
  const { harness, storage } = setup();
  expect(
    screen.queryByRole("button", { name: /cancel|save|create plan/i }),
  ).not.toBeInTheDocument();
  expect(harness.getState().basesList[0].productions).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Production item"), {
    target: { value: "plate" },
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Plan name")).toHaveValue("Plate Production"),
  );
  const id = harness.getState().basesList[0].productions[0].id;
  fireEvent.change(screen.getByLabelText("Plan name"), {
    target: { value: "My plates" },
  });
  fireEvent.change(screen.getByLabelText("Target items per minute"), {
    target: { value: "125" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Back to Production" }));
  await waitFor(() =>
    expect(screen.queryByLabelText("Plan name")).not.toBeInTheDocument(),
  );
  expect(harness.getState().basesList[0].productions).toMatchObject([
    { id, name: "My plates", targetAmount: 125 },
  ]);
  expect(harness.getState().basesList[0].productions).toHaveLength(1);
  await harness.flush();

  const restored = createAppRuntime();
  runtimes.push(restored);
  persist(restored, { storage, keys: [stateKeys.basesList] }).hydrate();
  expect(
    createUkladTestHarness(restored).getState().basesList[0].productions,
  ).toMatchObject([{ id, name: "My plates", targetAmount: 125 }]);
});

it("adds and removes an external item in Planning mode and keeps a broken link removable", async () => {
  const { harness } = setup(true);
  expect(
    screen.getByRole("button", { name: "Add external item" }),
  ).toBeDisabled();
  fireEvent.change(screen.getByLabelText("Production item"), {
    target: { value: "plate" },
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Add external item" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add external item" }));
  expect(
    await screen.findByRole("dialog", { name: "Add external item" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Ore output.*Ore base/ }));
  const remove = await screen.findByRole("button", {
    name: /Remove input Ore from Ore base/,
  });
  expect(harness.getState().basesList[0].productions[0].inputs).toHaveLength(1);
  await act(async () => {
    harness.dispatchSync([appIds.events.BASES_DELETE_BASE, "source"]);
  });
  expect(screen.getByText("Link broken")).toBeInTheDocument();
  fireEvent.click(remove);
  await waitFor(() =>
    expect(harness.getState().basesList[0].productions[0].inputs).toEqual([]),
  );
  expect(
    harness
      .getState()
      .basesList[0].buildings.filter(
        (building) => building.buildingTypeId === "package_receiver",
      ),
  ).toEqual([]);
  expect(
    screen.queryByRole("button", { name: /Remove input Ore/ }),
  ).not.toBeInTheDocument();
});

it("switches modes in the editor and both input dialogs while keeping the saved plan intact", async () => {
  const { harness } = setup(true);
  fireEvent.change(screen.getByLabelText("Production item"), {
    target: { value: "plate" },
  });
  await waitFor(() =>
    expect(harness.getState().basesList[0].productions).toHaveLength(1),
  );
  const saved = harness.getState().basesList;
  fireEvent.click(screen.getByRole("switch", { name: "Advanced" }));
  expect(
    await screen.findByRole("button", { name: "Add input" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("checkbox", { name: "Match inputs" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("switch", { name: "Advanced" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Add external item" }),
  );
  const externalDialog = await screen.findByRole("dialog", {
    name: "Add external item",
  });
  fireEvent.click(
    within(externalDialog).getByRole("switch", { name: "Advanced" }),
  );
  const buildingDialog = await screen.findByRole("dialog", {
    name: "Select Building",
  });
  expect(harness.getState().basesMode).toBe("advanced");
  expect(
    within(buildingDialog).getByRole("button", { name: /Storage/ }),
  ).toBeInTheDocument();
  expect(
    within(buildingDialog).getByRole("switch", { name: "Advanced" }),
  ).toBeChecked();
  fireEvent.click(
    within(buildingDialog).getByRole("switch", { name: "Advanced" }),
  );
  const restoredDialog = await screen.findByRole("dialog", {
    name: "Add external item",
  });
  expect(harness.getState().basesMode).toBe("planning");
  expect(
    screen.queryByRole("dialog", { name: "Select Building" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    within(restoredDialog).getByRole("button", { name: "Cancel" }),
  );
  expect(screen.getByRole("switch", { name: "Advanced" })).not.toBeChecked();
  expect(harness.getState().basesList).toEqual(saved);
  expect(screen.getByLabelText("Plan name")).toHaveValue("Plate Production");
});

it("autosaves input selection and matched amount to the same plan, preserving valid data during incomplete edits", async () => {
  const { harness } = setup();
  fireEvent.change(screen.getByLabelText("Production item"), {
    target: { value: "plate" },
  });
  await waitFor(() =>
    expect(harness.getState().basesList[0].productions).toHaveLength(1),
  );
  fireEvent.click(screen.getByRole("button", { name: /Ore.*120.*Storage/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Match inputs" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Target items per minute")).toHaveValue(120),
  );
  expect(screen.getByLabelText("Target items per minute")).toBeDisabled();
  const savedPlan = harness.getState().basesList[0].productions[0];
  expect(savedPlan).toMatchObject({
    targetAmount: 120,
    inputs: [{ id: "input" }],
    requiredBuildings: [{ buildingId: "smelter", count: 2 }],
  });
  fireEvent.change(screen.getByLabelText("Plan name"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Back to Production" }));
  await waitFor(() =>
    expect(screen.queryByLabelText("Plan name")).not.toBeInTheDocument(),
  );
  expect(harness.getState().basesList[0].productions).toEqual([savedPlan]);
  await act(async () => {
    harness.dispatchSync([
      appIds.events.PRODUCTION_PLAN_MODAL_OPEN,
      savedPlan.id,
    ]);
  });
  expect(screen.getByLabelText("Plan name")).toHaveValue("Plate Production");
  fireEvent.change(screen.getByLabelText("Target items per minute"), {
    target: { value: "90" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Back to Production" }));
  await waitFor(() =>
    expect(harness.getState().basesList[0].productions).toMatchObject([
      { id: savedPlan.id, targetAmount: 90 },
    ]),
  );
});

it("selects newly added inputs and autosaves the matched rate without selecting existing inputs", async () => {
  const { harness } = setup();
  await act(async () => {
    harness.dispatchSync([
      appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM,
      "plate",
    ]);
    harness.dispatchSync([
      appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS,
      true,
    ]);
    harness.dispatchSync([
      appIds.events.BASES_ADD_BUILDINGS,
      "base",
      "storage",
      "inputs",
      1,
      "New input",
      undefined,
      "ore",
      90,
    ]);
  });
  const state = harness.getState();
  const added = state.basesList[0].buildings.find(
    (building) => building.name === "New input",
  )!;
  expect(state.productionPlanModalState.selectedInputIds).toEqual([added.id]);
  expect(state.basesList[0].productions).toMatchObject([
    { targetAmount: 90, inputs: [{ id: added.id }] },
  ]);
  expect(
    screen.getByRole("button", { name: /Ore.*90.*New input/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByLabelText("Target items per minute")).toHaveValue(90);

  await act(async () => {
    harness.dispatchSync([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
    harness.dispatchSync([
      appIds.events.BASES_ADD_BUILDINGS,
      "base",
      "storage",
      "inputs",
      1,
      "Outside editor",
      undefined,
      "ore",
      30,
    ]);
  });
  expect(harness.getState().productionPlanModalState.selectedInputIds).toEqual(
    [],
  );
  expect(harness.getState().basesList[0].productions[0].targetAmount).toBe(90);
});
