export type MessageValues = Readonly<Record<string, string | number>>;
export type PluralMessage = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
export type MessageEntry = string | PluralMessage;
export type Catalog<Key extends string> = Partial<Record<Key, MessageEntry>>;
export type CatalogTranslator<Key extends string> = (key: Key, values?: MessageValues) => string;

/** Pure formatting shared by independently typed message catalogs. */
export function createCatalogTranslator<Key extends string>(
    locale: string,
    english: Record<Key, MessageEntry>,
    catalog: Catalog<Key> = {},
): CatalogTranslator<Key> {
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
