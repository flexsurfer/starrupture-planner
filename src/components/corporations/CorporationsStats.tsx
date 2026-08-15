import { useAppSubscription } from "@/state/runtime";
import { appIds } from "@/app/uklad/catalog";
  
export const CorporationsStats = () => {
  const stats = useAppSubscription([appIds.subscriptions.CORPORATIONS_STATS_SUMMARY]);

  return (
    <div className="stats shadow">
      <div className="stat">
        <div className="stat-title">Total Corporations</div>
        <div className="stat-value text-2xl">{stats.totalCorporations}</div>
      </div>
      <div className="stat">
        <div className="stat-title">Total Levels</div>
        <div className="stat-value text-2xl">{stats.totalLevels}</div>
      </div>
      <div className="stat">
        <div className="stat-title">Total Cost</div>
        <div className="stat-value text-2xl">{stats.totalCost.toLocaleString()} G</div>
      </div>
    </div>
  );
};
