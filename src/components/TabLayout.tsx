import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ItemsPage from './ItemsPage';
import RecipesPage from './RecipesPage';
import CorporationsPage from './CorporationsPage';
import { ThemeToggle, GitHubButton } from './ui';
import { useNavigationSync } from '../hooks/useNavigationSync';

// Lazy load the PlannerPage to reduce initial bundle size
const PlannerPage = lazy(() => import('./PlannerPage'));
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../state/sub-ids';
import { EVENT_IDS } from '../state/event-ids';
import type { Tab, TabType } from '../state/db';

const tabs: Tab[] = [
  { id: 'items', label: 'Items', icon: '📦' },
  { id: 'recipes', label: 'Recipes', icon: '⚗️' },
  { id: 'corporations', label: 'Corporations', icon: '🏢' },
  { id: 'planner', label: 'Planner', icon: '🏭' },
];

const TabLayout = () => {
  const activeTab = useSubscription<TabType>([SUB_IDS.ACTIVE_TAB]);
  const location = useLocation();
  const navigate = useNavigate();
  
  // Handle programmatic navigation sync
  useNavigationSync(activeTab);

  // Map URL paths to tab IDs
  const pathToTab = useMemo<Record<string, TabType>>(() => ({
    '/items': 'items',
    '/recipes': 'recipes', 
    '/corporations': 'corporations',
    '/planner': 'planner',
  }), []);

  const tabToPath = useMemo<Record<TabType, string>>(() => ({
    'items': '/items',
    'recipes': '/recipes',
    'corporations': '/corporations', 
    'planner': '/planner',
  }), []);

  // Sync URL changes with state (only when URL changes externally)
  useEffect(() => {
    const currentTab = pathToTab[location.pathname];
    if (currentTab && currentTab !== activeTab) {
      dispatch([EVENT_IDS.SET_ACTIVE_TAB, currentTab]);
    }
    // NOTE: activeTab is intentionally omitted from deps to prevent feedback loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, pathToTab]);



  // Handle tab clicks with navigation
  const handleTabClick = (tabId: TabType) => {
    const path = tabToPath[tabId];
    if (path) {
      navigate(path);
      dispatch([EVENT_IDS.SET_ACTIVE_TAB, tabId]);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'items':
        return <ItemsPage />; 
      case 'recipes':
        return <RecipesPage />;
      case 'corporations':
        return <CorporationsPage />;
      case 'planner':
        return (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="loading loading-spinner loading-lg text-primary"></div>
            </div>
          }>
            <PlannerPage />
          </Suspense>
        );     
      default:
        return null;
    }
  };

  return (
      <div className="h-screen flex flex-col bg-base-100">
        {/* Header */}
        <div className="navbar bg-base-200 shadow-lg flex-shrink-0">
          {/* Mobile Layout */}
          <div className="navbar-start lg:hidden flex items-center">
            <img
              src="/logo_black_bg.jpg"
              alt="Rupture Planner Logo"
              className="h-8 w-auto rounded shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h1 className="text-lg font-bold ml-2">Rupture Planner</h1>
          </div>

          {/* Desktop Layout */}
          <div className="navbar-start hidden lg:flex items-center gap-3">
            <img
              src="/logo_black_bg.jpg"
              alt="Rupture Planner Logo"
              className="h-8 w-auto rounded shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h1 className="text-xl font-bold">Rupture Planner</h1>
          </div>

          {/* Desktop Tab Navigation */}
          <div className="navbar-center hidden lg:flex">
            <div className="tabs tabs-bordered tabs-lg justify-center">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Controls - always visible but compact on mobile */}
          <div className="navbar-end flex items-center gap-1 lg:gap-2">
            <GitHubButton />
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile Tab Navigation - Below header */}
        <div className="lg:hidden bg-base-200 border-t border-base-300">
          <div className="flex overflow-x-auto py-1">
            <div className="flex min-w-full justify-center px-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`flex-1 min-w-0 py-2 px-2 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === tab.id 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-base-content/70 hover:text-base-content'
                  }`}
                  onClick={() => handleTabClick(tab.id)}
                >
                  <div className="flex flex-row items-center gap-1">
                    <span className="text-sm">{tab.icon}</span>
                    <span className="text-xs leading-none truncate">{tab.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <main className="flex-1 min-h-0 bg-base-100 overflow-auto">
          {renderTabContent()}
        </main>
      </div>
  );
};

export default TabLayout;