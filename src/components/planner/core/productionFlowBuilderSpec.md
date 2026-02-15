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

---

## Algorithm Overview

The algorithm operates in 9 sequential passes:

1. **INPUT NORMALIZATION PASS**: Normalize and validate external sources (`inputBuildings`)
2. **DEMAND FULFILLMENT PASS**: Recursively fulfill target demand:
   - allocate custom inputs to the current consumer (deterministic source order)
   - produce remaining amount internally when possible
   - propagate recipe input demand from the produced remainder
3. **NODE AGGREGATION PASS**: Aggregate produced item demand into one node per produced item
4. **CUSTOM NODE FINALIZATION PASS**: Derive custom `buildingCount` from actual edge-emitted usage
5. **EDGE FINALIZATION PASS**: Consolidate emitted flows into final edge list
6. **RAW ACCOUNTING PASS**: Track raw `required` and `available` during fulfillment
7. **RAW DEFICIT PASS**: Emit raw deficits when raw production is disabled
8. **LAUNCHER PASS**: Add orbital cargo launcher (if requested)
9. **RESULT PASS**: Return nodes, edges, and deficits

---

## Core Concepts

### Production Node
A node representing a building running a recipe.
- `recipeIndex >= 0`
- Represents internal production capacity

### Launcher Node
A node representing a non-recipe operational building that consumes the target item.
- `recipeIndex === -1`
- `isCustomInput !== true`
- Consumes the target item at a fixed rate (10/min)
- Exists only if explicitly enabled via `includeLauncher`

Launcher nodes:
- must never be treated as producers
- must never appear as consumers in demand or allocation passes
- may only have incoming edges from the target item's production node

### Custom Input Node
A node representing an external supply source.
- `recipeIndex === -2`
- `isCustomInput === true`
- `baseBuildingId` identifies the source
- Represents material injected from outside the production graph

### Raw Material
An item is considered *raw* if:
- it has no recipe, OR
- its recipe has no inputs (zero-input recipe)

**Important**: "Raw" refers to **dependency structure** (leaf nodes in the production graph),
not production capability. Raw items with recipes CAN be produced when `rawProductionDisabled=false`.

### Node ID Format
All nodes use a consistent ID format: `{buildingId}_{recipeIndex}_{outputItem}`

Custom input nodes append a suffix: `{buildingId}_{recipeIndex}_{outputItem}_{baseBuildingId}`

---

## Invariants

### 0) Target item must be producible (non-raw)
If the `targetItemId` is a raw material, the function returns an **empty** result:
- `nodes: []`
- `edges: []`
- `rawMaterialDeficits: []`

This prevents raw targets from being satisfied by custom inputs or reported as deficits.

---

### 1) Target item must never be satisfied by custom inputs
Custom inputs whose `itemId === targetItemId` are **completely ignored**.

They must:
- not affect demand or allocation
- not create nodes
- not create edges
- not affect deficit calculations

These are filtered out at the start of processing.

---

### 2) Custom inputs may be allocated to any non-target item
Custom inputs may satisfy demand for **any intermediate or raw item**, including
items that have production recipes.

Custom inputs may partially or fully replace production for any non-target item.

---

### 2a) Intermediate custom inputs must prune upstream dependency demand
When a custom input satisfies an intermediate item (for example `inductor`), upstream
dependencies for that satisfied portion (for example `tube` and `titanium_rod`) must
be reduced accordingly.

This propagation applies transitively through the dependency chain and must be based on
reachable demand after custom supply consumption.

---

### 2b) Allocation is consumer-local and demand-driven
Custom allocation is performed at the point where demand is fulfilled for a specific
consumer node. It is not precomputed globally.

This guarantees:
- custom supply is only consumed by reachable consumers
- no supply is reserved for branches that are never realized
- edge emission and allocation are always consistent

---

### 3) Custom input nodes are created only if actually used (edge-driven)
A custom input source results in a node **only if at least one edge is created from it**.

Implementation uses edge-driven approach:
- Custom input nodes are created lazily when processing allocations
- `outputAmount` is fixed to the source `ratePerMinute`
- `buildingCount` is derived from actual used flow (`used / outputAmount`)
- This guarantees `outputAmount * buildingCount` equals sum of outgoing edge amounts

Unused custom inputs are not represented in the output.

---

