# Contributing to Rupture Planner

Bug reports, game-data corrections, translations, documentation, and code changes
are welcome. This guide covers working on the standalone app. For features and
instructions on using it, see the [README](README.md).

[Setup](#development-setup) · [Architecture](#application-architecture) ·
[Localization](#ui-localization) · [Game data](#game-data-and-assets) ·
[Testing](#testing-and-validation) · [Pull requests](#pull-requests)

## Issues and proposals

Check [existing issues](https://github.com/flexsurfer/starrupture-planner/issues)
before opening a new one.

For a bug report, include the steps to reproduce, expected and actual behavior,
your browser and operating system, and the selected game-data version. For
Factory Map issues, also include the game version that produced the save and
any import error message. Screenshots or a small reproducible example help.

For a feature proposal, explain the workflow you want to improve and the behavior
you would find useful. Include an example of how you would use it.

## Development setup

Use **Node.js 22.18+ in the 22.x series, or 24.11+**, **npm**, and **Git**. These
Node.js versions satisfy the locked Uklad dependencies.

Fork the repository on GitHub, then clone your fork. Replace `YOUR_USERNAME`
with your GitHub username:

```sh
git clone https://github.com/YOUR_USERNAME/starrupture-planner.git
cd starrupture-planner
git switch -c feature/short-description
npm ci --include=dev
npm run dev
```

Open the address printed by Vite. `npm start` also opens your browser and uses
[localhost:5173](http://localhost:5173) with a fixed port. See
[Run locally](README.md#run-locally) for the Windows launcher, browser-storage
behavior, and production builds.

Install dependencies from the repository root. After pulling changes to
`package-lock.json`, run `npm ci --include=dev` again. If your change adds or
updates dependencies, include the corresponding lockfile changes in your PR.

The `site:*` commands require the maintainer's optional `website/` directory,
which is excluded from the public repository. Use the root development, test,
and build commands for the standalone app.

## Application architecture

The app uses React and TypeScript with Uklad (`@ukladjs/core`) for application
state. Features share one typed application contract and one runtime per browser
root or isolated headless execution.

| Location | Responsibility |
| --- | --- |
| [`src/app/uklad/`](src/app/uklad/) | State composition, IDs, contracts, runtime, React bindings, and registration |
| [`src/features/`](src/features/) | Feature state, events, subscriptions, calculations, and UI |
| [`src/platform/web/`](src/platform/web/) | Browser startup, effects, persistence, workers, and file transfers |
| [`src/platform/headless/`](src/platform/headless/) | Headless adapters, fixtures, and application scenarios |
| [`src/platform/shared/`](src/platform/shared/) | Effects shared by browser and headless targets |
| [`src/shared/`](src/shared/) | Shared UI, localization, and navigation |
| [`test/`](test/) | Shared test setup and integration fixtures |

When changing application behavior, start with
[`catalog.ts`](src/app/uklad/catalog.ts) for IDs and
[`contracts.ts`](src/app/uklad/contracts.ts) for types, then inspect the owning
feature and platform adapter.

- Keep behavior in the existing feature modules. Register new modules through
  [`register.ts`](src/app/uklad/register.ts).
- Update the shared catalog and contracts when adding state roots, events,
  subscriptions, effects, or coeffects. Compose new initial state in the existing
  application setup.
- Change state only through event handlers' `draftState`. Treat subscription
  values, state snapshots, and dispatched payloads as read-only.
- Put derived application data in subscriptions and shared or durable state in
  the runtime. React component state is appropriate for temporary UI mechanics.
- Keep environment-specific work in platform adapters and preserve equivalent
  behavior in the browser and headless targets.

When using coding agents, follow [`AGENTS.md`](AGENTS.md), including its Uklad
Agent Toolkit instructions.

## Code and UI conventions

- Follow the surrounding TypeScript style and keep strict types. Use the existing
  `@/` source alias and type-only imports where appropriate.
- Keep production calculations independent of React and browser APIs so they can
  be tested directly and used by the headless runtime.
- Use functional React components and hooks. Reuse components from
  `src/shared/ui/` and the existing Tailwind CSS and DaisyUI styles.
- Give interactive controls accessible names, support keyboard navigation, and
  account for loading, empty, and error states.
- Check affected layouts on narrow screens and in both light and dark themes.
  Allow translated text to take more space than English.
- Run ESLint and keep unrelated formatting changes out of the PR.

## UI localization

UI messages use a typed English catalog. English, German, French, and Polish are
currently available in **Global settings → Appearance**.

For new or changed UI copy:

1. Reuse an existing message when it fits, or add the English message first in
   [`en.json`](src/shared/i18n/locales/en.json). English source text is the message
   key.
2. Use the existing localization helpers, such as `useTranslation()` in React.
   Include visible copy, tooltips, error messages, and accessibility labels.
3. Add or update the matching translations in
   [`de.json`](src/shared/i18n/locales/de.json),
   [`fr.json`](src/shared/i18n/locales/fr.json), and
   [`pl.json`](src/shared/i18n/locales/pl.json).
4. Preserve interpolation placeholders and use the catalog's plural forms and
   number-formatting helpers.
5. Run `npm run test:i18n` and inspect the affected UI in the supported languages.

Keep game-specific names, catalog descriptions, version labels, units, and
user-entered names unchanged. Use complete messages with placeholders rather
than concatenating translated fragments. The
[localization guide](docs/localization.md) covers adding languages, plural rules,
formatting, and messages produced outside React.

## Game data and assets

Versioned data lives in `game-data/<version>/`. Use the existing files as examples
and preserve their structure. The Update 2 QoL data includes:

| File | Contents |
| --- | --- |
| [`items_catalog.json`](game-data/update2_QoL/items_catalog.json) | Item IDs, names, and categories |
| [`buildings_and_recipes.json`](game-data/update2_QoL/buildings_and_recipes.json) | Buildings, power, heat, recipe inputs, and output rates |
| [`corporations_components.json`](game-data/update2_QoL/corporations_components.json) | Corporation levels, requirements, and rewards |
| [`save_buildings_mappings.json`](game-data/update2_QoL/save_buildings_mappings.json) | Save building identities and configuration metadata |
| [`save_items_mappings.json`](game-data/update2_QoL/save_items_mappings.json) | Save item identities and stack sizes |
| [`save_recipes_mappings.json`](game-data/update2_QoL/save_recipes_mappings.json) | Save recipe identities and catalog associations |

For data corrections, identify the affected game version and provide the source
or in-game evidence for the change. Preserve stable item and building IDs and
existing recipe identities used by saved plans. Recipe quantities use
`amount_per_minute`; check both inputs and outputs.

Keep game-data JSON outside `assets/`: the browser loader imports it through
content-hashed URLs. Matching item, building, and corporation icons live under
`assets/icons/` as WebP files. Observe the
[game asset notice](assets/icons/LICENSE) when contributing icons.

When adding a game-data version, add its directory and update the version type
and registry in [`data-version.ts`](src/features/app-shell/data-version.ts).
Verify that its catalogs load in both browser and headless runs. Enable save
mappings only when the corresponding version-specific mapping files are present
and verified. Catalog changes can also require refreshed save-mapping revisions;
see the existing [mapping generator](scripts/generate-save-mappings.mjs), which
requires reviewed game-export inputs that are not bundled with the repository.

## Testing and validation

Run the smallest relevant test while working. For example:

```sh
npm run test:run -- src/features/planner/multi-target.test.ts
```

Before submitting code or game-data changes, run:

```sh
npm run lint
npm run test:run
npm run build
```

`npm run build` includes the TypeScript checks. Other useful commands are:

| Command | Use |
| --- | --- |
| `npm test` | Watch tests while developing |
| `npm run test:ui` | Open the Vitest UI |
| `npm run test:i18n` | Validate catalogs and localization behavior after UI copy changes |
| `npm run test:e2e:headless` | Exercise application workflows without a browser |
| `npm run test:e2e:headless:coverage` | Check coverage for the configured headless surfaces |
| `npm run headless:once` | Initialize the standalone headless runtime |
| `npm run headless` | Run that runtime in watch mode |
| `npm run devtools:mcp` | Start the local Uklad DevTools MCP bridge |

Add regression coverage for changed behavior, including relevant edge cases.
Keep unit and component tests beside the code they exercise. For application
workflows, follow the existing headless scenarios and
[`e2e-support.ts`](src/platform/headless/e2e-support.ts): dispatch normal events
and inspect subscription-backed views through an isolated fixture.

For changes to stored data or JSON transfers, cover compatibility with existing
saved work and imports. For UI changes, verify the affected interactions in the
browser as well as in component tests. For documentation-only changes, check
links, paths, command examples, and Markdown formatting.

Factory Map work has additional guides for
[streaming save import](docs/streaming-save-import.md),
[overlapping building layouts](docs/factory-map-overlap-testing.md), and
[rendering performance](docs/map-rendering-performance.md). The repository
includes a synthetic overlap fixture for reproducing map cases.

## Pull requests

Create a focused branch from `main`, make the change, and push it to your fork.
Use a short, descriptive commit message; for example:

```text
fix(planner): account for shared ingredient demand
docs(contributing): update development setup
```

In the PR description, explain the problem and resulting behavior. Include the
related issue if there is one, the checks you ran, and screenshots for visible UI
changes. Mention any compatibility implications for saved plans, imported saves,
or supported game-data versions. Update relevant documentation when behavior or
setup changes.

Keep the diff focused on the change being reviewed, and respond to review
feedback with any needed code, tests, or clarification.

## License

Source contributions are covered by the project's [MIT License](LICENSE).
StarRupture assets under `assets/icons/` are excluded from that license; see the
[game asset notice](assets/icons/LICENSE).
