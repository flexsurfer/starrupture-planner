import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ItemsPage from './ItemsPage';
import RecipesPage from './RecipesPage';
import CorporationsPage from './CorporationsPage';
import MyBasesPage from './MyBasesPage';
import PlannerPage from './PlannerPage';
import { ThemeToggle, GitHubButton, DiscordButton, VersionSelector, ConfirmationDialog } from './ui';
import { useNavigationSync } from '../hooks/useNavigationSync';
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../state/sub-ids';
import { EVENT_IDS } from '../state/event-ids';
import type { Tab, TabType } from '../state/db';

const tabs: Tab[] = [
  { id: 'mybases', label: 'My Bases', icon: '🏗️' },
  { id: 'items', label: 'Items', icon: '📦' },
  { id: 'recipes', label: 'Buildings', icon: '🏭' },
  { id: 'corporations', label: 'Corporations', icon: '🏢' },
  { id: 'planner', label: 'Planner', icon: '📐' },
];

const TabLayout = () => {
  const activeTab = useSubscription<TabType>([SUB_IDS.UI_ACTIVE_TAB]);
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
    '/mybases': 'mybases',
  }), []);

  const tabToPath = useMemo<Record<TabType, string>>(() => ({
    'items': '/items',
    'recipes': '/recipes',
    'corporations': '/corporations', 
    'planner': '/planner',
    'mybases': '/mybases',
  }), []);

  // Sync URL changes with state (only when URL changes externally)
  useEffect(() => {
    const currentTab = pathToTab[location.pathname];
    if (currentTab && currentTab !== activeTab) {
      dispatch([EVENT_IDS.UI_SET_ACTIVE_TAB, currentTab]);
    }
    // NOTE: activeTab is intentionally omitted from deps to prevent feedback loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, pathToTab]);



  // Handle tab clicks with navigation
  const handleTabClick = (tabId: TabType) => {
    const path = tabToPath[tabId];
    if (path) {
      navigate(path);
      dispatch([EVENT_IDS.UI_SET_ACTIVE_TAB, tabId]);
      if (tabId === 'mybases') {
        dispatch([EVENT_IDS.PRODUCTION_PLAN_MODAL_CLOSE]);
        dispatch([EVENT_IDS.BASES_SET_SELECTED_BASE, null]);
      }
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
        return <PlannerPage />;
      case 'mybases':
        return <MyBasesPage />;
      default:
        return null;
    }
  };

  return (
      <div className="h-screen flex flex-col bg-base-100">
        {/* Header */}
        <div className="lg:navbar flex flex-row bg-base-200 shadow-lg flex-shrink-0 p-2">
          {/* Mobile Layout */}
          <div className="navbar-start lg:hidden flex items-center">
            <img
              src="/logo_black_bg.webp"
              alt="Rupture Planner Logo"
              className="h-4 w-auto rounded shadow-sm"
              width={16}
              height={16}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <h1 className="text-sm font-bold mr-2">Rupture Planner</h1>
            <VersionSelector />
          </div>

          {/* Desktop Layout */}
          <div className="navbar-start hidden lg:flex items-center gap-3">
            <img
              src="/logo_black_bg.webp"
              alt="Rupture Planner Logo"
              className="h-8 w-auto rounded shadow-sm"
              width={32}
              height={32}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <h1 className="text-xl font-bold">Rupture Planner</h1>
            <VersionSelector />
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
            <DiscordButton />
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
        <main className="flex-1 min-h-0 overflow-y-auto bg-base-100">
          {renderTabContent()}
        </main>

        {/* Global Modals */}
        <ConfirmationDialog />
      </div>
  );
};

export default TabLayout;
