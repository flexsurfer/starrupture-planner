# UI localization

English is the fallback language. English, German, French, and Polish are
currently supported UI languages. UI messages live in
`src/shared/i18n/locales/en.json`. English source text is the typed message key;
other catalogs keep those keys and translate their values.

The language selector in **Global settings → Appearance** lists registered
languages. Before a user has saved a language choice, the browser selects the
first supported language in `navigator.languages` (or `navigator.language` if
that list is empty). Regional tags resolve to their registered base language,
so `de-DE` selects German, `fr-FR` selects French, and `pl-PL` selects Polish.
English is used when the browser has no supported language. `uiLocale` belongs
to the existing Uklad runtime and is saved with `@ukladjs/persist`; a saved
choice takes precedence over browser preferences.
`AppLocalization` projects that setting into React and updates the document's
`lang` and `dir`. Unsupported or removed languages fall back to English. Missing
messages fall back individually to English, using English plural rules.

English ships in the initial JavaScript bundle so it is always available. Other
catalogs are separate chunks loaded on demand for the selected language, including
the saved/browser language at startup. Pending requests are shared and completed
catalogs are cached for subsequent switches. While a catalog is loading, or if its
download fails, the UI uses English text. Selecting that language again retries a
failed request.

## Scope

Translate navigation, buttons, dialogs, instructions, errors, tooltips,
accessibility labels, diagram controls, and the labels on shared stats cards.

Keep these unchanged:

- Game data: item, building, recipe, corporation and reward names; descriptions;
  category/type names from the game catalog; game version labels and identifiers.
- Game terminology such as **Core**, tier names such as **V.2**, and unit/currency
  symbols such as **MW** and **G**. Keep these terms unchanged inside translated
  sentences too.
- **StarRupture**, **Rupture Planner**, **Discord**, **GitHub**, and keyboard shortcuts.
- User-entered base, plan, building and group names, descriptions and notes.
  Existing names and import/export data are not rewritten when the language changes.
  The import suffix **Copy** remains literal because it becomes part of a saved name.

Game names are interpolation values, never translation keys. Game data JSON files,
assets, URLs, DOM IDs, state/event IDs, recipe selections, keyboard key identifiers,
and machine-readable numeric input values must not go through the translator.
Developer logs and internal diagnostic errors can remain English.

## Add a language

1. Create `src/shared/i18n/locales/<language>.json`. Copy English keys and translate
   their values. A partial catalog can omit unfinished entries; do not fill them
   with empty strings. Keep `{placeholder}` names intact; their order can change.
2. Add a dynamic import entry in `src/shared/i18n/locales.ts`. Use a
   lowercase BCP 47 tag, its native language name, and the text direction:

   ```ts
   export const locales = {
       en: { name: 'English', direction: 'ltr', loadMessages: async () => ({}) },
       de: { name: 'Deutsch', direction: 'ltr', loadMessages: () => import('./locales/de.json').then(module => module.default) },
   };
   ```

   Retain the registry's existing type annotation. `en.json` is already the
   fallback, so the English registry entry intentionally has no overrides.
3. Use plural objects where needed. Supported categories are `zero`, `one`, `two`,
   `few`, `many`, and `other`; `other` is required. `Intl.PluralRules` chooses a
   form from the numeric `count` value. Include every category the language needs:

   ```json
   {
     "Cancel": "Abbrechen",
     "{count} buildings": {
       "one": "{count} Gebäude",
       "other": "{count} Gebäude"
     }
   }
   ```

4. Run `npm run test:i18n`, `npm run test:run`, and `npm run build`. The catalog
   checks validate keys, placeholders, plural fallback and protected terms. Test
   the main screens and dialogs in the new language, including narrow layouts.
   `dir` support alone does not guarantee that every layout has been adapted for
   right-to-left languages; verify those layouts before shipping one.

## Add UI copy

Add an English entry first, then use `useTranslation()` inside the component:

```tsx
const { t, formatNumber } = useTranslation();

<button aria-label={t('Remove {name}?', { name: item.name })}>
    {t('Remove')}
</button>
<span>{t('{count} buildings', { count })}</span>
<span>{formatNumber(rate, { maximumFractionDigits: 2 })}</span>
```

Use complete sentences with placeholders. Avoid concatenating translated words,
lowercasing translated labels, or building plurals with `count === 1` / `"s"`.
Pass numeric values as numbers for locale formatting; explicitly format a value
first when the UI needs particular precision. Translation output is plain text,
rendered through React's normal escaping. HTML is not supported in catalogs.

UI messages kept in state should store a descriptor and resolve it on render:

```ts
// Events/effects: import from the React-independent core.
import { message } from '@/shared/i18n/core';
const status = { kind: 'success', message: message('Export downloaded.') };

// UI:
translateText(t, status.message);
```

Use `UiMessageError` for validation failures that need to reach the UI. Pass a
translator explicitly to pure UI helpers such as canvas/share renderers; do not
read a global runtime or translate data inside production calculations.

The registered German catalog is used by the localization integration test to
exercise language switching and persistence. Russian messages in the core tests
are fixtures for plural-rule coverage, not a supported production language.
