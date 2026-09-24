import { useTranslation } from '@/shared/i18n';
import { useSubscription } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';

export const CorporationsStats = () => {
    const { t } = useTranslation();
  const stats = useSubscription([appIds.subscriptions.CORPORATIONS_STATS_SUMMARY]);

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/60 tabular-nums">
      <span>{t("{count} corporations", { count: stats.totalCorporations })}</span>
      <span>{t("{count} levels", { count: stats.totalLevels })}</span>
      <span>{t("{cost} G total cost", { cost: stats.totalCost })}</span>
    </div>
  );
};
