import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from '@/shared/i18n';
import { toolPaths } from '@/shared/navigation/toolPaths';
import { SectionIcon } from '@/shared/ui';
import { codexSections, type CodexSection } from './codex-sections';

export function OpenInNewTabIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-4 shrink-0">
        <path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
    </svg>;
}

interface CodexMenuProps {
    active: boolean;
    visible: boolean;
    compact?: boolean;
    onOpen: (section: CodexSection) => void;
}

export function CodexMenu({ active, visible, compact = false, onOpen }: CodexMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const wrapper = useRef<HTMLDivElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const id = useId();
    const expanded = open && visible;

    useEffect(() => {
        if (!expanded) return;
        const dismiss = (event: PointerEvent) => {
            if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                trigger.current?.focus();
            }
        };
        document.addEventListener('pointerdown', dismiss);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('pointerdown', dismiss);
            document.removeEventListener('keydown', escape);
        };
    }, [expanded]);

    return <div ref={wrapper} className={`relative ${compact ? 'min-w-0 flex-1' : ''}`}
        onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}>
        <button ref={trigger} type="button" aria-expanded={expanded} aria-controls={id}
            onClick={() => setOpen(!expanded)}
            className={compact
                ? `flex w-full items-center justify-center gap-1 border-b-2 px-1.5 py-2 text-xs font-medium ${active || expanded ? 'border-primary text-primary' : 'border-transparent text-base-content/70 hover:text-base-content'}`
                : `tab gap-2 px-4 text-lg ${active || expanded ? 'tab-active' : ''}`}>
            <SectionIcon name="codex" className={compact ? 'hidden size-4 min-[360px]:block' : 'size-5'} />
            {t('Codex')}
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`size-3 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}><path d="m4 6 4 4 4-4" /></svg>
        </button>
        {expanded && <div id={id} className="absolute right-0 top-full z-40 mt-1 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-base-300 bg-base-200 p-2 shadow-xl">
            <ul aria-label={t('Codex')} className="space-y-1">
                {codexSections.map(section => <li key={section.id} className="flex items-stretch gap-1">
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-primary"
                        onClick={() => {
                            trigger.current?.focus();
                            setOpen(false);
                            onOpen(section.id);
                        }}>
                        <SectionIcon name={section.icon} />{t(section.label)}
                    </button>
                    <a href={toolPaths[section.id]} target="_blank" rel="noopener noreferrer"
                        aria-label={t('Open {name} in a new tab', { name: t(section.label) })}
                        title={t('Open in new tab')}
                        className="flex w-11 shrink-0 items-center justify-center rounded-lg text-base-content/60 hover:bg-base-content/10 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary">
                        <OpenInNewTabIcon />
                    </a>
                </li>)}
            </ul>
        </div>}
    </div>;
}
