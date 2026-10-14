import { useTranslation } from '@/shared/i18n';
import type { SaveCoreOverview } from '../overview';
import { ResourceRows } from './SaveResourceRows';

export function SaveCoreResources({ coreOverview, columns = false }: { coreOverview: SaveCoreOverview; columns?: boolean }) {
    const { t } = useTranslation();
    const extraction = coreOverview.incoming.filter(resource => resource.source === 'extraction');
    const deliveries = coreOverview.incoming.filter(resource => resource.source === 'delivery');
    return <div className={columns ? 'grid gap-x-8 md:grid-cols-2' : ''}>
        {coreOverview.incoming.length > 0 && <section className="min-w-0 border-t border-base-content/5 pt-3" aria-label={t('Available resources')}>
            <h3 className="text-xs font-medium text-base-content/55"><span aria-hidden="true" className="mr-1.5 text-sky-400">↘</span>{t('Available resources')}</h3>
            <div className="mt-1">
                {extraction.length > 0 && <div><ResourceRows resources={extraction} /></div>}
                {deliveries.length > 0 && <div className={extraction.length > 0 ? 'mt-2 border-t border-base-content/15 pt-2' : ''}><ResourceRows resources={deliveries} /></div>}
            </div>
        </section>}
        {coreOverview.outgoing.length > 0 && <section className="min-w-0 border-t border-base-content/5 pt-3" aria-label={t('Sent to other Cores')}>
            <h3 className="text-xs font-medium text-base-content/55"><span aria-hidden="true" className="mr-1.5 text-emerald-400">↗</span>{t('Sent to other Cores')}</h3>
            <ResourceRows resources={coreOverview.outgoing} />
        </section>}
    </div>;
}
