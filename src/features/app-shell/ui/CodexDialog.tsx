import { useId, useState } from 'react';
import { ItemsPage } from '@/features/items/ui';
import { BuildingsPage } from '@/features/buildings/ui';
import { CorporationsPage } from '@/features/corporations/ui';
import { useTranslation } from '@/shared/i18n';
import { toolPaths } from '@/shared/navigation/toolPaths';
import { SectionIcon } from '@/shared/ui';
import { CodexViewContext } from '@/shared/ui/CodexViewContext';
import { useModalDialog } from '@/shared/ui/useModalDialog';
import { OpenInNewTabIcon } from './CodexMenu';
import { codexSections, type CodexSection } from './codex-sections';

export function CodexDialog({ initialSection, onClose }: { initialSection: CodexSection; onClose: () => void }) {
    const { t } = useTranslation();
    const [section, setSection] = useState(initialSection);
    const [visited, setVisited] = useState<CodexSection[]>([initialSection]);
    const dialog = useModalDialog();
    const id = useId();
    const selected = codexSections.find(entry => entry.id === section)!;

    const select = (next: CodexSection) => {
        setSection(next);
        setVisited(previous => previous.includes(next) ? previous : [...previous, next]);
    };

    return <dialog ref={dialog} aria-labelledby={`${id}-title`} className="modal p-0 sm:p-4"
        onCancel={event => { event.preventDefault(); event.stopPropagation(); onClose(); }}
        onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="modal-box flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden rounded-none bg-base-100 p-0 sm:h-[min(56rem,calc(100dvh-2rem))] sm:max-w-7xl sm:rounded-xl">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-base-300 bg-base-200 px-3 py-2 sm:px-4">
                <h2 id={`${id}-title`} className="flex items-center gap-2 font-semibold"><SectionIcon name="codex" />{t('Codex')}</h2>
                <div className="flex items-center gap-1">
                    <a href={toolPaths[section]} target="_blank" rel="noopener noreferrer"
                        aria-label={t('Open {name} in a new tab', { name: t(selected.label) })}
                        className="btn btn-ghost btn-sm gap-2" title={t('Open in new tab')}>
                        <OpenInNewTabIcon /><span className="hidden sm:inline">{t('Open in new tab')}</span>
                    </a>
                    <button type="button" data-dialog-autofocus onClick={onClose} className="btn btn-ghost btn-sm btn-square" aria-label={t('Close {name}', { name: t('Codex') })}>✕</button>
                </div>
            </header>
            <div role="tablist" aria-label={t('Codex')} className="flex shrink-0 border-b border-base-300 bg-base-200 px-2">
                {codexSections.map((entry, index) => <button key={entry.id} type="button" role="tab"
                    id={`${id}-${entry.id}-tab`} aria-selected={section === entry.id} aria-controls={`${id}-${entry.id}-panel`}
                    tabIndex={section === entry.id ? 0 : -1}
                    onClick={() => select(entry.id)}
                    onKeyDown={event => {
                        const nextIndex = event.key === 'ArrowRight' ? (index + 1) % codexSections.length
                            : event.key === 'ArrowLeft' ? (index + codexSections.length - 1) % codexSections.length
                            : event.key === 'Home' ? 0 : event.key === 'End' ? codexSections.length - 1 : null;
                        if (nextIndex === null) return;
                        event.preventDefault();
                        select(codexSections[nextIndex].id);
                        document.getElementById(`${id}-${codexSections[nextIndex].id}-tab`)?.focus();
                    }}
                    className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-3 text-xs font-medium sm:flex-none sm:px-4 sm:text-sm ${section === entry.id ? 'border-primary text-primary' : 'border-transparent text-base-content/60 hover:text-base-content'}`}>
                    <SectionIcon name={entry.icon} className="hidden size-4 sm:block" />{t(entry.label)}
                </button>)}
            </div>
            <CodexViewContext.Provider value={true}>
                {visited.map(entry => <div key={entry} role="tabpanel" id={`${id}-${entry}-panel`} aria-labelledby={`${id}-${entry}-tab`}
                    hidden={section !== entry} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {entry === 'items' ? <ItemsPage /> : entry === 'recipes' ? <BuildingsPage /> : <CorporationsPage />}
                </div>)}
            </CodexViewContext.Provider>
        </div>
    </dialog>;
}
