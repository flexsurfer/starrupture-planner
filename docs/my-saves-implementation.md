# My Saves foundation

The user imports a StarRupture save and sees Cores, their individual buildings,
local extraction, incoming supplies and outgoing shipments. Updating a workspace
replaces its snapshot. Workspace and Core-settings data structures remain unchanged;
the UI exposes one active save, with no workspace tabs or renaming. Production
objective controls are deferred. The centered first-import panel identifies the
experimental feature and its tested combination: Update 2 QoL data / StarRupture
0.3.5 saves. Once imported, a compact borderless bar shows Overview/Map/Power networks tabs, the
saved timestamp, Update, and Remove with confirmation. Overview cards show heat
beside the Core name, visually separate extraction from deliveries, omit empty
shipment sections, and open the full Core view with View details. Power networks
appear in the expanded Core view and a dedicated save-wide tab. The Power networks
tab lists each known network, its nominal power totals, and building counts grouped
by owning Core. Directly connected Cores with no buildings on that network appear
with zero buildings; buildings with unknown network IDs are excluded. Core names
open their detail view. Corporation shipment summaries and building previews are
omitted from overview cards.

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
- Retain finite XYZ world positions on each Core and building for the snapshot map.
- Retain valid Core `CachedBoundingBox` minimum/maximum XYZ coordinates for display.
  Missing, ambiguous or invalid source bounds stay unknown and never affect ownership.
- Ignore running state, inventories, raw fragments,
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
  schemaVersion: 4,
  gameData: { version, revision },
  savedAt,
  cores: [{
    id, spawnTimeSeconds, name, level, powerNetworkId, position: { x, y, z },
    bounds: { min: { x, y, z }, max: { x, y, z } } | null,
    buildings: [{ id, buildingTypeId, name, powerNetworkId, position: { x, y, z }, configuration }]
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
  schemaVersion: 4, id, name, snapshot,
  coreSettings: { [coreKey]: { objective } }
}
```

Building and network IDs are references within a snapshot. Only Core keys are
used to preserve intent across imports. Coordinates retain their original units
and precision; they support map rendering without changing spatial ownership.

## Module boundaries

| Module | Responsibility |
| --- | --- |
| `features/saves/reader.ts` | Validate file extension/size and read bytes. No save parsing. |
| `features/saves/decoder/` | Bounded decompression, JSON/fragment parsing, exact asset mappings, nearest-Core assignment and app snapshot construction. No state or storage. |
| `features/saves/snapshot.ts` | Minimal app contract and Core key. |
| `features/saves/game-data.ts` | Pure indexes over selected state catalogs and version-specific extraction metadata. |
| `features/saves/overview.ts` | Pure resource, building, heat and electricity projections. |
| `features/saves/map.ts` | Linear projection of spatial entities, recipe inputs and direct cargo links. |
| `features/saves/ui/SaveMap*.tsx` | Read-only React Flow map, camera controls and building inspector. |
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
use `starrupture-planner/saves-v4/`; experimental storage entries are ignored, not
migrated. Other app roots retain their existing keys.
Older v4 Cores without bounds hydrate with `bounds: null`; re-import obtains bounds
from the original save. Existing workspaces and objectives remain compatible.

Corrupt Saves entries are preserved and Saves editing is blocked for that load;
other settings can still persist. Normal edits remain synchronous. Limits are
32 MiB compressed, 128 MiB decoded, 100,000 supported/source entities, 10 million
nearest-Core comparisons, and a 30-second browser import timeout. Persisted data
is limited to eight workspaces, 1 MiB per workspace and 3 MiB for the collection,
measured conservatively as UTF-16 storage strings.

## Evidence and tests

The available local sample (`6.sav`, game version 0.3.5) contains 6,220 entities.
The refactored decoder retains all nine Cores and 232 supported buildings. Its
workspace occupies approximately 89 KB as a localStorage string, versus roughly
64 KB before retaining XYZ coordinates and Core bounds (about 25 KB extra for 241
entities). This is one sample, not a compatibility guarantee.

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

## Snapshot map

My Saves exposes Overview and Map views, both for the whole save and from a Core.
The map reuses React Flow with fixed XY positions (+X right, +Y down), viewport
culling, pan, wheel/pinch zoom, fit-to-save and focus-Core controls. It does not
run a graph layout. Core markers remain readable at world scale. Building icons
are location markers, not inferred footprints. Coordinates are retained in the
snapshot but omitted from the inspector.
A searchable building picker also makes stacked or coincident buildings accessible,
with keyboard navigation and matching by name, Core, resource or snapshot-local ID.

The map fills the remaining app height without page scrollbars. A compact planner-
style toolbar sits above the canvas. The icon-only settings popover sits at the
top right and includes layer toggles; standard React Flow controls and attribution
sit at the bottom left. Building
details float over the map at all sizes, with their own bounded scrolling. The
background uses the planner's dot pattern, adapted for world-scale zoom. The game artwork and fixed projection are preserved. Grid spacing adapts
to zoom; nearby Core labels move to a free side of their markers so every Core name remains
visible. Core building counts appear below 12% zoom and disappear at closer zoom.
Building markers have a uniform 72-unit default size, allowing some overlap in
dense rows. Coincident/stacked buildings remain accessible through search.
Unselected building artwork has no card background or border. Larger resource
badges sit inside the lower-right corner, with opaque backgrounds tinted using
the shared item-type color palette. Their frames fit the visible
artwork with 1-unit padding; cached alpha bounds remove transparent image margins
from the display without modifying the source assets.
**Map settings** offers uniform 56/72/88-unit building sizes, building names,
resource icons, grid visibility and
optional cargo movement, with a reset to display defaults. These are local view
settings; resizing markers never moves saved positions or changes Core bounds.

Core bounds are translucent rectangular XY projections of saved boxes, behind
buildings and cargo links. The **Core bounds** checkbox shows/hides them (on by
default), independently of cargo links. Bounds ignore pointer/keyboard interaction,
participate in fit-to-save/focus-Core while shown, and highlight the selected
building's Core. Unknown bounds are omitted with a re-import hint; no sizes are
inferred from Core level or building locations. Visibility remains local UI state.

The **Power networks** checkbox (off by default) colors Core markers and adds
small network-color dots to buildings
using their saved power network IDs, including networks shared across Cores.
A deterministic palette stays stable across map remounts and layer toggles;
markers without a network retain their normal appearance. Highlighted marker
tooltips include the network number, and selection retains its separate ring.

Selecting a building shows configured output, recipe inputs, nominal capacity,
heat, power, Core and cargo peer navigation. Selected items appear
inside building markers, including received cargo and launcher shipments. Only
explicit dispatcher-to-receiver references produce cargo connections; unknown
items retain the connection. Rounded orthogonal routes use ports facing their
peer, subtle cargo segments and small direction indicators. They are schematic,
not reconstructed in-game paths. Strokes, arrows, selected route labels and hit
areas compensate for React Flow's HTML zoom transform, remaining readable and
clickable at whole-save scale. Optional motion respects reduced-motion settings.
Conveyor/pipe reconstruction, terrain and launcher destinations
are deliberately outside this version. No routes, rendered nodes, derived resource
summaries or camera state are persisted. Re-import clears building selection,
since building IDs cannot be reconciled across snapshots.

## Subsequent work

Build production planning as a separate layer over snapshots and Core settings:
corporation, intermediate-resource and mission objectives; supply-aware recipe
calculations; then building changes needed to reach the objective. Objectives
have no current UI; the reserved Core-settings data shape remains intact. Preserve the existing
Planner and My Bases state and behavior throughout that work.
