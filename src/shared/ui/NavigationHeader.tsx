import { useTranslation } from '@/shared/i18n';
import type { ReactNode } from 'react';

interface NavigationHeaderProps {
  title: string;
  breadcrumbs?: { label: string; onClick?: () => void }[];
  back?: { label: string; onClick: () => void };
  actions?: ReactNode;
  summary?: ReactNode;
  children?: ReactNode;
}

export const NavigationHeader = ({ title, breadcrumbs, back, actions, summary, children }: NavigationHeaderProps) => { const { t } = useTranslation(); return (
  <header className="mb-1 shrink-0 border-b border-base-300 px-1">
    <h1 className="sr-only">{title}</h1>
    <div className="flex min-h-8 min-w-0 items-center gap-1">
      {back && <button type="button" onClick={back.onClick} aria-label={back.label} title={back.label}
        className="btn btn-sm btn-ghost size-8 min-h-8 shrink-0 p-0">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m6-6-6 6 6 6" />
        </svg>
      </button>}
      <nav aria-label={t("Breadcrumb")} className={summary ? "shrink-0" : "min-w-0 flex-1 overflow-x-auto"}>
        <ol className="flex min-h-8 w-max items-center gap-x-1 whitespace-nowrap text-xs text-base-content/60">
          {(breadcrumbs ?? [{ label: title }]).map((crumb, index) => <li key={index} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden="true" className="px-1 text-base-content/30">/</span>}
            {crumb.onClick ? <button type="button" onClick={crumb.onClick}
              className="min-h-8 rounded px-1 hover:bg-base-content/5 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary" title={crumb.label}>
              {crumb.label}
            </button> : <span aria-current="page" className="px-1 font-medium text-base-content" title={crumb.label}>{crumb.label}</span>}
          </li>)}
        </ol>
      </nav>
      {summary && <div className="min-w-0 flex-1 overflow-x-auto"><div className="flex w-max items-center gap-2 px-2">{summary}</div></div>}
      {actions && <div className="ml-1 flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
    {children && <div className="mt-1 pb-1">{children}</div>}
  </header>
); };
