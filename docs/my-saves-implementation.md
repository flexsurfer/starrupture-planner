# My Saves foundation

The user imports a StarRupture save and sees Cores, their individual buildings,
local extraction, incoming supplies and outgoing shipments. Updating a workspace
replaces its snapshot. User objectives live outside the snapshot.

## Rules

- Assign every supported building to the nearest Core using 3D distance during
  decoding. All Cores participate; bounding boxes are irrelevant. Equal distances
  choose the lowest Core ID. Missing positions or buildings without any Core fail
  import, since ownership cannot be determined.
- A Core's identity is its entity ID plus `SpawnServerTimeSeconds`, scoped to its
  workspace. Missing, invalid or ambiguous identity fails import. Preserve the
  numeric timestamp without rounding. The pair is our reconciliation rule; its
  stability across multiple real saves has not yet been independently verified.
- Keep each building separately, including extractors, dispatchers and receivers.
  Names, building versions and extractor node purities must not be lost through
  aggregation. Counts and resource totals are derived for presentation.
- Store app building/item/recipe IDs. The building ID includes its version. Keep
  production recipe IDs to distinguish alternatives producing the same item.
  For extractors, item and node purity provide the inputs to nominal rate lookup.
- Cargo connections pair one dispatcher with one receiver. Duplicate receivers,
  missing endpoints and invalid endpoint types fail import. Unlinked dispatchers
  retain their selected item. Requested cargo quantities are not throughput.
- Keep a nullable power-network ID on both Cores and buildings. Derive shared Core
  groups and power totals by network. Spatial ownership must never join grids.
- Keep each Core's zero-based upgrade level from `BaseCoreReplicationHelperSaveData`.
  Derive its heat limit from the catalog level plus its assigned amplifiers. Missing
  or conflicting levels stay unknown; cards show levels starting from one, heat
  load against capacity, and separate energy gauges for each electrical network.
- Ignore running state, inventories, coordinates after association, raw fragments,
  source diagnostics and unrelated entities. Unknown supported configuration is
  nullable; never guess an item, recipe, rate or power network.
- Derive nominal rates from the currently selected game data in application state,
  shared with Planner. Version-specific save metadata is loaded with those catalogs. Cargo uses the existing 240/min planning default per pair;
  launchers use 10/min. These are not measured production rates. No totals or
  copied catalogs are persisted inside workspaces.
- Re-import builds a complete replacement before adoption. Keep settings only for
  matching Core keys, drop settings for absent/rebuilt Cores, and retain workspace
  name and tab position. Selection survives only if the selected Core key survives.
  Failed, cancelled, superseded or removed-target imports leave existing work intact.

## Data contract

`snapshot.ts` is the app-owned contract. It has no decoder dependencies.

```ts
SaveSnapshot = {
  schemaVersion: 3,
  gameData: { version, revision },
  savedAt,
  cores: [{
    id, spawnTimeSeconds, name, level, powerNetworkId,
    buildings: [{ id, buildingTypeId, name, powerNetworkId, configuration }]
  }]
}

configuration =
  | { kind: 'production', recipeId }
  | { kind: 'extractor', itemId, nodePurity }
  | { kind: 'dispatcher', itemId, receiverId }
  | { kind: 'receiver' }
  | { kind: 'launcher', itemId }
  | { kind: 'other' }

SaveWorkspace = {
  schemaVersion: 3, id, name, snapshot,
  coreSettings: { [coreKey]: { objective } }
}
```

Building and network IDs are references within a snapshot. Only Core keys are
used to preserve intent across imports. Coordinates are used transiently; they
are not available for later map rendering or ownership overrides.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `features/saves/reader.ts` | Validate file extension/size and read bytes. No save parsing. |
| `features/saves/decoder/` | Bounded decompression, JSON/fragment parsing, exact asset mappings, nearest-Core assignment and app snapshot construction. No state or storage. |
| `features/saves/snapshot.ts` | Minimal app contract and Core key. |
| `features/saves/game-data.ts` | Pure indexes over selected state catalogs and version-specific extraction metadata. |
| `features/saves/overview.ts` | Pure resource, building, heat and electricity projections. |
| `features/saves/workspace.ts` | Replacement and Core-settings retention. |
| `features/saves/storage-schema.ts` | Whitelist/detach data, validate references and enforce storage budgets. |
| `features/saves/events.ts`, `subscriptions.ts` | Existing Uklad state ownership and event/subscription flow. |
| `platform/shared/save-import-effects.ts` | Cancellation and completion/error dispatch. |
| `platform/web/save-import*.ts`, `platform/headless/effects.ts` | Platform IO and decoding adapters; web decoding runs in a worker. |
| `platform/web/saves-storage.ts` | Fresh storage namespace and isolated handling of corrupt Saves entries. |

The path is **file → reader → decoder → validated snapshot → workspace → projections**.
The worker and headless adapter receive the selected catalogs captured from state
and load mappings for that version. Mapping and catalog hashes are checked before
use; the stored revision records the import dataset. Switching catalogs cancels
in-flight imports and recomputes existing overviews without rewriting workspaces.
Hydration checks structure and internal references without requiring catalogs; new
imports and objectives are also validated against loaded state. Missing catalog
entries remain stored and have unknown statistics. Only versions with compatible
save mappings can decode new saves. No raw save crosses into app state.

## Persistence and limits

The application retains its single synchronous Uklad Persist attachment. Saves
use `starrupture-planner/saves-v3/`; experimental storage entries are ignored, not
migrated. Other app roots retain their existing keys.

Corrupt Saves entries are preserved and Saves editing is blocked for that load;
other settings can still persist. Normal edits remain synchronous. Limits are
32 MiB compressed, 128 MiB decoded, 100,000 supported/source entities, 10 million
nearest-Core comparisons, and a 30-second browser import timeout. Persisted data
is limited to eight workspaces, 1 MiB per workspace and 3 MiB for the collection,
measured conservatively as UTF-16 storage strings.

## Evidence and tests

The available local sample (`6.sav`, game version 0.3.5) contains 6,220 entities.
The refactored decoder retains all nine Cores and 232 supported buildings. Its
workspace occupies approximately 64 KB as a localStorage string, versus roughly
657 KB before the refactor. This is one sample, not a compatibility guarantee.

`decoder/fixtures/observed-0.3.5.json` is a sanitized 18-entity subset: IDs were
remapped, custom names/timestamps omitted and positions replaced with synthetic
coordinates. It preserves source recipe, transport and electricity shapes but
omits Core placement identity. A direct import therefore correctly fails; the
worker integration test explicitly supplies a synthetic identity to test the
remaining fields. Neither this fixture nor synthetic consecutive snapshots prove
Core identity stability across real saves.

Focused tests cover the minimal contract, nearest ownership/ties, identity errors,
individual extractors and transport, recipe alternatives, independent grids,
replacement/settings retention, cancellation, stale results, UI update flow,
size budgets, persistence round trips and corruption isolation. The measurement
script accepts a local `.sav` path and prints only counts, sizes and timings.

## Subsequent work

Build production planning as a separate layer over snapshots and Core settings:
corporation, intermediate-resource and mission objectives; supply-aware recipe
calculations; then building changes needed to reach the objective. Objectives
are currently stored but do not calculate a rework plan. Preserve the existing
Planner and My Bases state and behavior throughout that work.
