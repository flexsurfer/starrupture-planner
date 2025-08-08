import { useContext } from 'react';
import { NavigationContext } from '../contexts/NavigationContextDefinition';

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};