### 3a) Custom node output must equal outgoing edge flow
For every custom input node:
- `used = outputAmount * buildingCount`
- `used` must equal the sum of outgoing custom edges for that source (within floating tolerance)

The planner must never show custom sources "producing more than they send".

---

### 4) Each baseBuildingId has exactly one itemId
The data model guarantees that each `baseBuildingId` maps to exactly one `itemId`.
This means:
- Each custom input source provides only one type of item
- Allocation can safely use fresh supply per pass (production vs raw) because
  an item is either raw OR non-raw, so each source matches at most one consumer set

---

### 4a) Source-order determinism
For a given item, custom sources are consumed in stable source order as provided by
`inputBuildings`.

If multiple sources can satisfy the same consumer demand, earlier sources must be
depleted before later sources are used.

---

### 5) Raw-material mode controls production and deficit accounting
The flag `rawProductionDisabled` controls **raw material handling**.

When enabled:
- Raw materials must not have production nodes created
- Raw material demand may only be satisfied by custom inputs
- Unmet raw material demand is reported via `rawMaterialDeficits`

When disabled:
- Raw materials may be produced normally (if a recipe exists)
- `rawMaterialDeficits` must be empty

---

### 6) Raw material demand is derived from actual production
Raw material accounting is computed during demand fulfillment from actual consumer
requests and actual custom allocation results.

Specifically:
- Raw `required` = all raw demand requested by realized consumers
- Raw `available` = raw demand satisfied by custom inputs
- Raw `missing` = `required - available` when raw production is disabled
- Raw accounting is NOT derived from a full theoretical dependency expansion

This ensures deficits reflect only what is truly required after branch elimination.

---

### 7) Demand propagation and graph construction must be branch-consistent
- Demand starts at the target item and is propagated only through reachable branches
- Custom input supply is consumed at each consumer before upstream expansion
- Production and edge creation are based only on the unsatisfied remainder

No production nodes or edges are created for items whose remaining demand is zero.

---

### 8) Edge creation uses edge-driven tracking
To ensure consistency between allocation plans and actual graph:
- flows are emitted immediately during demand fulfillment
- duplicate `(from, to, item)` flows are consolidated
- custom node `buildingCount` is derived from emitted edge amounts

---

### 8a) Custom allocation must target live consumers only
Allocations to consumers not present in the final node set are invalid and must be ignored.
Custom input usage must be computed from allocations to live consumers only.

This prevents "ghost allocations" where custom supply appears used but no edge exists.

---

### 8b) Shared custom inputs must not be reserved by pruned branches
When an item is consumed by multiple branches and one branch is pruned by other custom
inputs, shared custom supply of that item must remain available for the still-live branch.

Example pattern:
- Target depends on `stabilizer` and `titanium_rod`
- `stabilizer` itself depends on `titanium_rod`
- Custom `stabilizer` input prunes the stabilizer branch
- Custom `titanium_rod` must still be allocated to the target's direct `titanium_rod` demand

---

## Summary Mental Model

> Demand propagation starts at the target and expands only through still-reachable branches.
> The target item must be producible (non-raw); raw targets return empty result.
> Custom inputs act as external sources at any level of the production chain.
> They may supply intermediate or raw items, but never the target item itself.
> Each consumer demand is fulfilled locally: custom first, then internal production for the remainder.
> Supply consumption happens in source order and only for realized consumers.
> Production nodes are built only where remaining reachable demand exists.
> Raw material accounting is tracked during fulfillment, not from a separate theoretical pass.
> Emitted edges are the source of truth for custom node utilization.
> When raw production is disabled, raw materials are external-only and deficits are reported.

---

## Regression Scenarios (Must Hold)

1. **Intermediate branch pruning (`inductor`)**
   - If custom `inductor` fully satisfies downstream demand, upstream `tube`/`titanium_rod`
     demand for that satisfied portion must be removed.

2. **No ghost usage on custom nodes (`inductor`, `sulfuric_acid`)**
   - A custom node must never show used throughput that cannot be traced to outgoing edges.
   - Allocations to consumers not present in final `nodes` must not contribute to usage.

3. **Shared-input correctness after pruning (`impeller`)**
   - If one branch using `titanium_rod` is pruned by custom `stabilizer`,
     custom `titanium_rod` must still be available to the remaining live `impeller` consumer.

4. **Per-source conservation**
   - For each `baseBuildingId`, `used` (derived from node utilization) must match
     the sum of edge amounts emitted by that source, within floating tolerance.
