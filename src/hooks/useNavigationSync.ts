import { useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigation } from './useNavigation';
import type { TabType } from '../state/db';

export const useNavigationSync = (activeTab: TabType) => {
  const { navigate } = useNavigation();
  const location = useLocation();
  const previousActiveTab = useRef<TabType | null>(null);

  const tabToPath = useMemo<Record<TabType, string>>(() => ({
    'items': '/items',
    'recipes': '/recipes', 
    'corporations': '/corporations',
    'planner': '/planner',
  }), []);

  const pathToTab = useMemo<Record<string, TabType>>(() => ({
    '/items': 'items',
    '/recipes': 'recipes',
    '/corporations': 'corporations', 
    '/planner': 'planner',
  }), []);

  useEffect(() => {
    // Only handle programmatic navigation (not user-triggered or URL-triggered)
    const currentUrlTab = pathToTab[location.pathname];
    const expectedPath = tabToPath[activeTab];
    
    // If the active tab changed but URL doesn't match, it's a programmatic change
    if (
      navigate && 
      expectedPath &&
      activeTab !== currentUrlTab &&
      previousActiveTab.current !== null && // Skip initial render
      previousActiveTab.current !== activeTab // Only if tab actually changed
    ) {
      navigate(expectedPath, { replace: false });
    }
    
    previousActiveTab.current = activeTab;
  }, [activeTab, navigate, location.pathname, tabToPath, pathToTab]);
};
