# Factory Map building layers

Import `test/fixtures/factory-map-overlaps.sav` into **Factory Map** with
**Update 2 (QoL)** (`update2_QoL`) selected. It contains eight named Cores and
44 buildings. This is a synthetic planner fixture, not a playable StarRupture
world. Core 03 deliberately contains coincident same-Z records to test exclusion.

## Detection rule

Layers resolve **overlapping map nodes**, ordered by saved height. They do not
claim that the physical building models overlap. Collision geometry, model
dimensions, variants, rotations and scale are not needed for this rule and are
not stored in snapshots. Previously stored placement and footprint fields are
discarded during hydration, before storage limits are checked.

1. Skip pairs with the same world Z (within 0.0001 save units of numeric noise).
2. Compare centred squares inset by 10% on every edge of the current Building size:
   Compact 56, Standard 72, or Large 88 map units. Detection squares are 80% as
   wide and tall (44.8, 57.6, or 70.4 map units), giving 36% less area while the
   visible markers keep their full size. The shared projection divides save X/Y
   by 10. Ignore labels, layer badges, selection outlines, power-network
   styling, resource icons, and Core markers/bounds. Any positive interior
   intersection beyond numeric noise counts; edge or corner contact does not.
3. Order direct neighbours by saved Z. A→B→C never creates an A→C relationship
   unless A and C themselves overlap.

Detection runs before viewport transforms. Zoom and pan scale or move every
building node equally, so they never change the overlap graph. Changing Building
size recalculates the graph and level numbers. Other display settings, selection,
visibility and ghosting do not feed back into detection.

## What to check

Use **Focus Core** to jump between examples. A small layers icon indicates a
node overlap at different saved heights; its number is that building's level in its
Core. Click the building, then **Below** or **Above**. Upper buildings become
non-interactive ghosts as you inspect a lower level. Every building retains its
ID, recipe, position and cargo connection. There are no combined marker counts
or combined-building lists.

The square **layers icon / Higher level / number / Lower level** controls sit
inside the map, on the left, without a neighbouring text panel. Levels come from
the overlap graph: a building with no overlapping building below it is **level
1**. Otherwise it is one level above the highest-level overlapping building
below it. Independent stacks each start at 1; unrelated buildings on uneven
ground remain at 1 regardless of their Z. For an offset chain or bridge, levels
follow the longest chain below the building. This does not create any extra
overlap relationships between buildings.

A level includes buildings on that level and lower levels; buildings at higher
overlap levels become ghosts. This filter compares levels, never a raw-Z cutoff.
The highest level shows everything. A Core with only one level needs no controls.
Mixed building types, offset positions and different poses follow the same node
intersection rule. Independent nodes on uneven ground remain at level 1 as long
as their squares do not overlap.

At building-detail zoom (0.45 and above), after panning or zooming stops the
controls and Core picker follow the visible marker nearest the viewport centre.
They check individual marker bounds, including partially visible markers, so
empty gaps between a Core's buildings do not claim focus. A Core's buildings can
remain in focus even when its Core marker is off screen.
The Core name and level count are available in the tooltip; the picker also
identifies the Core. Empty space and world overview have no level controls.
Automatic Core tracking is disabled below the same detail threshold used by
building badges. **All Cores** and **Fit view** retain their explicit selection
after fitting, even if a compact map fits at close zoom. Panning or using zoom
controls resumes automatic tracking. Selecting a specific Core or search result
also retains that target while its camera animation completes.

Each Core remembers its cutaway while you pan between Cores or rename the save;
**Fit view** or **All Cores** resets them. Importing a snapshot or resizing nodes
also resets cutaways because the graph may change; if a building is selected
when resizing, its new level stays revealed. Higher
world-Z markers always draw above lower markers;
selection only changes draw order within the same elevation. Camera focus and
zoom have no effect on stack detection or assigned level numbers.

| Core | Expected result |
| --- | --- |
| 01 · Aligned layers | Eight Wolfram Wire fabricators at four XY positions, levels 1 and 2. Upper badges show 2. Lower level reveals all four lower buildings, with badges showing 1. Below/Above also updates the level controls. |
| 02 · Offset mixed buildings | Three mutually overlapping nodes with different types/recipes. #203 (Tube, Z -900) is level 1, #201 (Fabricator, Z 0) level 2, and #202 (Smelter, Z 1800) level 3. Lower level reveals each offset node in turn. |
| 03 · Same Z | All eight buildings have Z 1000 (level 1). No stack indicators or Above/Below controls, even for the deliberately coincident pair #301/#302. No level controls are needed for this Core. |
| 04 · Rotation | #401/#402 share a 45° pose; #403 has a different rotation. All three share the same node position and form levels 1/2/3. Saved pose does not affect the square nodes. |
| 05 · Ten layers | Ten identical names at irregular elevations from Z -1800 to 90000, labelled levels 1–10. Above/Below follows actual height order. Search #501, #505 and #510 to check levels 1, 5 and 10 on both badges and controls. |
| 06 · Uneven ground | #601/#602 have separate nodes at Z 0/1800 and both stay at level 1 at every supported node size. A separate valley stack #603/#604 at Z -2000/-200 has levels 1/2. Lower level hides only #604; both buildings on higher terrain remain visible. |
| 07 · Cargo | Two vertically aligned senders and two receivers. Both independent pairs have levels 1/2, although their upper buildings have different Z (1800/2600). Ghost endpoints hide their own cargo links. “Show connected building” reveals and selects the actual connected endpoint. |
| 08 · Node size | #801/#802 are an aligned pair with fractional heights, always levels 1/2. #803 and #804 are each another 64 map units to the right. Compact/Standard leave them at level 1; Large creates a chain: #803 becomes level 2, #804 level 3. #802/#803 share Z and never relate directly. Zoom preserves these relationships. |

Search selects any building by ID and sets its Core's cutaway to that building's
overlap level. This also makes duplicate names easy to
inspect. Escape, Close, or a pane click dismisses details. The level arrows,
Above/Below and search are keyboard-accessible. At the highest/lowest level,
focus moves to the remaining enabled arrow. Faded buildings
cannot intercept clicks or keyboard focus. Cargo links to faded endpoints are
hidden rather than left dangling.

Regenerate and validate the downloadable fixture with:

```sh
npm run fixture:map-overlaps
```

The generator writes the standard four-byte decoded-length header plus zlib JSON,
and validates the result through the production decoder and mappings before
saving. Unit tests cover partial node intersections, touching edges, different
node sizes, same-Z exclusions, negative coordinates, direct chains, mixed models,
discarding obsolete geometry metadata, and keeping selection visible after resizing.
