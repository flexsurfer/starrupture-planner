# Production Flow Builder – Specification

This document defines the functional specification and invariants for the
`buildProductionFlow` algorithm. It describes **what the function must do** and **what
must never happen**, independent of any UI concerns.

---

## Scope

This specification applies to the pure function:

```ts
buildProductionFlow(
  params: ProductionFlowParams,
  buildings: Building[]
): ProductionFlowResult
```

### Parameter Structure

```ts
interface ProductionFlowParams {
  /** Target item to be produced */
  targetItemId: string;

  /** Desired production rate (units per minute), defaults to 60 */
  targetAmount?: number;

  /** Input building snapshots from base inputs */
  inputBuildings?: InputBuildingSnapshot[];

  /** Disables internal production of raw materials and enables raw deficit reporting */
  rawProductionDisabled?: boolean;

  /** Adds a launcher node that consumes the target item */
  includeLauncher?: boolean;
}
```

### Early-exit conditions

The function returns an **empty** result (`nodes: []`, `edges: []`,
`rawMaterialDeficits: []`) when:

- `buildings` is empty or falsy
- `targetAmount` is zero or negative
- `targetItemId` is a raw material (see definition below)

---

## Algorithm Overview

The algorithm operates in **three phases**:

### Phase 1 – Normalize
Validate and normalize external input sources (`inputBuildings`):
- Filter to valid `sectionType === 'inputs'` entries with positive `ratePerMinute`
- Exclude any source whose `selectedItemId` matches the target item
- Build source-state and source-index lookup structures

### Phase 2 – Fulfill
Recursively satisfy target demand via `fulfillDemand()`:
- Allocate external input sources to the current consumer (deterministic source order)
- Produce the remaining amount internally when possible
- Propagate recipe input demand from the produced remainder
- Node aggregation happens inline: one produced node per item, building count accumulated
- Raw material accounting (`required` / `available`) is tracked during traversal

### Phase 3 – Finalize
- **3a.** Derive input-node `buildingCount` from actual edge-emitted usage
- **3b.** Convert consolidated flow map to final edge list
- **3c.** Add orbital cargo launcher node and edge (if `includeLauncher`)
- **3d.** Compute raw material deficits (if `rawProductionDisabled`)

---

## Core Concepts

### Node Types (`FlowNode.nodeType`)

Every node carries a `nodeType` discriminant:

| `nodeType`     | Description | `recipeIndex` |
|----------------|-------------|---------------|
| `'production'` | A building running a recipe to produce an item internally | `>= 0` |
| `'input'`      | An external supply source injecting material from outside the graph | `-2` |
| `'launcher'`   | An orbital cargo launcher that consumes the target item | `-1` |

### Production Node (`nodeType: 'production'`)
- Represents internal production capacity
- One node per distinct output item (building counts are aggregated)

### Launcher Node (`nodeType: 'launcher'`)
- Consumes the target item at a fixed rate (`LAUNCHER_RATE_PER_MINUTE`)
- Building data (name, power, heat) is looked up from the `buildings` array by `LAUNCHER_BUILDING_ID`
- If the launcher building is not present in `buildings`, the launcher is silently skipped
- Exists only if explicitly enabled via `includeLauncher`
- Must never be treated as a producer
- Must never appear as a consumer in demand or allocation passes
- May only have incoming edges from the target item's production node

### Input Node (`nodeType: 'input'`)
- `baseBuildingId` identifies the source
- Represents material injected from outside the production graph
- Created lazily only when an allocation actually uses the source

### Raw Material
An item is considered *raw* if:
- it has no recipe, OR
- its recipe has no inputs (zero-input recipe)

**Important**: "Raw" refers to **dependency structure** (leaf nodes in the production graph),
not production capability. Raw items with recipes CAN be produced when `rawProductionDisabled=false`.

### Node ID Format
All nodes use a consistent ID format: `{buildingId}_{recipeIndex}_{outputItem}`

Input nodes append a suffix: `{buildingId}_{recipeIndex}_{outputItem}_{baseBuildingId}`

---

## Builder Context

All mutable state accumulated during Phase 2 is grouped in a `BuilderContext`:

| Field | Purpose |
|-------|---------|
| `nodes` | Accumulated result nodes |
| `flows` | Consolidated flow map (keyed by `from=>to::itemId`) |
| `producedNodeByItem` | One production node per item (for aggregation) |
| `inputNodeBySource` | One input node per `baseBuildingId` (lazy creation) |
| `usedByInputSource` | Tracks total amount consumed per input source |
| `rawRequiredByItem` | Total raw demand per item (for deficit accounting) |
| `rawAvailableByItem` | Raw demand satisfied by input sources (for deficit accounting) |

---

## Invariants

### 0) Target item must be producible (non-raw)
If the `targetItemId` is a raw material, the function returns an **empty** result.
This prevents raw targets from being satisfied by input sources or reported as deficits.

---

### 0a) Target amount must be positive
If `targetAmount` is zero or negative, the function returns an **empty** result.

---

### 1) Target item must never be satisfied by input sources
Input sources whose `itemId === targetItemId` are **completely ignored**.

They must:
- not affect demand or allocation
- not create nodes
- not create edges
- not affect deficit calculations

These are filtered out during Phase 1 normalization.

---

### 2) Input sources may be allocated to any non-target item
Input sources may satisfy demand for **any intermediate or raw item**, including
items that have production recipes.

Input sources may partially or fully replace production for any non-target item.

---

### 2a) Intermediate inputs must prune upstream dependency demand
When an input source satisfies an intermediate item (for example `inductor`), upstream
dependencies for that satisfied portion (for example `tube` and `titanium_rod`) must
be reduced accordingly.

