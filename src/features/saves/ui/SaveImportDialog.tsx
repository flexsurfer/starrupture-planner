import { useEffect, useId, useRef, useState } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { useTranslation, type MessageKey } from '@/shared/i18n';
import type { SaveImportState } from '../types';

const errors: Record<NonNullable<SaveImportState['error']>, MessageKey> = {
    'core-identity': 'A Core identity could not be read.',
    position: 'A building could not be assigned to its nearest Core.',
    transport: 'Cargo connections must pair one dispatcher with one receiver.',
    selection: 'Choose a .sav game save.', extension: 'Choose a .sav game save.',
    'file-size': 'This file is too large to import.', 'decoded-size': 'This file is too large to import.', complexity: 'This file is too large to import.',
    compression: 'This file could not be decoded as a supported StarRupture save.',
    'size-mismatch': 'This file could not be decoded as a supported StarRupture save.', structure: 'This file could not be decoded as a supported StarRupture save.',
    'unsupported-browser': 'This browser does not support save import.',
    read: 'Could not read this save. Try choosing the file again.', timeout: 'Reading the save timed out. Try again.',
    catalog: 'This save cannot be imported with the supported game data.', mappings: 'This save cannot be imported with the supported game data.',
    'mapping-version': 'This save cannot be imported with the supported game data.', 'workspace-limit': 'There is no room for another save. Remove a save and try again.',
    'save-storage-limit': 'This save is too large to store in this browser.',
};


export function SaveImportCompatibility() {
    const { t } = useTranslation();
    return <div className="mb-4 rounded-lg border border-warning/25 bg-warning/5 px-4 py-3 text-center">
        <p className="text-xs font-semibold text-warning">{t('Experimental functionality')}</p>
        <p className="mt-1 text-xs leading-relaxed text-base-content/60">{t('Only tested with {dataVersion} game data and .sav files from StarRupture {gameVersion}.', {
            dataVersion: 'Update 2 QoL', gameVersion: '0.3.5',
        })}</p>
    </div>;
}

export function SaveFileDropZone({ onFile, busy = false, disabled = false, fileName }: {
    onFile: (file: File) => void; busy?: boolean; disabled?: boolean; fileName?: string | null;
}) {
    const { t } = useTranslation();
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [selectionError, setSelectionError] = useState(false);
    const read = (files: FileList) => {
        if (busy || disabled) return;
        setSelectionError(files.length !== 1);
        if (files.length === 1) onFile(files[0]);
    };
    return <div role="region" aria-label={t('Save import')} aria-busy={busy}
        className={`rounded-xl border-2 border-dashed px-5 py-10 text-center transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-base-content/20 bg-base-200/40'}`}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy || disabled ? 'none' : 'copy'; setDragging(!busy && !disabled); }}
        onDragLeave={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={event => { event.preventDefault(); setDragging(false); read(event.dataTransfer.files); }}>
        {busy ? <div role="status" className="space-y-3">
            <span className="loading loading-spinner loading-md text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">{t('Reading and decoding save…')}</p>
            <p className="break-all text-xs text-base-content/60">{fileName}</p>
        </div> : <>
            <svg aria-hidden="true" className="mx-auto mb-4 size-9 text-base-content/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m-4-4 4 4 4-4M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
            </svg>
            <p className="mb-5 text-sm text-base-content/70">{t('Drop a .sav file here, or choose one from your computer.')}</p>
            <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => input.current?.click()}>{t('Choose save file')}</button>
        </>}
        <input ref={input} type="file" accept=".sav" className="hidden" aria-label={t('Choose save file')} disabled={busy || disabled}
            onChange={event => { if (event.currentTarget.files?.length) read(event.currentTarget.files); event.currentTarget.value = ''; }} />
        {selectionError && <p role="alert" className="mt-3 text-sm text-error">{t('Choose one save file at a time.')}</p>}
    </div>;
}

export function SaveFileLocation() {
    const { t } = useTranslation();
    const id = useId();
    return <section className="mt-4 rounded-lg bg-base-200 p-4" aria-labelledby={`${id}-location`}>
        <h3 id={`${id}-location`} className="text-sm font-semibold">{t('Where to find .sav files')}</h3>
        <code className="mt-2 block break-all select-text text-xs">{'C:\\Program Files (x86)\\Steam\\userdata\\[SteamNumber]\\1631270\\remote\\Saved\\SaveGames'}</code>
        <p className="mt-2 text-xs leading-relaxed text-base-content/60">{t('Open this folder in File Explorer, replacing [SteamNumber] with your Steam account folder number. If Steam is installed elsewhere, use that installation folder instead.')}</p>
    </section>;
}

export function SaveImportDialog() {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const candidate = useSubscription([appIds.subscriptions.SAVES_IMPORT]);
    const existing = useSubscription([appIds.subscriptions.SAVES_WORKSPACE_BY_ID, candidate.targetWorkspaceId ?? '']);
    const dialog = useRef<HTMLDialogElement>(null);
    const id = useId();
    const open = candidate.phase !== 'closed';
    const close = () => runtime.dispatch([appIds.events.SAVES_IMPORT_CLOSE]);
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const element = dialog.current;
        element?.showModal();
        return () => { element?.close(); if (previous?.isConnected) previous.focus(); };
    }, [open]);
    if (!open) return null;
    return <dialog ref={dialog} className="modal" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }}
        onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <div className="modal-box max-w-xl p-0">
            <header className="border-b border-base-300 px-5 py-4"><h2 id={`${id}-title`} className="text-xl font-semibold">{t(existing ? 'Update save' : 'Import save')}</h2></header>
            <div className="p-5 sm:p-6">
                <SaveImportCompatibility />
                <p className="mb-4 text-sm text-base-content/60">{t('The save is decoded locally in your browser. Maximum file size: 32 MiB.')}</p>
                <SaveFileDropZone busy={candidate.phase === 'reading'} fileName={candidate.fileName}
                    onFile={file => runtime.dispatch([appIds.events.SAVES_IMPORT_READ, file])} />
                <SaveFileLocation />
                {candidate.error && <p role="alert" className="mt-4 text-sm text-error">{t(errors[candidate.error])}</p>}
            </div>
            <footer className="flex justify-end border-t border-base-300 px-5 py-3"><button type="button" className="btn btn-ghost btn-sm" onClick={close}>{t('Cancel import')}</button></footer>
        </div>
    </dialog>;
}
