import { SettingsIcon } from '@/shared/ui/SettingsIcon';
import { useEffect, useId, useRef, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { MAX_ARCHIVE_BYTES, type PlannerArchive } from '../archive';

export function GlobalSettingsButton({ onClick }: { onClick: () => void }) {
    return <button type="button" className="btn btn-ghost btn-sm btn-square" title="Global settings" aria-label="Global settings" onClick={onClick}>
        <SettingsIcon />
    </button>;
}

function ArchiveChecklist({ title, entries, selected, onChange }: {
    title: string;
    entries: { id: string; name: string }[];
    selected: string[];
    onChange: (ids: string[]) => void;
}) {
    const all = entries.length > 0 && entries.every(entry => selected.includes(entry.id));
    const some = entries.some(entry => selected.includes(entry.id));
    const checkbox = useRef<HTMLInputElement>(null);
    useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = some && !all; }, [some, all]);
    return <fieldset className="min-w-0 rounded-lg border border-base-300 p-3">
        <legend className="px-1 text-sm font-semibold">{title} ({entries.length})</legend>
        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
            <input ref={checkbox} type="checkbox" className="checkbox checkbox-sm rounded-none border-base-content/30 shadow-none checked:border-base-content/60 checked:bg-base-content/10 checked:text-base-content indeterminate:bg-base-content/10" checked={all} disabled={!entries.length}
                onChange={event => onChange(event.target.checked ? entries.map(entry => entry.id) : [])} />
            Select all {title.toLowerCase()}
        </label>
        <div className="max-h-48 space-y-1 overflow-y-auto">
            {entries.map(entry => <label key={entry.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-base-200">
                <input type="checkbox" className="checkbox checkbox-sm rounded-none border-base-content/30 shadow-none checked:border-base-content/60 checked:bg-base-content/10 checked:text-base-content" checked={selected.includes(entry.id)}
                    onChange={event => onChange(event.target.checked ? [...selected, entry.id] : selected.filter(id => id !== entry.id))} />
                <span className="min-w-0 break-words">{entry.name}</span>
            </label>)}
            {!entries.length && <p className="py-2 text-xs text-base-content/60">No {title.toLowerCase()} yet.</p>}
        </div>
    </fieldset>;
}

function ImportPreview({ archive, dataVersion }: { archive: PlannerArchive; dataVersion: string }) {
    const runtime = useRuntime();
    const [baseIds, setBaseIds] = useState(() => archive.bases.map(base => base.id));
    const [planIds, setPlanIds] = useState(() => archive.plans.map(plan => plan.id));
    const selectedCount = baseIds.length + planIds.length;
    return <section aria-label="Import preview" className="mt-3 rounded-lg border border-base-300 p-3">
        <h4 className="font-semibold">Ready to import</h4>
        <p className="mt-1 mb-3 text-sm text-base-content/65">Choose what to import. Imported names will end with “Copy”.</p>
        <div className="grid gap-3 sm:grid-cols-2">
            <ArchiveChecklist title="Bases" entries={archive.bases} selected={baseIds} onChange={setBaseIds} />
            <ArchiveChecklist title="Planner plans" entries={archive.plans} selected={planIds} onChange={setPlanIds} />
        </div>
        {archive.dataVersion !== dataVersion && <p className="mt-3 text-sm text-warning" role="status">
            This file uses game data “{archive.dataVersion}”; you are using “{dataVersion}”. Some items or recipes may be unavailable. You can change the game version in the header.
        </p>}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => runtime.dispatch([appIds.events.DATA_TRANSFER_CANCEL_IMPORT])}>Cancel import</button>
            <button type="button" className="btn btn-sm btn-primary" disabled={!selectedCount}
                onClick={() => runtime.dispatch([appIds.events.DATA_TRANSFER_CONFIRM_IMPORT, { baseIds, planIds }])}>Import selected ({selectedCount})</button>
        </div>
    </section>;
}