This propagation applies transitively through the dependency chain and must be based on
reachable demand after input supply consumption.

---

### 2b) Allocation is consumer-local and demand-driven
Input allocation is performed at the point where demand is fulfilled for a specific
consumer node. It is not precomputed globally.

This guarantees:
- input supply is only consumed by reachable consumers
- no supply is reserved for branches that are never realized
- edge emission and allocation are always consistent

---

### 3) Input nodes are created only if actually used (edge-driven)
An input source results in a node **only if at least one edge is created from it**.

Implementation uses edge-driven approach:
- Input nodes are created lazily when processing allocations
- `outputAmount` is fixed to the source `ratePerMinute`
- `buildingCount` is derived from actual used flow (`used / outputAmount`)
- This guarantees `outputAmount * buildingCount` equals sum of outgoing edge amounts

Unused input sources are not represented in the output.

---

### 3a) Input node output must equal outgoing edge flow
For every input node:
- `used = outputAmount * buildingCount`
- `used` must equal the sum of outgoing edges for that source (within floating tolerance)

The planner must never show input sources "producing more than they send".

---

### 4) Each baseBuildingId has exactly one itemId
The data model guarantees that each `baseBuildingId` maps to exactly one `itemId`.
This means:
- Each input source provides only one type of item
- Allocation can safely use fresh supply per pass (production vs raw) because
  an item is either raw OR non-raw, so each source matches at most one consumer set

---

### 4a) Source-order determinism
For a given item, input sources are consumed in stable source order as provided by
`inputBuildings`.

If multiple sources can satisfy the same consumer demand, earlier sources must be
depleted before later sources are used.

---

### 5) Raw-material mode controls production and deficit accounting
The flag `rawProductionDisabled` controls **raw material handling**.

When enabled:
- Raw materials must not have production nodes created
- Raw material demand may only be satisfied by input sources
- Unmet raw material demand is reported via `rawMaterialDeficits`

When disabled:
- Raw materials may be produced normally (if a recipe exists)
- `rawMaterialDeficits` must be empty

---

### 6) Raw material demand is derived from actual production
Raw material accounting is computed during demand fulfillment from actual consumer
requests and actual input allocation results.

Specifically:
- Raw `required` = all raw demand requested by realized consumers
- Raw `available` = raw demand satisfied by input sources
- Raw `missing` = `required - available` when raw production is disabled
- Raw accounting is NOT derived from a full theoretical dependency expansion

This ensures deficits reflect only what is truly required after branch elimination.

---

### 7) Demand propagation and graph construction must be branch-consistent
- Demand starts at the target item and is propagated only through reachable branches
- Input supply is consumed at each consumer before upstream expansion
- Production and edge creation are based only on the unsatisfied remainder

No production nodes or edges are created for items whose remaining demand is zero.

---

### 8) Edge creation uses edge-driven tracking
To ensure consistency between allocation plans and actual graph:
- flows are emitted immediately during demand fulfillment
- duplicate `(from, to, item)` flows are consolidated
- input node `buildingCount` is derived from emitted edge amounts

---

### 8a) Input allocation must target live consumers only
Allocations to consumers not present in the final node set are invalid and must be ignored.
Input source usage must be computed from allocations to live consumers only.

This prevents "ghost allocations" where input supply appears used but no edge exists.

---

### 8b) Shared inputs must not be reserved by pruned branches
When an item is consumed by multiple branches and one branch is pruned by other
inputs, shared input supply of that item must remain available for the still-live branch.

Example pattern:
- Target depends on `stabilizer` and `titanium_rod`
- `stabilizer` itself depends on `titanium_rod`
- Input `stabilizer` source prunes the stabilizer branch
- Input `titanium_rod` must still be allocated to the target's direct `titanium_rod` demand

---

## Summary Mental Model

> Demand propagation starts at the target and expands only through still-reachable branches.
> The target item must be producible (non-raw); raw targets return empty result.
> Target amount must be positive; zero or negative returns empty result.
> Input sources act as external suppliers at any level of the production chain.
> They may supply intermediate or raw items, but never the target item itself.
> Each consumer demand is fulfilled locally: inputs first, then internal production for the remainder.
> Supply consumption happens in source order and only for realized consumers.
> Production nodes are built only where remaining reachable demand exists.
> Raw material accounting is tracked during fulfillment, not from a separate theoretical pass.
> Emitted edges are the source of truth for input node utilization.
> When raw production is disabled, raw materials are external-only and deficits are reported.
> All mutable builder state is grouped in a `BuilderContext` for clarity.
> Every node carries a `nodeType` discriminant (`'production'` | `'input'` | `'launcher'`).

---

## Regression Scenarios (Must Hold)

1. **Intermediate branch pruning (`inductor`)**
   - If an input `inductor` source fully satisfies downstream demand, upstream `tube`/`titanium_rod`
     demand for that satisfied portion must be removed.

2. **No ghost usage on input nodes (`inductor`, `sulfuric_acid`)**
   - An input node must never show used throughput that cannot be traced to outgoing edges.
   - Allocations to consumers not present in final `nodes` must not contribute to usage.

3. **Shared-input correctness after pruning (`impeller`)**
   - If one branch using `titanium_rod` is pruned by input `stabilizer`,
     input `titanium_rod` must still be available to the remaining live `impeller` consumer.

4. **Per-source conservation**
   - For each `baseBuildingId`, `used` (derived from node utilization) must match
     the sum of edge amounts emitted by that source, within floating tolerance.
