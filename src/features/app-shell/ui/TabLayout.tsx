import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ItemsPage } from '@/features/items/ui';
import { BuildingsPage } from '@/features/buildings/ui';
import { CorporationsPage } from '@/features/corporations/ui';
import { MyBasesPage } from '@/features/bases/ui';
import { PlannerPage } from '@/features/planner/ui';
import {
  ConfirmationDialog,
  DiscordButton,
  GitHubButton,
  ThemeToggle,
  VersionSelector,
} from '@/features/app-shell/ui';
import { useNavigationSync } from './navigation/useNavigationSync';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { Tab, TabType } from '@/app/uklad/model';

const tabs: Tab[] = [
  { id: 'mybases', label: 'My Bases', icon: '🏗️' },
  { id: 'items', label: 'Items', icon: '📦' },
  { id: 'recipes', label: 'Buildings', icon: '🏭' },
  { id: 'corporations', label: 'Corporations', icon: '🏢' },
  { id: 'planner', label: 'Planner', icon: '📐' },
];

const TabLayout = () => {
  const runtime = useRuntime();
  const activeTab = useSubscription([appIds.subscriptions.UI_ACTIVE_TAB]);
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
      runtime.dispatch([appIds.events.UI_SET_ACTIVE_TAB, currentTab]);
    }
    // NOTE: activeTab is intentionally omitted from deps to prevent feedback loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, pathToTab]);



  // Handle tab clicks with navigation
  const handleTabClick = (tabId: TabType) => {
    const path = tabToPath[tabId];
    if (path) {
      navigate(path);
      runtime.dispatch([appIds.events.UI_SET_ACTIVE_TAB, tabId]);
      if (tabId === 'mybases') {
        runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);
        runtime.dispatch([appIds.events.BASES_SET_SELECTED_BASE, null]);
      }
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'items':
        return <ItemsPage />; 
      case 'recipes':
        return <BuildingsPage />;
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
        <div className="flex flex-row lg:grid lg:grid-cols-[1fr_auto] 2xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 bg-base-200 shadow-lg flex-shrink-0 px-2 py-0.5 lg:p-2">
          {/* Mobile Layout */}
          <div className="lg:hidden flex min-w-0 flex-1 items-center gap-2">
            <img
              src="/logo_black_bg.webp"
              alt="Rupture Planner Logo"
              className="h-9 w-9 shrink-0 rounded shadow-sm"
              width={36}
              height={36}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
            <h1 className="sr-only">Rupture Planner</h1>
            <VersionSelector className="min-w-0 max-w-full" />
          </div>

          {/* Desktop Layout */}
          <div className="hidden lg:flex min-w-0 items-center gap-3 lg:col-start-1 lg:row-start-1">
            <img
              src="/logo_black_bg.webp"
              alt="Rupture Planner Logo"
              className="h-8 w-auto shrink-0 rounded shadow-sm"
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
            <h1 className="text-xl font-bold whitespace-nowrap">Rupture Planner</h1>
            <VersionSelector className="shrink-0" />
          </div>

          {/* Desktop Tab Navigation */}
          <div className="hidden lg:flex justify-center lg:col-span-2 lg:row-start-2 2xl:col-span-1 2xl:col-start-2 2xl:row-start-1">
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
          <div className="ml-auto flex shrink-0 items-center justify-end gap-1 lg:gap-2 lg:col-start-2 lg:row-start-1 2xl:col-start-3">
            <DiscordButton className="btn btn-ghost btn-sm max-lg:btn-square" />
            <GitHubButton className="btn btn-ghost btn-sm max-lg:btn-square" />
            <ThemeToggle className="max-lg:h-8 max-lg:w-8" />
          </div>
        </div>

        {/* Mobile Tab Navigation - Below header */}
        <div className="lg:hidden bg-base-200 border-t border-base-300">
          <div className="flex overflow-x-auto">
            <div className="flex min-w-full justify-center px-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`flex-1 min-w-0 py-1.5 px-1.5 text-xs font-medium transition-colors border-b-2 ${
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
