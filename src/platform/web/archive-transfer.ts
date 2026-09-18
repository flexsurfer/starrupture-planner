import type { PlannerArchive } from "@/features/data-transfer/archive";

export function downloadArchive(archive: PlannerArchive): void {
  const singleName =
    archive.bases.length + archive.plans.length === 1
      ? (archive.bases[0]?.name ?? archive.plans[0]?.name)
      : "backup";
  const name =
    singleName.replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 80) || "export";
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `rupture-planner-${name}.json`;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Let the browser consume the download before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
