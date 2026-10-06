import { lazy, Suspense } from 'react';
import { useTranslation } from '@/shared/i18n';
import type { ToolShellOptions } from './ToolShellOptions';

const RouteWrapper = lazy(() => import('./RouteWrapper'));

export function ToolRoute(props: ToolShellOptions) {
    const { t } = useTranslation();
    return <Suspense fallback={
        <main data-theme="dark" className="min-h-screen grid place-items-center bg-base-100 text-base-content">
            <div role="status" className="flex items-center gap-3">
                <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                <span>{t('Loading tools…')}</span>
            </div>
        </main>
    }><RouteWrapper {...props} /></Suspense>;
}
