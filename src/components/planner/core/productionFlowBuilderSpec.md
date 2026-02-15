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
2. **REACHABLE DEMAND PASS**: Propagate demand from target through reachable branches only, consuming custom supply pools during propagation
3. **NODE CREATION PASS**: Create production nodes from remaining demand
4. **RAW DEMAND PASS**: Calculate raw material needs from actual production nodes
5. **RAW ALLOCATION PASS**: Allocate external inputs to raw material consumers (for deficit/remaining raw production decisions)
6. **RAW NODE PASS**: Create raw production nodes (if allowed)
7. **EDGE ALLOCATION + EDGE CREATION PASS**: Build custom allocations from actual live consumers and create all graph edges
8. **LAUNCHER PASS**: Add orbital cargo launcher (if requested)
9. **DEFICIT PASS**: Calculate raw material deficits (if raw production disabled)

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
Raw material demand is computed **only from production nodes that are actually created**.

Specifically:
- Raw demand = sum of raw inputs required by final production nodes after allocation
- Raw demand is NOT derived from the full theoretical dependency tree

This ensures deficits reflect only what is truly required after branch elimination.

---

### 7) Demand propagation and graph construction must be branch-consistent
- Demand starts at the target item and is propagated only through reachable branches
- Custom input supply is consumed during propagation, reducing downstream demand before upstream expansion
- Node and edge creation is based **only on remaining reachable demand**

No production nodes or edges are created for items whose remaining demand is zero.

---

### 8) Edge creation uses edge-driven tracking
To ensure consistency between allocation plans and actual graph:
- `allocatedToConsumer` index is built AS edges are created (not before)
- Custom node `buildingCount` is derived from actual edge amounts
- This prevents divergence between planned allocations and realized edges

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
> Reachable demand is propagated with supply consumption, so pruned branches do not retain supply.
> Production nodes are built only where remaining reachable demand exists.
> Raw material demand is derived from actual production, not theoretical demand.
> Edge creation is the source of truth for custom node utilization and live-consumer allocation.
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
