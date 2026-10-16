import { useTranslation, type MessageKey } from '@/shared/i18n';
import { TransferNotification } from '@/features/data-transfer/ui/TransferNotification';
import { GlobalSettings, GlobalSettingsButton } from '@/features/data-transfer/ui/GlobalSettings';
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ItemsPage } from '@/features/items/ui';
import { BuildingsPage } from '@/features/buildings/ui';
import { CorporationsPage } from '@/features/corporations/ui';
import { MyBasesPage } from '@/features/bases/ui';
import { MyBasesDeprecationNotice } from '@/features/bases/ui/MyBasesDeprecationNotice';
import { PlannerPage } from '@/features/planner/ui';
import { MySavesPage } from '@/features/saves/ui/MySavesPage';
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
import { AppBrand } from './AppBrand';
import { CodexMenu } from './CodexMenu';
import type { CodexSection } from './codex-sections';
import { CodexDialog } from './CodexDialog';

const tabs: { id: TabType; label: MessageKey; icon: SectionIconName }[] = [
  { id: 'planner', label: 'Planner', icon: 'planner' },
  { id: 'mysaves', label: 'Factory Map', icon: 'map' },
  { id: 'mybases', label: 'My Bases', icon: 'bases' },
];

const TabLayout = ({ homePath = DEFAULT_TOOL_PATH, footer }: ToolShellOptions) => {
  const { t } = useTranslation();
  const runtime = useRuntime();
  const [showSettings, setShowSettings] = useState(false);
  const [codexSection, setCodexSection] = useState<CodexSection | null>(null);
  const activeTab = useSubscription([appIds.subscriptions.UI_ACTIVE_TAB]);
  const bases = useSubscription([appIds.subscriptions.BASES_LIST]);
  const visibleTabs = tabs.filter(tab => tab.id !== 'mybases' || bases.length > 0);
  const location = useLocation();
  const headerRef = useRef<HTMLDivElement>(null);
  const desktopBrandRef = useRef<HTMLDivElement>(null);
  const desktopTabsRef = useRef<HTMLElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [tabsFitHeader, setTabsFitHeader] = useState(false);
  const codexActive = activeTab === 'items' || activeTab === 'recipes' || activeTab === 'corporations';

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
        return <div className="flex h-full min-h-0 flex-col">
          <MyBasesDeprecationNotice />
          <div className="min-h-0 flex-1"><MyBasesPage /></div>
        </div>;
      case 'mysaves':
        return <MySavesPage />;
      default:
        return null;
    }
  };

  return (
      <div className="h-dvh flex flex-col bg-base-100">
        {/* Header */}
        <div className="relative z-20 flex-shrink-0 bg-base-200 shadow-lg">
          <div
            ref={headerRef}
            inert={!tabsFitHeader}
            aria-hidden={!tabsFitHeader}
            className={`grid grid-cols-[minmax(max-content,1fr)_auto_minmax(max-content,1fr)] items-center gap-2 p-2 ${tabsFitHeader ? '' : 'absolute inset-x-0 top-0 invisible overflow-hidden'}`}
          >
            {/* Desktop Layout */}
            <div ref={desktopBrandRef} className="flex w-max items-center gap-3 col-start-1 row-start-1">
              <AppBrand homePath={homePath} />
              <VersionSelector className="shrink-0" />
            </div>

            {/* Desktop Tab Navigation */}
            <div className="flex justify-center col-start-2 row-start-1">
              <nav ref={desktopTabsRef} aria-label={t('Main navigation')} className="tabs tabs-bordered tabs-lg w-max flex-nowrap justify-center">
                {visibleTabs.map((tab) => (
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
                <CodexMenu active={codexActive} visible={tabsFitHeader} onOpen={setCodexSection} />
              </nav>
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
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <AppBrand homePath={homePath} compact />
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
        <div className={`${tabsFitHeader ? 'hidden' : ''} relative z-20 bg-base-200 border-t border-base-300`}>
            <nav aria-label={t('Main navigation')} className="flex min-w-full justify-center px-1">
              {visibleTabs.map((tab) => (
                <Link
                  key={tab.id}
                  to={toolPaths[tab.id]}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`flex flex-1 min-w-0 flex-col items-center gap-1 py-2 px-1.5 text-xs font-medium transition-colors border-b-2 ${
                    activeTab === tab.id 
                      ? 'border-primary text-primary' 
                      : 'border-transparent text-base-content/70 hover:text-base-content'
                  }`}
                  onClick={event => handleTabClick(event, tab.id)}
                >
                  <div className="flex flex-row items-center justify-center gap-1">
                    <SectionIcon name={tab.icon} className="hidden h-4 w-4 min-[360px]:block" />
                    <span className="text-center text-xs leading-tight">{t(tab.label)}</span>
                  </div>
                </Link>
              ))}
              <CodexMenu active={codexActive} visible={!tabsFitHeader} compact onOpen={setCodexSection} />
            </nav>
        </div>

        {/* Tab Content */}
        <main className="relative isolate flex-1 min-h-0 overflow-y-auto bg-base-100">
          {(activeTab === 'items' || activeTab === 'planner') && <h1 className="sr-only">{t(activeTab === 'items' ? 'Items' : 'Planner')}</h1>}
          {renderTabContent()}
        </main>
        {footer}

        {/* Global Modals */}
        {codexSection && <CodexDialog initialSection={codexSection} onClose={() => setCodexSection(null)} />}
        <ConfirmationDialog />
        {!showSettings && <TransferNotification />}
        {showSettings && <GlobalSettings onClose={() => setShowSettings(false)} />}
      </div>
  );
};

export default TabLayout;
