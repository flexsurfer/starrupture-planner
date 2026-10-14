import { useEffect, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { message, useTranslation } from '@/shared/i18n';
import { coreKey } from '../snapshot';
import type { SaveWorkspace } from '../types';
import { SaveCoreCard, SaveBuildingSections } from './SaveCoreCards';
import { SaveImportDialog, SaveFileDropZone, SaveImportCompatibility } from './SaveImportDialog';
import { SaveMap } from './SaveMap';

function SaveOverview({ workspace, disabled }: { workspace: SaveWorkspace; disabled: boolean }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const overview = useSubscription([appIds.subscriptions.SAVES_OVERVIEW, workspace.id]);
    const selected = useSubscription([appIds.subscriptions.SAVES_SELECTED_CORE, workspace.id]);
    const [view, setView] = useState<'overview' | 'map'>('overview');
    const coreName = (core: { id: number; name: string | null }) => core.name ?? t('Core {number}', {
        number: (overview?.cores.findIndex(coreOverview => coreOverview.core.id === core.id) ?? 0) + 1,
    });
    const updated = workspace.snapshot.savedAt?.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3 $4:$5') ?? '—';
    const remove = () => runtime.dispatch([
        appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
        message('Remove {name}?', { name: workspace.name }), message('This removes this save and its Core settings from this browser.'),
        () => runtime.dispatch([appIds.events.SAVES_REMOVE_WORKSPACE, workspace.id]),
        { confirmLabel: message('Remove save'), confirmButtonClass: 'btn-error' },
    ]);
    return <>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-0.5 px-2 py-0.5">
            <div className="tabs tabs-bordered tabs-sm" role="tablist" aria-label={t('Save view')}>
                {(['overview', 'map'] as const).map(tab => <button key={tab} type="button" role="tab"
                    id={`save-view-${tab}`} aria-controls={`save-panel-${tab}`} aria-selected={view === tab}
                    tabIndex={view === tab ? 0 : -1}
                    className={`tab h-7 min-h-7 shrink-0 px-2 sm:px-3 text-xs font-semibold ${view === tab ? 'tab-active' : ''}`}
                    onClick={() => setView(tab)} onKeyDown={event => {
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const next = event.key === 'Home' ? 'overview' : event.key === 'End' ? 'map' : view === 'overview' ? 'map' : 'overview';
                        setView(next);
                        document.getElementById(`save-view-${next}`)?.focus();
                    }}>{t(tab === 'overview' ? 'Overview' : 'Map')}</button>)}
            </div>
            <p className="order-last w-full px-2 pb-1 text-xs text-base-content/50 sm:order-none sm:ml-auto sm:w-auto sm:p-0">{t('Last updated: {date}', { date: updated })}</p>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
                <button type="button" className="btn btn-ghost btn-xs h-7 min-h-7" disabled={disabled}
                    onClick={() => runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, workspace.id])}>{t('Update')}</button>
                <button type="button" className="btn btn-ghost btn-xs h-7 min-h-7 text-error" disabled={disabled} onClick={remove}>{t('Remove')}</button>
            </div>
        </div>
        <div id={`save-panel-${view}`} role="tabpanel" aria-labelledby={`save-view-${view}`}
            className={view === 'map' ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-0 flex-1 overflow-auto p-3 sm:p-4'}>
            {view === 'map' ? <SaveMap key={selected?.core.id ?? 'all'} workspace={workspace} initialCoreId={selected?.core.id ?? null} onOpenCore={id => {
                runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, id]);
                setView('overview');
            }} /> : selected ? <div className="space-y-3">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, null])}>
                    <span aria-hidden="true">←</span>{t('Back to save overview')}
                </button>
                <SaveCoreCard workspace={workspace} coreOverview={selected} name={coreName(selected.core)} disabled={disabled} detail />
                <SaveBuildingSections key={coreKey(selected.core)} coreOverview={selected} />
            </div> : <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,23rem),1fr))] auto-rows-fr gap-4">
                {overview?.cores.map(coreOverview => <SaveCoreCard key={coreKey(coreOverview.core)} workspace={workspace} coreOverview={coreOverview}
                    name={coreName(coreOverview.core)} disabled={disabled} />)}
            </div>}
            {overview?.cores.length === 0 && <p className="py-10 text-center text-sm text-base-content/60">{t('No Cores found in this save.')}</p>}
        </div>
    </>;
}

export function MySavesPage() {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const workspace = useSubscription([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE]);
    const storageError = useSubscription([appIds.subscriptions.SAVES_STORAGE_ERROR]);
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
                    <h1 className="text-center text-xl font-semibold">{t('Import your first save')}</h1>
                    <p className="mb-5 mt-2 text-center text-sm text-base-content/60">{t('Import a StarRupture save to see your Cores, buildings and resources.')}</p>
                    <SaveImportCompatibility />
                    <SaveFileDropZone disabled={disabled} onFile={file => {
                        runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, crypto.randomUUID()]);
                        runtime.dispatch([appIds.events.SAVES_IMPORT_READ, file]);
                    }} />
                </section>
            </div>}
        <SaveImportDialog />
    </div>;
}
