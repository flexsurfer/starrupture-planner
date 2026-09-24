<!-- uklad-agent:start -->
## Uklad

This project uses Uklad (`@ukladjs/core`) for application state.

For changes involving Uklad state, events, subscriptions, effects, coeffects, contracts, runtime composition, or DevTools, use the Uklad Agent Toolkit's `uklad` skill first. If that skill is unavailable, read `node_modules/@ukladjs/core/templates/agent/AGENTS.md`.

Preserve the project's existing Uklad structure and state ownership.
<!-- uklad-agent:end -->

## UI Localization

The UI uses a typed English message catalog with language selection in Global settings.
Game data and game-specific names remain unchanged. When adding or modifing UI copy use Localization tools first in english and then add translations to all available locales. Validate catalogs with `npm run test:i18n`.