import type { ReactNode } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { NavigationContext } from './NavigationContextDefinition';

interface NavigationProviderProps {
  children: ReactNode;
  navigate: NavigateFunction;
}

export default function NavigationProvider({ children, navigate }: NavigationProviderProps) {
  return (
    <NavigationContext.Provider value={{ navigate }}>
      {children}
    </NavigationContext.Provider>
  );
}
