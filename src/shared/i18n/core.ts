import english from './locales/en.json';

/** English source messages are stable catalog keys; game data never goes through this API. */
export type MessageKey = keyof typeof english;
export type MessageValues = Readonly<Record<string, string | number>>;
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type MessageCatalog = Partial<Record<MessageKey, string | PluralMessage>>;
export interface UiMessage { key: MessageKey; values?: MessageValues }
export type UiText = string | UiMessage;
export type Translator = (key: MessageKey, values?: MessageValues) => string;

export const message = (key: MessageKey, values?: MessageValues): UiMessage => ({ key, ...(values ? { values } : {}) });

/** Pure, runtime-independent translation; also usable for exports and headless rendering. */
export function createTranslator(locale: string, catalog: MessageCatalog = {}): Translator {
    const plurals = new Intl.PluralRules(locale);
    const englishPlurals = new Intl.PluralRules('en');
    const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 20 });
    return (key, values = {}) => {
        const translated = catalog[key];
        const entry: string | PluralMessage = translated ?? english[key];
        const rules = translated === undefined ? englishPlurals : plurals;
        const template = typeof entry === 'string'
            ? entry
            : entry[rules.select(Number(values.count ?? 0))] ?? entry.other;
        // Single-pass replacement: user/game names containing braces are always literal text.
        return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
            const value = values[name];
            return value === undefined ? placeholder : typeof value === 'number' ? numbers.format(value) : value;
        });
    };
}

export const translateText = (t: Translator, text: UiText): string =>
    typeof text === 'string' ? text : t(text.key, text.values);

/** Keeps validation errors localizable without exposing arbitrary error text in the UI. */
export class UiMessageError extends Error {
    readonly uiMessage: UiMessage;
    constructor(key: MessageKey, values?: MessageValues) {
        super(createTranslator('en')(key, values));
        this.uiMessage = message(key, values);
    }
}
