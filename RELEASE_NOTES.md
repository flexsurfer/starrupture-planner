# Release Notes — 2026-09-15

## What's New

### 📱 Even Better on Mobile

- Mobile support was already available, and this update makes it even better with refined layouts, spacing, and controls for smaller screens.
- Improved readability and navigation across base management, production plans, catalog views, and the logistics map.

### 📦 Import and Export Bases and Plans

- Back up or share all your bases and planner tabs, or select just the ones you need, as a JSON file from **Global settings**.
- Export an individual base directly from its card or detail view, and export a planner tab from **Plan settings**.
- Preview an import and choose which bases and plans to add. Imported entries are added as copies, keeping your existing work intact.
- Base exports include buildings, production plans, and energy groups. Imports warn when the file uses a different game-data version.

### 🏗️ Planning and Advanced Base Modes

- Choose **Planning mode** to focus on production plans and the buildings and resources they require.
- Use **Advanced mode** to manage your in-game buildings, energy, transport, logistics, inputs, and outputs.
- Switch modes anytime across all bases while keeping your plans and base configuration.
- Review production requirements and material coverage in a combined production table, with expandable details and quick access to edit plans.

### 🎯 More Flexible Multi-Target Planning

- Plan an item alongside another target that consumes it. Production now accounts for both your requested final output and internal ingredient demand.
- Dedicated target cards make these overlapping demands clear in the graph and table.
- Recipe validation continues to catch circular dependencies while allowing targets to share ingredients or depend on one another.

### 🧭 Interface and Logistics Improvements

- Refined building and recipe browsing with expandable sections and more consistent item-category colors.
- Streamlined base navigation, production-plan controls, and detail views.
- Improved logistics-map spacing, layout, and view fitting for easier inspection of your base network.
- Rename and export planner tabs from the new **Plan settings** dialog, and choose your theme in **Global settings**.

---

# Release Notes — 2026-09-10

## What's New

### 📑 Multiple Planner Tabs
- Keep several plans open and switch between them without losing your setup.
- Each tab has its own production targets, recipe selections, and view settings.
- Planner tabs and the active tab are saved across sessions.

### 🎯 Multi-Target Production Planning
- Plan several output items together, each with its own target rate.
- Combine shared ingredient demand into one production chain to calculate the capacity needed across all targets.
- Receive conflict warnings when a target depends on another target, including when changing recipes would introduce a conflict.

### 📊 Production Views and Statistics
- Switch between **Graph** and **Table** views, with production cards grouped by item category in the table.
- Choose any of four diagram directions and optionally group nodes by production stage.
- See capacity usage on production cards, including the percentage used and required versus available output per minute.
- Explore separate **Buildings** and **Items** statistics tabs, including total ingredient demand per minute.

### 🧭 Diagram and Recipe Improvements
- Highlight connected production paths while dragging a node, or pin a node to keep its connections highlighted.
- Zoom out further to inspect large production chains.
- Inspect and select recipes directly from production cards in the planner and embedded production-plan diagrams.
- Improved recipe previews, keyboard controls, and mobile layouts for recipe alternatives and presets.
- Refined navigation and planner layouts for smaller screens.

### 🎮 Game Data Corrections
- Updated **Update 2 QoL** output rates for Onboard Instruments, Titanium Housing, Supermagnet, Nanosyringe, and Hardening Agent.

---

# Release Notes — 2026-09-04

## What's New

### 🎮 Update 2 QoL Game Data
- Added the **Update 2 QoL** game-data set for items, buildings, corporations, and recipes.
- Expanded the recipe catalog from 130 to 146 recipes, including new alternative variants.
- Increased supported base-core levels to 1–8 with updated heat-capacity calculations.

### 🧭 Recipe Planning Improvements
- Added stable recipe IDs while preserving compatibility with existing saved selections.
- Recipe alternatives now show recipe-type icons and inline previews, making it easier to compare options.
- Added Update 2 QoL to the data-version selector and made it the default for new profiles.

### ⚙️ Runtime and Reliability
- Migrated application state to typed Uklad feature modules with browser and headless platform adapters.
- Added local-storage migration and durable persistence coverage for planner data, bases, energy groups, themes, and recipe selections.
- Added browserless end-to-end coverage for the catalog, planner, bases, production plans, persistence, and real bundled data.

### Compatibility
Existing installations keep their saved game-data version. Select **Update 2 QoL** in the version selector to use the new recipes.

### Verification
- 146 unit/integration tests and 32 headless end-to-end scenarios passed.
- Production build and lint passed.
- Headless coverage: 99.89% statements, 85.87% branches, and 100% functions.

---

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
