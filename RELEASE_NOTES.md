# Release Notes — 2026-06-25

## What's New

### 📦 Smarter Output Allocation
Plan-linked output buildings now distribute production intelligently:

- **Logistics capacity limits** per building (e.g. Package Dispatcher 200/min,
  Orbital Cargo Launcher 10/min), with optional custom overrides.
- **Auto / Fixed allocation modes** and **priority ordering** to decide which
  outputs get filled first.
- Clear indicators for over-capacity and under-supplied outputs.

### 🔌 Linked Inputs-Outputs
- Added one-to-one logistics linking between output buildings and input buildings, with broken-link detection when a source is missing or no longer configured.

### 🍳 Recipe Alternative Presets
Save your favorite sets of recipe-alternative selections and reload them anytime.

- **Save** the current recipe alternatives as a named preset.
- **Load** any saved preset into the planner or a production plan in one click.
- **Set as default** so every new plan and the planner start from your preferred
  recipes. Presets and defaults are saved globally and persist across sessions.

### 🔗 Logistics View
A brand-new **Logistics** tab in *My Bases* gives you a visual map of your entire
production network. Bases appear as nodes connected by live links, so you can see
at a glance how resources flow between them.

- **Item links** between bases, with item name and throughput (per-minute rate).
- **Energy grids** drawn as floating hubs that pool power across connected bases.
- **Broken-link detection** — links whose source output no longer matches are
  highlighted in red so you can fix them fast.
- **Layer filters** to toggle item links, energy, broken links, and utilization.
- **Click any link or base** to open a detail panel with rates, items, and warnings
  (broken links, unassigned outputs, energy deficits).
- Auto-layout keeps the graph readable, plus minimap and zoom controls.

### Improvements
- Refined base cards and overview with clearer output handling.
- Updated base management with new building properties.