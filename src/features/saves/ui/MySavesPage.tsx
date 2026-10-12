import { useEffect, useId, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation } from '@/shared/i18n';
import { NavigationHeader } from '@/shared/ui/NavigationHeader';
import { coreKey } from '../snapshot';
import type { SaveWorkspace } from '../types';
import { SaveTabs } from './SaveTabs';
import { SaveCoreCard, SaveBuildingSections } from './SaveCoreCards';
import { SaveImportDialog, SaveFileDropZone } from './SaveImportDialog';

function RenameSave({ workspace, disabled }: { workspace: SaveWorkspace; disabled: boolean }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(workspace.name);
    const id = useId();
    if (!editing) return <button className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => { setName(workspace.name); setEditing(true); }}>{t('Rename')}</button>;
    return <form className="flex w-48 flex-wrap items-end gap-2 sm:w-64" onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) return;
        runtime.dispatch([appIds.events.SAVES_RENAME_WORKSPACE, workspace.id, name]);
        setEditing(false);
    }}>
        <label htmlFor={id} className="flex w-full flex-col gap-1 text-xs">{t('Save name')}
            <input id={id} className="input input-bordered input-sm w-full min-w-0" value={name} autoFocus maxLength={120}
                disabled={disabled} required onChange={event => setName(event.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={disabled || !name.trim()}>{t('Save')}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>{t('Cancel')}</button>
    </form>;
}

function SaveOverview({ workspace, disabled }: { workspace: SaveWorkspace; disabled: boolean }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const overview = useSubscription([appIds.subscriptions.SAVES_OVERVIEW, workspace.id]);
    const selected = useSubscription([appIds.subscriptions.SAVES_SELECTED_CORE, workspace.id]);
    const coreName = (core: { id: number; name: string | null }) => core.name ?? t('Core {number}', {
        number: (overview?.cores.findIndex(coreOverview => coreOverview.core.id === core.id) ?? 0) + 1,
    });
    const updated = workspace.snapshot.savedAt?.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1-$2-$3 $4:$5');
    return <>
        <NavigationHeader title={selected ? coreName(selected.core) : workspace.name}
            breadcrumbs={[{ label: t('My Saves') }, { label: workspace.name, onClick: selected ? () => runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, null]) : undefined },
                ...(selected ? [{ label: coreName(selected.core) }] : [])]}
            back={selected ? { label: t('Back to save overview'), onClick: () => runtime.dispatch([appIds.events.SAVES_SELECT_CORE, workspace.id, null]) } : undefined}
            actions={<>
                <button type="button" className="btn btn-ghost btn-sm" disabled={disabled}
                    onClick={() => runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, workspace.id])}>{t('Update save')}</button>
                <RenameSave key={workspace.id} workspace={workspace} disabled={disabled} />
            </>} />
        <div className="space-y-4 p-3 sm:p-5">
            {updated && <p className="text-xs text-base-content/40">{t('Last updated: {date}', { date: updated })}</p>}
            <p className="text-xs text-base-content/45">{t('Nominal capacity from configured recipes. Cargo links use 240/min; launchers use 10/min. Running state is ignored.')}</p>
            {selected ? <>
                <SaveCoreCard workspace={workspace} coreOverview={selected} name={coreName(selected.core)} disabled={disabled} detail />
                <SaveBuildingSections key={coreKey(selected.core)} coreOverview={selected} />
            </> : <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,23rem),1fr))] items-start gap-4">
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
    const openImport = () => runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, crypto.randomUUID()]);
    return <div className="flex min-h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 p-3">
            <h1 className="text-lg font-semibold">{t('My Saves')}</h1>
            <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={openImport}>{t('Import save')}</button>
        </header>
        {storageError && <div role="alert" className="px-3 py-2 text-sm text-error">
            {storageError === 'load'
                ? t('Your saves could not be loaded. Reload this page to try again.')
                : t('Some changes could not be saved in this browser and may be lost when you close this page.')}
        </div>}
        {workspace ? <>
            <SaveTabs disabled={disabled} />
            <div id="save-tab-panel" role="tabpanel" aria-labelledby={`save-tab-${workspace.id}`} tabIndex={0}>
                <SaveOverview key={workspace.id} workspace={workspace} disabled={disabled} />
            </div>
        </> : !disabled && <section className="mx-auto my-10 w-full max-w-xl px-4">
            <h2 className="text-center text-xl font-semibold">{t('Import your first save')}</h2>
            <p className="mb-6 mt-3 text-center text-sm text-base-content/60">{t('Import a StarRupture save to see your Cores, buildings and resources.')}</p>
            <SaveFileDropZone onFile={file => {
                runtime.dispatch([appIds.events.SAVES_IMPORT_OPEN, crypto.randomUUID()]);
                runtime.dispatch([appIds.events.SAVES_IMPORT_READ, file]);
            }} />
        </section>}
        <SaveImportDialog />
    </div>;
}
