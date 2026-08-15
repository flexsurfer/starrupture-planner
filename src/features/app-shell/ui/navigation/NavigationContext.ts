import { createContext } from 'react';
import type { NavigateFunction } from 'react-router-dom';

export interface NavigationContextType {
  navigate: NavigateFunction | null;
}

export const NavigationContext = createContext<NavigationContextType>({
  navigate: null,
});
