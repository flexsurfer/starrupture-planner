import { useEffect, useRef } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { message } from '@/shared/i18n/core';
import { useTranslation } from '@/shared/i18n';

export function SaveTabs({ disabled }: { disabled: boolean }) {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const tabs = useSubscription([appIds.subscriptions.SAVES_TABS]);
    const active = useSubscription([appIds.subscriptions.SAVES_ACTIVE_WORKSPACE]);
    const list = useRef<HTMLDivElement>(null);
    useEffect(() => {
        list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [active?.id]);
    const remove = (id: string, name: string) => runtime.dispatch([
        appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
        message('Remove {name}?', { name }), message('This removes this save and its Core settings from this browser.'),
        () => runtime.dispatch([appIds.events.SAVES_REMOVE_WORKSPACE, id]),
        { confirmLabel: message('Remove save'), confirmButtonClass: 'btn-error' },
    ]);
    return <div className="planner-tab-bar">
        <div ref={list} role="tablist" aria-label={t('Save tabs')} className="planner-tab-list">
            {tabs.map((tab, index) => <div key={tab.id} className={`planner-tab ${active?.id === tab.id ? 'is-active' : ''}`}>
                <button type="button" role="tab" id={`save-tab-${tab.id}`} aria-controls="save-tab-panel"
                    aria-selected={active?.id === tab.id} tabIndex={active?.id === tab.id ? 0 : -1}
                    disabled={disabled} className="planner-tab-select" title={tab.name}
                    onClick={() => runtime.dispatch([appIds.events.SAVES_SELECT_WORKSPACE, tab.id])}
                    onKeyDown={event => {
                        if (event.key === 'Delete') { event.preventDefault(); remove(tab.id, tab.name); return; }
                        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                        event.preventDefault();
                        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
                            : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                        runtime.dispatch([appIds.events.SAVES_SELECT_WORKSPACE, tabs[next].id]);
                        list.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
                    }}>
                    <span className="truncate">{tab.name}</span>
                </button>
                <button type="button" className="planner-tab-close" disabled={disabled}
                    aria-label={t('Remove save {name}', { name: tab.name })} onClick={() => remove(tab.id, tab.name)}>
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor"><path d="m4 4 8 8m0-8-8 8" /></svg>
                </button>
            </div>)}
        </div>
    </div>;
}
