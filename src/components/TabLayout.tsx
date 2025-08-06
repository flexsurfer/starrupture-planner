import { lazy, Suspense } from 'react';
import ItemsPage from './ItemsPage';
import RecipesPage from './RecipesPage';
import { ThemeToggle, GitHubButton } from './ui';

// Lazy load the PlannerPage to reduce initial bundle size
const PlannerPage = lazy(() => import('./PlannerPage'));
import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../state/sub-ids';
import { EVENT_IDS } from '../state/event-ids';
import type { Tab, TabType } from '../state/db';

const tabs: Tab[] = [
  { id: 'items', label: 'Items', icon: '📦' },
  { id: 'recipes', label: 'Recipes', icon: '⚗️' },
  { id: 'planner', label: 'Planner', icon: '🏭' },
];

const TabLayout = () => {
  const activeTab = useSubscription<TabType>([SUB_IDS.ACTIVE_TAB]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'items':
        return <ItemsPage />;
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
      case 'recipes':
        return <RecipesPage />;
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-base-100">
      {/* Header */}
      <div className="navbar bg-base-200 shadow-lg flex-shrink-0">
        <div className="navbar-start flex items-center gap-3">
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
        <div className="navbar-center">
          <div className="tabs tabs-bordered tabs-lg justify-center">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
                onClick={() => dispatch([EVENT_IDS.SET_ACTIVE_TAB,tab.id])}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <div className="navbar-end flex items-center gap-2">
          <GitHubButton />
          <ThemeToggle />
        </div>
      </div>

      {/* Tab Content */}
      <main className="flex-1 min-h-0 bg-base-100">
        {renderTabContent()}
      </main>
    </div>
  );
};

export default TabLayout;