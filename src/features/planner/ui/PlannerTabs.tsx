import { useEffect, useId, useRef, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import type { PlannerMode, PlannerTab } from '../state';

export function PlannerTabs() {
    const runtime = useRuntime();
    const tabs = useSubscription([appIds.subscriptions.PLANNER_TABS]);
    const activeTab = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TAB]);
    const list = useRef<HTMLDivElement>(null);

    useEffect(() => {
        list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [activeTab?.id]);

    const close = (tab: PlannerTab) => runtime.dispatch([
        appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
        `Close “${tab.name}”?`,
        'This will permanently delete this tab and all its planner settings, targets, amounts, and recipes.',
        () => runtime.dispatch([appIds.events.PLANNER_CLOSE_TAB, tab.id]),
        { confirmLabel: 'Delete tab', confirmButtonClass: 'btn-error' },
    ]);

    return <div className="planner-tab-bar">
        <div ref={list} role="tablist" aria-label="Planner tabs" className="planner-tab-list">
            {tabs.map((tab, index) => <div key={tab.id} className={`planner-tab ${tab.id === activeTab?.id ? 'is-active' : ''}`}>
                <button type="button" role="tab" id={`planner-tab-${tab.id}`}
                    aria-controls="planner-tab-panel" aria-selected={tab.id === activeTab?.id}
                    tabIndex={tab.id === activeTab?.id ? 0 : -1}
                    className="planner-tab-select" title={`${tab.name} — ${tab.mode === 'single' ? 'Single target' : 'Multi-target'}`}
                    onClick={() => runtime.dispatch([appIds.events.PLANNER_SELECT_TAB, tab.id])}
                    onKeyDown={event => {
                        if (event.key === 'Delete') { event.preventDefault(); close(tab); return; }
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                        runtime.dispatch([appIds.events.PLANNER_SELECT_TAB, tabs[next].id]);
                        list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                    }}>
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-sky-500" fill="none" stroke="currentColor">
                        <path d="M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3M6 8h4M6 10.5h4" />
                        {tab.mode === 'multi' && <path d="M1.5 4v11.5h9" />}
                    </svg>
                    <span className="truncate">{tab.name}</span>
                </button>
                <button type="button" className="planner-tab-close" aria-label={`Close ${tab.name}`} title="Close tab"
                    onClick={() => close(tab)}>
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor"><path d="m4 4 8 8m0-8-8 8" /></svg>
                </button>
            </div>)}
        </div>
        <button type="button" className="planner-tab-add" aria-label="Create new planner tab" title="New planner tab"
            onClick={() => runtime.dispatch([appIds.events.PLANNER_REQUEST_TAB_CREATION])}>
            <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor"><path d="M8 2v12M2 8h12" /></svg>
        </button>
    </div>;
}

function CreateTabForm({ initialName, onCancel }: { initialName: string; onCancel?: () => void }) {
    const runtime = useRuntime();
    const [name, setName] = useState(initialName);
    const [mode, setMode] = useState<PlannerMode>('single');
    const id = useId();

    return <form className="flex flex-col gap-5" onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) return;
        const view = window.matchMedia?.('(max-width: 639px)').matches ? 'table' : 'graph';
        runtime.dispatch([appIds.events.PLANNER_CREATE_TAB, crypto.randomUUID(), name, mode, view]);
    }}>
        <label className="flex flex-col gap-2 text-sm" htmlFor={`${id}-name`}>
            Tab name
            <input id={`${id}-name`} className="input input-bordered w-full" placeholder="e.g. Steel production"
                autoFocus required value={name} onChange={event => setName(event.target.value)} />
        </label>
        <fieldset>
            <legend className="mb-2 text-sm">Planner mode</legend>
            <div className="grid grid-cols-2 gap-3">
                {(['single', 'multi'] as const).map(value => <label key={value}
                    className={`cursor-pointer rounded-md border p-3 text-sm ${mode === value ? 'border-primary bg-primary/10' : 'border-base-300'}`}>
                    <span className="flex items-center gap-2">
                        <input type="radio" className="radio radio-sm radio-primary" name={`${id}-mode`} value={value}
                            checked={mode === value} onChange={() => setMode(value)} />
                        {value === 'single' ? 'Single target' : 'Multi-target'}
                    </span>
                    <span className="mt-2 block text-xs text-base-content/60">
                        {value === 'single' ? 'Plan production for one item.' : 'Plan several items together.'}
                    </span>
                </label>)}
            </div>
            <p className="mt-2 text-xs text-base-content/60">The mode cannot be changed after creating the tab.</p>
        </fieldset>
        <div className="flex justify-end gap-2">
            {onCancel && <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>}
            <button type="submit" className="btn btn-primary" disabled={!name.trim()}>Create tab</button>
        </div>
    </form>;
}

export function PlannerTabCreation({ empty = false }: { empty?: boolean }) {
    const runtime = useRuntime();
    const request = useSubscription([appIds.subscriptions.PLANNER_TAB_CREATION]);
    const items = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
    const dialog = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const cancel = () => runtime.dispatch([appIds.events.PLANNER_CANCEL_TAB_CREATION]);
    const initialName = request?.itemId ? items[request.itemId]?.name ?? request.itemId : '';

    useEffect(() => {
        if (!empty && request) {
            const element = dialog.current;
            element?.showModal();
            return () => element?.close();
        }
    }, [empty, request]);

    if (empty) return <div className="flex flex-1 items-center justify-center overflow-auto p-4 sm:p-8">
        <section className="w-full max-w-md rounded-lg border border-base-300 bg-base-200 p-6 shadow-sm">
            <h1 className="text-xl font-semibold">Create your first planner tab</h1>
            <p className="mt-2 mb-6 text-sm text-base-content/60">Give your plan a name and choose a mode. Your tabs and settings are saved automatically.</p>
            <CreateTabForm key={request?.itemId ?? 'empty'} initialName={initialName} />
        </section>
    </div>;
    if (!request) return null;
    return <dialog ref={dialog} className="modal" aria-labelledby={titleId} onCancel={cancel}
        onClick={event => { if (event.target === event.currentTarget) cancel(); }}>
        <div className="modal-box max-w-md">
            <h2 id={titleId} className="mb-5 text-lg font-semibold">Create planner tab</h2>
            <CreateTabForm initialName={initialName} onCancel={cancel} />
        </div>
    </dialog>;
}
