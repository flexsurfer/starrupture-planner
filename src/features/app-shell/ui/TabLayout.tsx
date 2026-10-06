import { useTranslation, type MessageKey } from '@/shared/i18n';
import { TransferNotification } from '@/features/data-transfer/ui/TransferNotification';
import { GlobalSettings, GlobalSettingsButton } from '@/features/data-transfer/ui/GlobalSettings';
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ItemsPage } from '@/features/items/ui';
import { BuildingsPage } from '@/features/buildings/ui';
import { CorporationsPage } from '@/features/corporations/ui';
import { MyBasesPage } from '@/features/bases/ui';
import { PlannerPage } from '@/features/planner/ui';
import {
  ConfirmationDialog,
  DiscordButton,
  GitHubButton,
  VersionSelector,
} from '@/features/app-shell/ui';
import { useNavigationSync } from './navigation/useNavigationSync';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { TabType } from '@/app/uklad/model';
import { SectionIcon, type SectionIconName } from '@/shared/ui';
import { DEFAULT_TOOL_PATH, findToolTab, toolPaths } from '@/shared/navigation/toolPaths';
import type { ToolShellOptions } from './ToolShellOptions';

const tabs: { id: TabType; label: MessageKey; icon: SectionIconName }[] = [
  { id: 'mybases', label: 'My Bases', icon: 'bases' },
  { id: 'items', label: 'Items', icon: 'items' },
  { id: 'recipes', label: 'Buildings', icon: 'buildings' },
  { id: 'corporations', label: 'Corporations', icon: 'corporations' },
  { id: 'planner', label: 'Planner', icon: 'planner' },
];

const TabLayout = ({ homePath = DEFAULT_TOOL_PATH, footer }: ToolShellOptions) => {
  const { t } = useTranslation();
  const runtime = useRuntime();
  const [showSettings, setShowSettings] = useState(false);
  const activeTab = useSubscription([appIds.subscriptions.UI_ACTIVE_TAB]);
  const location = useLocation();
  const headerRef = useRef<HTMLDivElement>(null);
  const desktopBrandRef = useRef<HTMLDivElement>(null);
  const desktopTabsRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [tabsFitHeader, setTabsFitHeader] = useState(false);

  useLayoutEffect(() => {
    const header = headerRef.current!;
    const brand = desktopBrandRef.current!;
    const navigation = desktopTabsRef.current!;
    const controls = controlsRef.current!;
    const updateLayout = () => {
      const style = getComputedStyle(header);
      const availableWidth = header.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      // Keep the desktop layout measurable in compact mode so the threshold stays stable.
      const requiredWidth = [brand, navigation, controls].reduce(
        (width, element) => width + element.getBoundingClientRect().width, 0,
      ) + parseFloat(style.columnGap) * 2;
      setTabsFitHeader(requiredWidth <= availableWidth);
    };
    updateLayout();
    const observer = new ResizeObserver(updateLayout);
    [header, brand, navigation, controls].forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);
  
  // Handle programmatic navigation sync
  useNavigationSync(activeTab);

  // Sync URL changes with state (only when URL changes externally)
  useEffect(() => {
    const currentTab = findToolTab(location.pathname);
    if (currentTab && currentTab !== activeTab) {
      runtime.dispatch([appIds.events.UI_SET_ACTIVE_TAB, currentTab]);
    }
    // NOTE: activeTab is intentionally omitted from deps to prevent feedback loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);



  // Links own click navigation; the URL effect selects the active tab.
  const handleTabClick = (event: MouseEvent<HTMLAnchorElement>, tabId: TabType) => {
    // Let modified clicks open a separate tab without changing this workspace.
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
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
        <div className="relative flex-shrink-0 bg-base-200 shadow-lg">
          <div
            ref={headerRef}
            inert={!tabsFitHeader}
            aria-hidden={!tabsFitHeader}
            className={`grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 p-2 ${tabsFitHeader ? '' : 'absolute inset-x-0 top-0 invisible overflow-hidden'}`}
          >
            {/* Desktop Layout */}
            <div ref={desktopBrandRef} className="flex w-max items-center gap-3 col-start-1 row-start-1">
              <img
                src="/logo_black_bg.webp"
                alt={t("Rupture Planner Logo")}
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
              <Link to={homePath} className="text-xl font-bold whitespace-nowrap">Rupture Planner</Link>
              <VersionSelector className="shrink-0" />
            </div>

            {/* Desktop Tab Navigation */}
            <div className="flex justify-center col-start-2 row-start-1">
              <div ref={desktopTabsRef} className="tabs tabs-bordered tabs-lg w-max flex-nowrap justify-center">
                {tabs.map((tab) => (
                  <Link
                    key={tab.id}
                    to={toolPaths[tab.id]}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
                    onClick={event => handleTabClick(event, tab.id)}
                  >
                    <SectionIcon name={tab.icon} className="mr-2 h-5 w-5" />
                    {t(tab.label)}
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop Controls */}
            <div ref={controlsRef} className="ml-auto flex w-max shrink-0 items-center justify-end gap-2 row-start-1 col-start-3">
              <GlobalSettingsButton onClick={() => {
                runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, null]);
                setShowSettings(true);
              }} />
              <DiscordButton className="btn btn-ghost btn-sm" />
              <GitHubButton className="btn btn-ghost btn-sm" />
            </div>
          </div>

          {/* Compact Layout */}
          <div className={`${tabsFitHeader ? 'hidden' : 'flex'} items-center gap-2 px-2 py-0.5`}>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Link to={homePath} className="shrink-0 rounded focus-visible:outline-2 focus-visible:outline-primary">
                <span className="sr-only">Rupture Planner</span>
                <img
                  src="/logo_black_bg.webp"
                  alt=""
                  className="h-9 w-9 rounded shadow-sm"
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
              </Link>
              <VersionSelector className="min-w-0 max-w-full" />
            </div>
            <div className="ml-auto flex shrink-0 items-center justify-end gap-1">
              <GlobalSettingsButton onClick={() => {
                runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, null]);
                setShowSettings(true);
              }} />
              <DiscordButton className="btn btn-ghost btn-sm btn-square" />
              <GitHubButton className="btn btn-ghost btn-sm btn-square" />
            </div>
          </div>
        </div>

        {/* Compact Tab Navigation - Below header */}
        <div className={`${tabsFitHeader ? 'hidden' : ''} bg-base-200 border-t border-base-300`}>
          <div className="flex overflow-x-auto">
            <div className="flex min-w-full justify-center px-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  to={toolPaths[tab.id]}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`flex-1 min-w-0 py-1.5 px-1.5 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === tab.id 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-base-content/70 hover:text-base-content'
                  }`}
                  onClick={event => handleTabClick(event, tab.id)}
                >
                  <div className="flex flex-row items-center gap-1">
                    <SectionIcon name={tab.icon} className="h-4 w-4" />
                    <span className="text-xs leading-none truncate">{t(tab.label)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <main className="relative isolate flex-1 min-h-0 overflow-y-auto bg-base-100">
          {(activeTab === 'items' || activeTab === 'planner') && <h1 className="sr-only">{t(activeTab === 'items' ? 'Items' : 'Planner')}</h1>}
          {renderTabContent()}
        </main>
        {footer}

        {/* Global Modals */}
        <ConfirmationDialog />
        {!showSettings && <TransferNotification />}
        {showSettings && <GlobalSettings onClose={() => setShowSettings(false)} />}
      </div>
  );
};

export default TabLayout;
