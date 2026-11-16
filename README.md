# Rupture Planner

<p align="center">
  <img src="assets/logo_black_bg.webp" width="96" alt="Rupture Planner logo" />
</p>

**Production planning and factory insights for StarRupture.**

Rupture Planner is a free, open-source community tool for calculating production
chains, exploring factories from game saves, and looking up items, recipes, and
corporation unlocks. Use it in your browser or run it locally.

**[Open Planner](https://www.starrupture-planner.com/planner/)** ·
**[Explore Factory Map](https://www.starrupture-planner.com/map/)** ·
[Release notes](RELEASE_NOTES.md) ·
[Report an issue](https://github.com/flexsurfer/starrupture-planner/issues)

[Features](#features) · [Getting started](#getting-started) ·
[Saving and sharing](#saving-and-sharing) · [Run locally](#run-locally) ·
[Development](#development) · [Contributing](#contributing)

## Features

### Production planner

- Plan one output or several targets together, combining their shared ingredient
  demand into a single production chain.
- Calculate production rates, building counts, power requirements, and heat.
  Inspect the chain in **Graph** or **Table** view.
- Choose alternative recipes and save named recipe presets. Use standard,
  upgraded, or custom presets as the default for new plans.
- Add external supplies through **Resources**, either as manual rates or from
  extractors and incoming deliveries in imported Cores. Use **Fit target** to
  adjust a single-item plan to the output those supplies can support.
- Compare planned production buildings with selected Cores to see what you
  already have and how many more buildings you need.
- Keep multiple planner tabs, duplicate plans to explore alternatives, and
  customize graph direction and grouping by production stage.

### Factory Map

- Import a StarRupture `.sav` file or explore a built-in demo with four Cores.
- Inspect saved building positions, configured recipes, cargo connections,
  power networks, and Core heat.
- Search and filter buildings, toggle map layers, and use level controls to
  inspect stacked or overlapping structures.
- Review Core summaries and storage inventories, including quantities,
  capacity, and storage shared across Cores.
- Explore **Factory plans** for power networks with final products, compare
  installed buildings with requirements, and open the results as a multi-target plan.

Save import and Factory plans are **experimental**. Save import has been tested
with StarRupture **0.3.5** saves and **Update 2 QoL** game data. Import limits are
**64 MiB compressed** and **512 MiB unpacked**; browser storage and complexity
limits also apply. See [save import details](docs/streaming-save-import.md).

### Codex and settings

- Open **Codex** for searchable items, **Buildings & Recipes**, and corporation
  rewards and unlock requirements.
- Switch between bundled game-data versions in the header. New profiles start
  with **Update 2 QoL**; existing profiles retain their saved selection.
- Choose English, German, French, or Polish in **Global settings → Appearance**.
  Game-specific names remain unchanged.
- Use light or dark themes and layouts that adapt to smaller screens.

## Getting started

### Plan your next build

1. [Open Planner](https://www.starrupture-planner.com/planner/) and select the
   game-data version that matches your game.
2. Choose an output item and a target rate, or create a multi-target plan for
   several outputs. Adjust recipe choices as needed.
3. Open **Resources** to account for supplies you already have, then review the
   production chain and building statistics.

### Explore your factory

1. Open **Factory Map** with **Update 2 QoL** selected.
2. Choose **Try a demo factory**, or **Choose save file** to import your `.sav`.
   The import screen includes instructions for finding your save folder.
3. Switch between **Map**, **Overview**, **Power networks**, **Storage**, and
   **Factory plans** to inspect your factory.
4. In **Factory plans**, use **Compare buildings** to review a power network's
   production machines, then **Open in Planner** to copy its target rates,
   resources, and recipes into a new plan.

Factory plans show installed capacity at full speed and estimate target rates
from local extraction and incoming cargo, keeping the same output proportions.
Those targets assume enough production buildings to use the supplies. Plans
prefer the highest-tier recipes configured on that network and try other
configured recipes when needed. Building comparisons here follow power-network
membership, including where Cores overlap; Planner lets you select Cores separately.

**My Bases is deprecated.** Existing bases remain accessible, and its navigation
tab appears when you have saved bases. Use Factory Map for save-based factory
views.

## Saving and sharing

Planner tabs, preferences, and imported factory snapshots are stored in your
browser. Game saves are decoded locally in a background worker; importing a save
does not upload its contents or modify the original file. Use **Update** in
Factory Map to refresh a snapshot from a newer save.

- **Global settings** exports all or selected bases and planner plans as JSON.
  **Plan settings** exports an individual planner tab.
- Import a Rupture Planner JSON export through **Global settings**. Preview the
  contents and choose what to add; imports create copies and keep existing work.
- Factory Map snapshots are separate from these plan exports. Keep your `.sav`
  files to import them again in another browser.

The hosted site, local server, and production preview each use separate browser
storage. Even changing the hostname or port creates a different storage location.
Use JSON exports to back up plans or move them between browsers and installations.
Clearing site data removes locally stored work.

## Run locally

### Requirements

- [Node.js](https://nodejs.org/) **22.18+ in the 22.x series, or 24.11+**, as
  required by the locked Uklad dependencies.
- **npm**, included with Node.js.
- **Git** to clone the repository, or download and fully extract its ZIP.

### macOS, Linux, or Windows terminal

```sh
git clone https://github.com/flexsurfer/starrupture-planner.git
cd starrupture-planner
npm ci --include=dev
npm start
```

`npm start` opens [localhost:5173](http://localhost:5173) in your browser and starts
in Planner. Keep the terminal running; press `Ctrl+C` to stop the server. This
command fixes the port at 5173 so saved plans stay at the same address. If the
port is in use, stop the existing server and try again.

After an update changes dependencies, run `npm ci --include=dev` again before
starting the app. The first installation requires internet access.

### Windows launcher

After installing Node.js and downloading the project, double-click
[`START.bat`](START.bat). It checks prerequisites, installs missing dependencies,
then starts the server in a minimized **Rupture Planner** window and opens the
same local address as `npm start`.

Keep that window running while using the app. Restore it to see server output;
close it to stop the server. Closing the browser alone does not stop it. If the
browser does not open, restore the window to check for a startup error.

### Production build

```sh
npm run build
npm run preview
```

The build writes the standalone app to `dist/`. Preview it at the address printed
in the terminal. For hosting, serve `dist/` over HTTP with a fallback to
`index.html` for application routes such as `/planner/` and `/map/`. Opening
`index.html` directly through `file://` is not supported.

The header shows the loaded app version (`YYYY.MM.DD-HHMMSS`, UTC build time).
Each build emits the same version in `version.json` and the JavaScript bundle;
`VITE_APP_VERSION` can supply a release label instead (use a new label for every
deployment). The Git revision remains available in the version tooltip via
`VITE_APP_RELEASE` or the current commit.

Production tabs check `version.json` on startup, every five minutes while visible,
and when returning to the tab or reconnecting. A different deployment displays
**Reload to update**; it never reloads automatically. The button preserves the
current route and adds a query to bypass the browser's cached document URL. This
does not guarantee bypassing the hosting CDN's cache. Saved plans
and settings use the existing local storage and are not cleared. Development
servers do not poll for updates.

When configuring your host, serve HTML with `Cache-Control: no-cache`,
`version.json` with `Cache-Control: no-store`, and content-hashed `/assets/` files
with `Cache-Control: public, max-age=31536000, immutable`. Retain replaced hashed
assets temporarily so cached documents and open tabs can still load their lazy
chunks. [Vite documents this deployment issue](https://vite.dev/guide/build#load-error-handling).

## Development

The app uses React and TypeScript, Vite, Tailwind CSS and DaisyUI, React Flow and
Dagre, and Uklad (`@ukladjs/core`) with `@ukladjs/persist`. Tests use Vitest and
Testing Library. See [`package.json`](package.json) for dependency ranges and
[`package-lock.json`](package-lock.json) for resolved versions.

Run these commands from the repository root after installing dependencies:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server without opening a browser |
| `npm run build` | Type-check and build the standalone app |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest in watch mode |
| `npm run test:run` | Run the full test suite once |
| `npm run test:ui` | Open the Vitest UI |
| `npm run test:i18n` | Validate UI catalogs and localization behavior |
| `npm run test:e2e:headless` | Run browserless application scenarios |
| `npm run test:e2e:headless:coverage` | Run those scenarios with coverage checks |
| `npm run headless` | Start the headless runtime in watch mode |
| `npm run headless:once` | Initialize the headless runtime once |
| `npm run devtools:mcp` | Start the local Uklad DevTools MCP bridge |

The `site:*` scripts require the maintainer's optional `website/` directory,
which is excluded from the public repository. It is not needed to run, test, or
build the standalone app.

### Project layout

```text
src/
  app/uklad/          State, typed contracts, IDs, and runtime composition
  features/           Planner, save inspection, catalogs, base tools, and UI
  platform/web/       Browser startup, persistence, save workers, and file transfers
  platform/headless/  Headless adapters and application scenarios
  platform/shared/    Platform-independent save-import effects
  shared/             UI components, localization, and navigation helpers
  utils/              Shared calculations and utilities
  App.tsx             Standalone application routes
  headless.ts         Headless entry point
assets/               Static assets and game icons
game-data/            Versioned catalogs, recipes, corporations, and save mappings
docs/                 Localization, save-import, and map testing guides
scripts/              Data generation, fixtures, and performance tooling
test/                 Shared test setup and integration tests
```

Uklad feature modules share the application's typed contracts, while browser and
headless adapters provide platform behavior. See [`AGENTS.md`](AGENTS.md) for
project instructions when working with coding agents.

## Contributing

Bug reports, game-data corrections, translations, documentation, and code changes
are welcome. Check [existing issues](https://github.com/flexsurfer/starrupture-planner/issues)
and read the [contribution guide](CONTRIBUTING.md). For bugs, include reproduction
steps, your browser, the selected game-data version, and any relevant error message.

- **UI copy:** add English messages first, then translations for all supported
  locales. Follow the [localization guide](docs/localization.md) and run
  `npm run test:i18n`.
- **Game data:** update the appropriate `game-data/<version>/` files and matching
  icons in `assets/icons/`. Keep game-data JSON outside `assets/`; Vite emits it
  separately with content-hashed URLs.
- **Validation:** run `npm run lint`, `npm run test:run`, and `npm run build` for
  code changes, plus any checks relevant to the feature you changed.

Additional guides cover [streaming save import](docs/streaming-save-import.md),
[map rendering performance](docs/map-rendering-performance.md), and
[overlapping factory layouts](docs/factory-map-overlap-testing.md).

## License and credits

Rupture Planner is an unofficial, community-made StarRupture tool. Thanks to the
StarRupture community and everyone contributing fixes, data, translations, and
feedback.

Source code is licensed under the [MIT License](LICENSE). All files in
`assets/icons/` and its subdirectories are excluded: they are StarRupture game
assets belonging to their respective rights holders, and this project grants no
license to them. See the [game asset notice](assets/icons/LICENSE).