export function GlobalSettings({ onClose }: { onClose: () => void }) {
    const runtime = useRuntime();
    const bases = useSubscription([appIds.subscriptions.BASES_LIST]);
    const plans = useSubscription([appIds.subscriptions.PLANNER_TABS]);
    const preview = useSubscription([appIds.subscriptions.DATA_TRANSFER_PREVIEW]);
    const status = useSubscription([appIds.subscriptions.DATA_TRANSFER_STATUS]);
    const theme = useSubscription([appIds.subscriptions.UI_THEME]);
    const dataVersion = useSubscription([appIds.subscriptions.APP_DATA_VERSION]);
    const [baseIds, setBaseIds] = useState<string[]>(() => bases.map(base => base.id));
    const [planIds, setPlanIds] = useState<string[]>(() => plans.map(plan => plan.id));
    const [reading, setReading] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const mounted = useRef(true);
    const titleId = useId();
    const selectedCount = bases.filter(base => baseIds.includes(base.id)).length + plans.filter(plan => planIds.includes(plan.id)).length;

    useEffect(() => {
        mounted.current = true;
        const element = dialog.current;
        element?.showModal();
        return () => { mounted.current = false; element?.close(); };
    }, []);
    const close = () => {
        runtime.dispatch([appIds.events.DATA_TRANSFER_CANCEL_IMPORT]);
        onClose();
    };

    return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={close}
        onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <div className="modal-box max-w-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
                <h2 id={titleId} className="text-xl font-semibold">Global settings</h2>
                <button type="button" className="btn btn-sm btn-ghost btn-square" aria-label="Close settings" onClick={close}>✕</button>
            </div>
            <section className="mb-5 border-b border-base-300 pb-5" aria-labelledby={`${titleId}-appearance`}>
                <h3 id={`${titleId}-appearance`} className="mb-3 font-semibold">Appearance</h3>
                <label className="flex items-center justify-between gap-4 text-sm">
                    Theme
                    <select className="select select-sm select-bordered w-32" value={theme}
                        onChange={event => {
                            const value = event.target.value;
                            if (value === 'light' || value === 'dark') runtime.dispatch([appIds.events.UI_SET_THEME, value]);
                        }}>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </label>
            </section>
            <section aria-labelledby={`${titleId}-export`}>
                <h3 id={`${titleId}-export`} className="font-semibold">Export bases and plans</h3>
                <p className="mt-1 mb-4 text-sm text-base-content/65">Save a JSON file to back up or share your work. Bases include their buildings, production plans, and energy groups. Planner plans are your saved planner tabs.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                    <ArchiveChecklist title="Bases" entries={bases} selected={baseIds} onChange={setBaseIds} />
                    <ArchiveChecklist title="Planner plans" entries={plans} selected={planIds} onChange={setPlanIds} />
                </div>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button type="button" className="btn btn-sm btn-outline" disabled={!bases.length && !plans.length}
                        onClick={() => runtime.dispatch([appIds.events.DATA_TRANSFER_EXPORT, { baseIds: null, planIds: null }])}>Export all</button>
                    <button type="button" className="btn btn-sm btn-primary" disabled={!selectedCount}
                        onClick={() => runtime.dispatch([appIds.events.DATA_TRANSFER_EXPORT, { baseIds, planIds }])}>Export selected ({selectedCount})</button>
                </div>
            </section>
            <section className="mt-6 border-t border-base-300 pt-5" aria-labelledby={`${titleId}-import`}>
                <h3 id={`${titleId}-import`} className="font-semibold">Import bases and plans</h3>
                <p className="mt-1 mb-3 text-sm text-base-content/65">Imports add new copies and keep your existing work. Links between selected bases stay connected. Links to bases you leave out become standalone inputs with their saved item and rate.</p>
                <label className="flex flex-col gap-2 text-sm">
                    Choose a Rupture Planner export
                    <input type="file" accept=".json,application/json" className="file-input file-input-bordered w-full" disabled={reading}
                        onChange={async event => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (!file) return;
                            runtime.dispatch([appIds.events.DATA_TRANSFER_CANCEL_IMPORT]);
                            runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, null]);
                            setReading(true);
                            try {
                                if (file.size > MAX_ARCHIVE_BYTES) throw new Error('Choose an export smaller than 20 MB.');
                                const text = await file.text();
                                if (mounted.current) runtime.dispatch([appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, text]);
                            } catch (error) {
                                if (mounted.current) runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, {
                                    kind: 'error', message: error instanceof Error ? error.message : 'Could not read the file.',
                                }]);
                            } finally { if (mounted.current) setReading(false); }
                        }} />
                </label>
                {reading && <p role="status" className="mt-2 text-sm">Reading export…</p>}
                {preview && <ImportPreview key={`${preview.bases[0]?.id ?? ''}:${preview.plans[0]?.id ?? ''}`} archive={preview} dataVersion={dataVersion} />}
            </section>
            {status && <p role={status.kind === 'error' ? 'alert' : 'status'} className={`mt-4 rounded-md p-3 text-sm ${status.kind === 'error' ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>{status.message}</p>}
        </div>
    </dialog>;
}
