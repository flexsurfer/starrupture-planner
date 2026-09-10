import { useSubscription } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';

export const CorporationsStats = () => {
  const stats = useSubscription([appIds.subscriptions.CORPORATIONS_STATS_SUMMARY]);

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-base-content/60 tabular-nums">
      <span><strong className="font-semibold text-base-content">{stats.totalCorporations}</strong> corporations</span>
      <span><strong className="font-semibold text-base-content">{stats.totalLevels}</strong> levels</span>
      <span><strong className="font-semibold text-base-content">{stats.totalCost.toLocaleString()} G</strong> total cost</span>
    </div>
  );
};
