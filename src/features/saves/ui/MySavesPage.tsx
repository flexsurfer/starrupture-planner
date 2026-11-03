import { useEffect } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { message, useTranslation, type MessageKey } from '@/shared/i18n';
import { coreKey } from '../snapshot';
import { saveViews, type SaveView, type SaveWorkspace } from '../types';
import { SaveCoreCard } from './SaveCoreCards';
import { SaveImportDialog, SaveFileDropZone, SaveImportCompatibility, SaveFileLocation } from './SaveImportDialog';
import { SaveCoreDialog } from './SaveCoreDialog';
import { SaveMap } from './SaveMap';
import { SavePowerNetworks } from './SavePowerNetworks';
import { SaveFactoryPlans } from './SaveFactoryPlans';
import { SaveStorage } from './SaveStorage';
import './SaveReports.css';

const viewLabels: Record<SaveView, MessageKey> = {
    map: 'Map', overview: 'Overview', 'power-networks': 'Power networks', storage: 'Storage', 'factory-plans': 'Factory plans',
};

function SaveOverview({ workspace, disabled }: { workspace: SaveWorkspace; disabled: boolean }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const overview = useSubscription([appIds.subscriptions.SAVES_OVERVIEW, workspace.id]);
    const selected = useSubscription([appIds.subscriptions.SAVES_SELECTED_CORE, workspace.id]);
    const mapSelections = useSubscription([appIds.subscriptions.SAVES_MAP_SELECTED_NODES]);
    const view = useSubscription([appIds.subscriptions.SAVES_SELECTED_VIEW]);
    const setView = (next: SaveView) => runtime.dispatch([appIds.events.SAVES_SELECT_VIEW, next]);
    const openCore = (id: number) => {
        runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, id]);
    };
    const coreName = (core: { id: number; name: string | null }) => core.name ?? t('Core {number}', {
        number: (overview?.cores.findIndex(coreOverview => coreOverview.core.id === core.id) ?? 0) + 1,
    });
    const updated = workspace.snapshot.savedAt?.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3 $4:$5') ?? '—';
    const remove = () => runtime.dispatch([
        appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
        message('Remove {name}?', { name: workspace.name }), message('This removes this save from this browser.'),
        () => runtime.dispatch([appIds.events.SAVES_REMOVE_WORKSPACE, workspace.id]),
        { confirmLabel: message('Remove save'), confirmButtonClass: 'btn-error' },
    ]);
    return <>
        <div className="save-view-toolbar flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-base-content/10 px-2 py-1">
            <div className="flex w-full flex-wrap gap-0.5 sm:w-auto" role="tablist" aria-label={t('Save view')}>
                {saveViews.map((tab, index) => <button key={tab} type="button" role="tab"
                    id={`save-view-${tab}`} aria-controls={`save-panel-${tab}`} aria-selected={view === tab}
                    tabIndex={view === tab ? 0 : -1}
                    className="save-view-tab min-h-8 cursor-pointer rounded-t px-1.5 text-[13px] font-medium text-base-content/75 hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary sm:px-3 sm:text-sm"
                    onClick={() => setView(tab)} onKeyDown={event => {
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? saveViews.length - 1
                            : (index + (event.key === 'ArrowRight' ? 1 : -1) + saveViews.length) % saveViews.length;
                        const next = saveViews[nextIndex];
                        setView(next);
                        document.getElementById(`save-view-${next}`)?.focus();
                    }}>{t(viewLabels[tab])}</button>)}
            </div>
            <p className="px-1.5 text-xs text-base-content/65 sm:ml-auto sm:p-0">{workspace.isDemo ? t('Demo factory') : t('Last updated: {date}', { date: updated })}</p>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
                <button type="button" className="btn btn-ghost btn-xs h-7 min-h-7 text-(--save-action-ink)" disabled={disabled}
                    onClick={() => runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, workspace.id])}>{t(workspace.isDemo ? 'Import your save' : 'Update')}</button>
                <button type="button" className="btn btn-ghost btn-xs h-7 min-h-7 text-[color-mix(in_oklab,var(--color-error)_60%,var(--color-base-content))]" disabled={disabled} onClick={remove}>{t('Remove')}</button>
            </div>
        </div>
        {workspace.isDemo && <p className="shrink-0 bg-primary/5 px-4 py-2 text-xs text-base-content/75">{t('Sample data. Import your save to explore your own factory.')}</p>}
        <div id={`save-panel-${view}`} role="tabpanel" aria-labelledby={`save-view-${view}`}
            className={view === 'map' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-0 flex-1 overflow-auto p-3 sm:p-4'}>
            {view === 'map' && <SaveMap workspace={workspace} initialCoreId={mapSelections[workspace.id] ?? null} onOpenCore={openCore} />}
            {view === 'power-networks' && <SavePowerNetworks networks={overview?.powerNetworks ?? []} onOpenCore={openCore} />}
            {view === 'storage' && <SaveStorage workspaceId={workspace.id} />}
            {view === 'factory-plans' && <SaveFactoryPlans workspaceId={workspace.id} />}
            {view === 'overview' && <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,23rem),1fr))] auto-rows-auto items-stretch gap-4">
                {overview?.cores.map(coreOverview => <SaveCoreCard key={coreKey(coreOverview.core)} workspace={workspace} coreOverview={coreOverview}
                    name={coreName(coreOverview.core)} disabled={disabled} />)}
            </div>}
            {(view === 'map' || view === 'overview') && overview?.cores.length === 0 && <p className="py-10 text-center text-sm text-base-content/60">{t('No Cores found in this save.')}</p>}
        </div>
        {selected && <SaveCoreDialog coreOverview={selected} name={coreName(selected.core)}
            onClose={() => runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, null])} />}
    </>;
}

