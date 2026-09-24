import { useContext } from 'react';
import { LocalizationContext } from './context';

export const useTranslation = () => useContext(LocalizationContext);
export { message, translateText, UiMessageError } from './core';
export type { Translator, MessageKey, MessageCatalog, UiMessage, UiText } from './core';
