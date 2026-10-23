# Save map rendering performance

Verified on 2026-10-21 with `internal/1.sav`: 57 Cores, 3,125 buildings, 41 cargo links, and 1,930 buildings with stack peers. The largest Core contains 243 buildings. The source save was also decoded directly with the production decoder to check these counts.

## Changes

- Buildings and individual cargo routes unmount below world zoom. Buildings appear at zoom 0.12 and remain visible until zoom falls below 0.09, preventing repeated mounts near the threshold. At world zoom, cargo routes are grouped into directed Core-to-Core connections; same-Core deliveries are omitted. Badges, resources and level controls retain the 0.45 detail threshold. Core focus at zoom 0.242 still displays buildings.
- The complete model remains available for search, selection and fitting. Explicit dimensions and cargo port geometry allow fitting and routing to work before a building has ever mounted. Hidden nodes participate in fit calculations.
- Render caches preserve node and edge references when their visual state is unchanged. A selection change updates the old/new selection, related endpoints, Core bounds and affected cutaways, rather than every node.
- Only actual cargo ports get Handles, including Cores with inter-Core deliveries. Unconnected Cores and ordinary buildings have none. Ghosts use the building icon's alpha mask for a lightweight silhouette without image components or badges.
- React Flow owns continuous camera movement. The viewport is saved to Uklad at gesture end. Core label placement runs once per zoom update and is shared by the Core markers. Cargo geometry is cached and cargo animation pauses during camera movement.
- Core icons stay between 24 and 32 screen pixels. Power-network badges show the full number at a fixed, readable screen size. Names use a compact, single-line label beside the icon, without building counts. Crowded names appear on hover, keyboard focus or selection instead of being displaced to distant rows.
- Default number formatting reuses its formatter. Redundant viewport, selection and level updates do not invalidate render data.

## Production browser comparison

These measurements predate the addition of Core-to-Core overview routes on 2026-10-22. The overview now mounts cargo edges and their Core ports while keeping buildings unmounted.

The same locally imported save, browser, viewport, default display settings and camera fits were used before and after. The baseline was built before rendering changes. Tests and builds were stopped for the final comparison.

| Measurement | Before | After |
| --- | ---: | ---: |
| World pan frame interval, median / p95 | 125 / 158.3 ms | 8.3 / 9.3 ms |
| World zoom frame interval, median / p95 | 141.6 / 291.6 ms | 8.3 / 9.3 ms |
| Building selection, median / p95 | 629.2 / 1,211.5 ms | 16 / 17.8 ms |
| Level change, median / p95 | 820.1 / 879.2 ms | 15.8 / 16.5 ms |
| World mounted nodes | 3,239 | 114 |
| World building markers | 3,125 | 0 |
| World connection Handles | 25,456 | 0 |
| World canvas DOM elements | 48,572 | 831 |
| Core 1 fit connection Handles | 1,496 | 5 |

Frame statistics use 60 animation frames for each scripted pan/zoom gesture. Selection and level statistics use 12 interactions each, timed from DOM event dispatch through two animation frames. They include rendering and frame scheduling, and are not native-input INP measurements or React Profiler commit durations. Selection alternates the same two building IDs in both runs. Camera transforms and mounted building counts at the Core/detail zooms match the baseline.

The final run had no frames over 33.4 ms and no long tasks, versus all 60 frames in each baseline gesture exceeding 33.4 ms. The harness also verified that each selection and level change had committed before accepting its timing sample. An earlier isolated run recorded pan/zoom p95 of 33.3/41.7 ms and selection/level p95 of 50.3/37.2 ms. Occasional frame spikes and larger camera-transition tasks are still possible; timing varies with host load and display refresh rate.

An additional fit to Core 35 displayed 766 buildings including nearby Cores. In that denser view, selection p95 was 22.8 ms and subsequent level changes were 15.5 ms p95. The world gestures in that run had no frames over 33.4 ms and no long tasks.

## Repeat locally

```sh
npx vite build --config scripts/benchmark-map.config.ts
npx vite preview --host 127.0.0.1 --port 5178 --strictPort --outDir internal/map-performance-dist
```

Open `/map/`, use English, import the save, and expand **Local map benchmark** to run it. The harness uses the existing save and normal DOM interactions; it does not upload the save anywhere. Use `/map/?benchmarkCore=Core%2035` to exercise the largest Core. Do not run other benchmarks, tests or builds concurrently. This opt-in script is absent from the normal production build.

Local raw reports are in `internal/map-performance-baseline.json`, `internal/map-performance-final.json`, `internal/map-performance-isolated-previous.json`, `internal/map-performance-dense-core.json` and `internal/map-model-verification.json`. The save and reports remain ignored by Git.

## Regression coverage

The map tests cover zoom hysteresis, actual building unmounts, complete fit geometry, offscreen cargo port geometry, stable node/edge identities and handlers, one shared Core label layout, lightweight ghosts, and saving the camera only after movement. Existing stack, level, resizing, settings, keyboard navigation, localization, snapshot replacement and selection tests continue to pass.

The production browser was also checked for world-zoom search, a cargo route between Cores 20 and 46, following its connected building, and selection/camera restoration after switching to Overview and back. No browser warnings or errors were reported. The full suite passes: 802 tests across 97 files. Production build and targeted ESLint checks pass.