export function MySavesPage() {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const workspace = useSubscription([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE]);
    const storageError = useSubscription([appIds.subscriptions.SAVES_STORAGE_ERROR]);
    const catalog = useSubscription([appIds.subscriptions.SAVES_BUILDING_CATALOG]);
    const loading = useSubscription([appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING]);
    const disabled = storageError === 'load';
    useEffect(() => () => { runtime.dispatch([appIds.events.SAVES_IMPORT_CLOSE]); }, [runtime]);
    return <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-base-100">
        {storageError && <div role="alert" className="shrink-0 px-3 py-2 text-sm text-error">
            {storageError === 'load'
                ? t('Your saves could not be loaded. Reload this page to try again.')
                : t('Some changes could not be saved in this browser and may be lost when you close this page.')}
        </div>}
        {workspace ? <SaveOverview key={workspace.id} workspace={workspace} disabled={disabled} /> :
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
                <section className="my-auto w-full max-w-xl">
                    <h1 className="text-center text-xl font-semibold">{t('StarRupture Interactive Map')}</h1>
                    <p className="mb-4 mt-2 text-center text-sm leading-relaxed text-base-content/75">{t('Explore your own factory on an interactive StarRupture map. Import a save to find buildings, follow cargo connections, and inspect power networks and Core heat.')}</p>
                    <p className="mb-4 text-center text-sm leading-relaxed text-base-content/75">{t('Spoiler-free: a map of your factories from your save, not the game world. No hidden locations or points of interest are revealed.')}</p>
                    <div className="mb-5 text-center">
                        <button type="button" className="btn btn-outline btn-sm" disabled={disabled || loading || !catalog}
                            onClick={() => runtime.dispatch([appIds.events.SAVES_OPEN_DEMO, t('Demo factory')])}>{t('Try a demo factory')}</button>
                    </div>
                    <SaveImportCompatibility />
                    <SaveFileDropZone disabled={disabled} onFile={file => {
                        runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, crypto.randomUUID()]);
                        runtime.dispatch([appIds.events.SAVES_IMPORT_READ, file]);
                    }} />
                    <SaveFileLocation />
                    <p className="mt-4 text-sm leading-relaxed text-base-content/70">{t('Map settings include cargo links, Core bounds and resource icons on buildings. Toggle Power networks to see connected buildings.')}</p>
                </section>
            </div>}
        <SaveImportDialog />
    </div>;
}
