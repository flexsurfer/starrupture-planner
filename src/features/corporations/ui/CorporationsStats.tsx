import { useTranslation } from '@/shared/i18n';
import { useSubscription } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';

export const CorporationsStats = () => {
  const { t } = useTranslation();
  const stats = useSubscription([appIds.subscriptions.CORPORATIONS_STATS_SUMMARY]);

  return (
    <div className="flex flex-wrap gap-2 text-sm font-medium text-base-content/80 tabular-nums">
      <span className="rounded-md border border-base-300 bg-base-200 px-3 py-1.5">{t('{count} corporations', { count: stats.totalCorporations })}</span>
      <span className="rounded-md border border-base-300 bg-base-200 px-3 py-1.5">{t('{count} levels', { count: stats.totalLevels })}</span>
    </div>
  );
};
