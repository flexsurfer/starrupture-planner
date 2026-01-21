import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../state/sub-ids";
  
export const CorporationsStats = () => {
  const stats = useSubscription<{ totalCorporations: number; totalLevels: number; totalCost: number }>([SUB_IDS.CORPORATIONS_STATS]);

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
