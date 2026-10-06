import english from './locales/en.json';
import { createCatalogTranslator, type Catalog, type CatalogTranslator, type MessageValues } from './translator';

export type { MessageValues, PluralMessage } from './translator';

/** English source messages are stable catalog keys; game data never goes through this API. */
export type MessageKey = keyof typeof english;
export type MessageCatalog = Catalog<MessageKey>;
export interface UiMessage { key: MessageKey; values?: MessageValues }
export type UiText = string | UiMessage;
export type Translator = CatalogTranslator<MessageKey>;

export const message = (key: MessageKey, values?: MessageValues): UiMessage => ({ key, ...(values ? { values } : {}) });

/** Pure, runtime-independent translation; also usable for exports and headless rendering. */
export function createTranslator(locale: string, catalog: MessageCatalog = {}): Translator {
    return createCatalogTranslator(locale, english, catalog);
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
