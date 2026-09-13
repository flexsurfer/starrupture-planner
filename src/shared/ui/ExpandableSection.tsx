import { useId, type ReactNode } from 'react';

interface ExpandableSectionProps {
  title: string;
  icon: ReactNode;
  summary: ReactNode;
  expanded: boolean;
  onToggle: () => void;
  actions?: ReactNode;
  children: ReactNode;
}

/** Compact, keyboard-accessible section with optional header actions. */
export const ExpandableSection = ({ title, icon, summary, expanded, onToggle, actions, children }: ExpandableSectionProps) => {
  const contentId = useId();

  return (
    <section className="min-w-0 rounded-lg border border-base-300 bg-base-100">
      <div className="sticky top-0 z-10 flex items-center rounded-t-lg bg-base-200">
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2 sm:gap-3 sm:p-3"
            aria-label={title}
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={onToggle}
          >
            {icon && <span className="shrink-0">{icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight break-words sm:text-base">{title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-normal leading-tight text-base-content/65 tabular-nums sm:text-xs">{summary}</span>
            </span>
            <svg aria-hidden="true" className={`size-4 shrink-0 text-base-content/50 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </h2>
        {actions && <div className="shrink-0 pr-2 sm:pr-3">{actions}</div>}
      </div>
      {expanded && <div id={contentId} className="border-t border-base-300 p-2 sm:p-3">{children}</div>}
    </section>
  );
};
