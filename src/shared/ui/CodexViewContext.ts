import { createContext, useContext } from 'react';

/** Presentation scope only: Codex lookups cannot change the workspace beneath them. */
export const CodexViewContext = createContext(false);
export const useCodexView = () => useContext(CodexViewContext);
