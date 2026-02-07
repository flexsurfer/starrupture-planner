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

1. **DEMAND PASS**: Calculate total demand for producible items (full tree traversal)
2. **ALLOCATION PASS**: Allocate external inputs to production demands
3. **NODE CREATION PASS**: Create production nodes based on remaining demand
4. **RAW DEMAND PASS**: Calculate raw material needs from actual production nodes
5. **RAW ALLOCATION PASS**: Allocate external inputs to raw material consumers
6. **RAW NODE PASS**: Create raw production nodes (if allowed)
7. **EDGE CREATION PASS**: Create edges using edge-driven approach
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

### 3) Custom input nodes are created only if actually used (edge-driven)
A custom input source results in a node **only if at least one edge is created from it**.

Implementation uses edge-driven approach:
- Custom input nodes are created lazily when processing allocations
- `outputAmount` starts at 0 and accumulates as edges are added
- This guarantees `outputAmount` exactly equals sum of outgoing edge amounts

Unused custom inputs are not represented in the output.

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

### 7) Demand analysis and graph construction are strictly separated
- The demand pass traverses the full theoretical dependency graph
- Custom input allocation may eliminate entire branches by reducing demand to zero
- Node and edge creation is based **only on remaining demand after allocation**

No production nodes or edges are created for items whose remaining demand is zero.

---

### 8) Edge creation uses edge-driven tracking
To ensure consistency between allocation plans and actual graph:
- `allocatedToConsumer` index is built AS edges are created (not before)
- Custom node `outputAmount` is accumulated from actual edge amounts
- This prevents divergence between planned allocations and realized edges

---

## Summary Mental Model

> Demand is always analyzed globally across the full dependency tree.
> The target item must be producible (non-raw); raw targets return empty result.
> Custom inputs act as external sources at any level of the production chain.
> They may supply intermediate or raw items, but never the target item itself.
> Production nodes are built only where demand remains after allocation.
> Raw material demand is derived from actual production, not theoretical demand.
> Edge creation is the source of truth for custom node output amounts.
> When raw production is disabled, raw materials are external-only and deficits are reported.
