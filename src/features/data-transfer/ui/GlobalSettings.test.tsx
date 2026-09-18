import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createUkladTestHarness } from "@ukladjs/core/testing";
import { afterEach, expect, it, vi } from "vitest";
import { UkladProvider } from "@/app/uklad/bindings";
import { createAppRuntime } from "@/app/uklad/runtime";
import { registerApplicationModules } from "@/app/uklad/register";
import { registerWebEffects } from "@/platform/web/effects";
import { downloadArchive } from "@/platform/web/archive-transfer";
import { archiveFixture } from "../test-fixture";
import { createArchive } from "../archive";
import { GlobalSettings } from "./GlobalSettings";
import { ExportBaseButton } from "./ExportBaseButton";

vi.mock("@/platform/web/archive-transfer", () => ({
  downloadArchive: vi.fn(),
  MAX_ARCHIVE_BYTES: 20 * 1024 * 1024,
}));
const runtimes: ReturnType<typeof createAppRuntime>[] = [];
afterEach(() => {
  cleanup();
  runtimes.splice(0).forEach((runtime) => runtime.dispose());
  vi.clearAllMocks();
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
function setup(empty = false) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  const runtime = createAppRuntime();
  runtimes.push(runtime);
  runtime.registerModule(registerApplicationModules);
  runtime.registerModule(registerWebEffects);
  const harness = createUkladTestHarness(runtime);
  if (!empty) harness.restoreState(archiveFixture());
  render(
    <UkladProvider runtime={runtime}>
      <GlobalSettings onClose={() => {}} />
      <ExportBaseButton baseId="source" name="Smelting" />
    </UkladProvider>,
  );
  return harness;
}
function upload(text: string) {
  const file = new File([text], "planner.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: async () => text });
  fireEvent.change(screen.getByLabelText("Choose a Rupture Planner export"), {
    target: { files: [file] },
  });
}

it("exports all, selected collections, and one base through the browser adapter", async () => {
  setup();
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Select all planner plans" }),
  );
  fireEvent.click(screen.getByRole("checkbox", { name: "Smelting" }));
  fireEvent.click(screen.getByRole("button", { name: "Export selected (1)" }));
  await waitFor(() => expect(downloadArchive).toHaveBeenCalledTimes(1));
  expect(vi.mocked(downloadArchive).mock.calls[0][0]).toMatchObject({
    bases: [{ id: "target" }],
    plans: [],
  });
  fireEvent.click(screen.getByRole("button", { name: "Export all" }));
  await waitFor(() => expect(downloadArchive).toHaveBeenCalledTimes(2));
  expect(vi.mocked(downloadArchive).mock.calls[1][0].bases).toHaveLength(2);
  expect(vi.mocked(downloadArchive).mock.calls[1][0].plans).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Export Smelting" }));
  await waitFor(() => expect(downloadArchive).toHaveBeenCalledTimes(3));
  expect(vi.mocked(downloadArchive).mock.calls[2][0]).toMatchObject({
    bases: [{ id: "source" }],
    plans: [],
  });
});

it("previews the file, warns about a different game version, and imports only after confirmation", async () => {
  const harness = setup();
  const archive = createArchive(archiveFixture(), {
    baseIds: ["source"],
    planIds: ["multi"],
  });
  archive.dataVersion = "earlyaccess";
  const text = JSON.stringify(archive);
  upload(text);
  await screen.findByText("Ready to import");
  expect(screen.getByText(/This file uses game data/)).toBeInTheDocument();
  expect(harness.getState().basesList).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Cancel import" }));
  await waitFor(() =>
    expect(screen.queryByText("Ready to import")).not.toBeInTheDocument(),
  );
  expect(harness.getState().basesList).toHaveLength(2);
  upload(text);
  fireEvent.click(
    await screen.findByRole("button", { name: "Import selected (2)" }),
  );
  await screen.findByText("Imported 1 base and 1 planner plan as new copies.");
  expect(harness.getState().basesList).toHaveLength(3);
  expect(harness.getState().plannerTabs).toHaveLength(3);
  expect(harness.getState().appDataVersion).toBe("update2_QoL");
  expect(harness.getState().basesList[2].id).not.toBe("source");
  expect(harness.getState().basesList[2].name).toBe("Smelting Copy");
  expect(harness.getState().plannerTabs[2].name).toBe("Multi plan Copy");
});

it("keeps import available with no saved data and reports invalid files without changes", async () => {
  const harness = setup(true);
  expect(screen.getByRole("button", { name: "Export all" })).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Export selected (0)" }),
  ).toBeDisabled();
  expect(
    screen.getByLabelText("Choose a Rupture Planner export"),
  ).toBeEnabled();
  upload("{bad file");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This is not a valid JSON file.",
  );
  expect(harness.getState().basesList).toHaveLength(0);
  expect(harness.getState().plannerTabs).toHaveLength(0);
});

it("lets users select import entries independently of export and disables an empty import", async () => {
  const harness = setup();
  upload(
    JSON.stringify(
      createArchive(archiveFixture(), { baseIds: null, planIds: null }),
    ),
  );
  const preview = within(
    await screen.findByRole("region", { name: "Import preview" }),
  );
  expect(
    preview.getByRole("button", { name: "Import selected (4)" }),
  ).toBeEnabled();
  fireEvent.click(preview.getByRole("checkbox", { name: "Select all bases" }));
  fireEvent.click(
    preview.getByRole("checkbox", { name: "Select all planner plans" }),
  );
  expect(
    preview.getByRole("button", { name: "Import selected (0)" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Export selected (4)" }),
  ).toBeEnabled();
  fireEvent.click(preview.getByRole("checkbox", { name: "Assembly" }));
  fireEvent.click(preview.getByRole("checkbox", { name: "Multi plan" }));
  expect(
    preview.getByRole("checkbox", { name: "Select all bases" }),
  ).toBePartiallyChecked();
  fireEvent.click(preview.getByRole("button", { name: "Import selected (2)" }));
  await screen.findByText("Imported 1 base and 1 planner plan as new copies.");
  expect(harness.getState().basesList.map((base) => base.name)).toEqual([
    "Smelting",
    "Assembly",
    "Assembly Copy",
  ]);
  expect(harness.getState().plannerTabs.map((plan) => plan.name)).toEqual([
    "Single plan",
    "Multi plan",
    "Multi plan Copy",
  ]);
  expect(
    screen.queryByRole("region", { name: "Import preview" }),
  ).not.toBeInTheDocument();
});

it("resets import selections when another file is chosen", async () => {
  setup();
  upload(
    JSON.stringify(
      createArchive(archiveFixture(), { baseIds: null, planIds: null }),
    ),
  );
  const preview = within(
    await screen.findByRole("region", { name: "Import preview" }),
  );
  fireEvent.click(preview.getByRole("checkbox", { name: "Select all bases" }));
  fireEvent.click(
    preview.getByRole("checkbox", { name: "Select all planner plans" }),
  );
  expect(
    preview.getByRole("button", { name: "Import selected (0)" }),
  ).toBeDisabled();
  upload(
    JSON.stringify(
      createArchive(archiveFixture(), { baseIds: ["source"], planIds: [] }),
    ),
  );
  expect(
    await screen.findByRole("button", { name: "Import selected (1)" }),
  ).toBeEnabled();
  const nextPreview = within(
    screen.getByRole("region", { name: "Import preview" }),
  );
  expect(nextPreview.getByRole("checkbox", { name: "Smelting" })).toBeChecked();
  expect(
    nextPreview.queryByRole("checkbox", { name: "Assembly" }),
  ).not.toBeInTheDocument();
});
