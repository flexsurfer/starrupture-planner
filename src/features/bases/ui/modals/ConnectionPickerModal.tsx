import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from '@/shared/i18n';
import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { ConnectionSelector, type ConnectionOption } from '../components/ConnectionSelector';
import { ConnectionCard, type ConnectionCardData } from '../components/ConnectionCard';

interface ConnectionPickerModalProps<T extends ConnectionOption> {
    isOpen: boolean;
    direction: 'input' | 'output';
    entries: T[];
    onSelect: (entry: T) => void;
    onClose: () => void;
    currentBaseId?: string;
    currentBuildingId?: string;
    currentBuilding?: ConnectionCardData;
    title?: string;
    headerAction?: ReactNode;
    currentConnections?: string[];
    onDisconnect?: () => void;
    onClear?: () => void;
}

function CurrentBuildingSummary({ baseId, buildingId, draft, direction, connected }: {
    baseId?: string;
    buildingId?: string;
    draft?: ConnectionCardData;
    direction: 'input' | 'output';
    connected: boolean;
}) {
    const { t } = useTranslation();
    const saved = useSubscription([appIds.subscriptions.BASES_CONNECTION_BUILDING, baseId ?? null, buildingId ?? null]);
    const building = draft ?? (saved ? { ...saved, name: saved.buildingName } : null);
    if (!building) return null;
    return <div className="@container shrink-0 border-b border-base-300 p-4">
        <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] @lg:grid-cols-[minmax(0,1fr)_6.5rem_minmax(0,1fr)]">
            <div className={`min-w-0 space-y-2 ${direction === 'input' ? 'col-start-1' : 'col-start-3'}`}>
                <p className="text-xs font-medium text-base-content/60">{t('Current building')}</p>
                <ConnectionCard {...building} label={t('Current building')} highlighted={connected} />
            </div>
        </div>
    </div>;
}

export function ConnectionPickerModal<T extends ConnectionOption>({
    isOpen, direction, entries, onSelect, onClose, currentBaseId, title, headerAction,
    currentConnections = [], onDisconnect, onClear, currentBuildingId, currentBuilding,
}: ConnectionPickerModalProps<T>) {
    const { t } = useTranslation();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        if (!isOpen) return;
        const element = dialog.current;
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        element?.showModal();
        element?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
        return () => {
            element?.close();
            if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
        };
    }, [isOpen]);
    if (!isOpen) return null;
    const modalTitle = title ?? (direction === 'input' ? t('Link Input') : t('Link Output'));

    return <dialog ref={dialog} className="modal" aria-label={modalTitle} onCancel={onClose}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="modal-box max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-base-300">
                <div className="flex flex-wrap items-center gap-3">
                    <h3 className="mr-auto font-bold text-lg">{modalTitle}</h3>
                    {headerAction}
                    <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose} aria-label={t('Close modal')}>✕</button>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto sm:overflow-hidden">
                {(currentBuilding || currentBuildingId) && <CurrentBuildingSummary baseId={currentBaseId}
                    buildingId={currentBuildingId} draft={currentBuilding} direction={direction} connected={currentConnections.length > 0} />}
                <div className="shrink-0 p-4 space-y-3 sm:flex-1 sm:shrink sm:overflow-y-auto">
                    {currentConnections.length > 0 && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2">
                        <p className="min-w-0 flex-1 text-sm break-words">{t('Connected to {connections}. Disconnect first.', { connections: currentConnections.join('; ') })}</p>
                        {onDisconnect && <button type="button"
                            className="btn btn-ghost btn-xs btn-square size-6 min-h-6 shrink-0 p-0 text-base-content/45 hover:text-error"
                            onClick={onDisconnect}
                            aria-label={currentConnections.length > 1 ? t('Disconnect all') : t('Disconnect')}
                            title={currentConnections.length > 1 ? t('Disconnect all') : t('Disconnect')}>
                            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                <path d="m2 2 20 20" />
                            </svg>
                        </button>}
                    </div>}
                    <ConnectionSelector entries={entries} direction={direction} currentBaseId={currentBaseId}
                        currentBuildingId={currentBuildingId}
                        onSelect={onSelect} disabled={currentConnections.length > 0} autoFocus={false}
                        emptyMessage={direction === 'input' ? t('No compatible inputs found.') : t('No compatible outputs found.')} />
                </div>
            </div>
            <div className="px-6 py-3 border-t border-base-300 flex justify-end gap-2">
                {onClear && <button type="button" className="btn btn-sm btn-ghost mr-auto" onClick={onClear}>{t('No target')}</button>}
                <button type="button" className="btn btn-sm" onClick={onClose}>{t('Cancel')}</button>
            </div>
        </div>
    </dialog>;
}
