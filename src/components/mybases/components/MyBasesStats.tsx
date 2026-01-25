import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../../state/sub-ids";
import type { MyBasesStats as MyBasesStatsType } from "../types";

export const MyBasesStats = () => {
  const stats = useSubscription<MyBasesStatsType>([SUB_IDS.MY_BASES_STATS]);

  return (
    <>
      {/* Mobile Layout - 2x2 Grid */}
      <div className="grid grid-cols-2 gap-2 sm:hidden">
        <div className="stat bg-base-200 rounded-lg shadow p-3">
          <div className="stat-title text-xs">Bases</div>
          <div className="stat-value text-lg">{stats.totalBases}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg shadow p-3">
          <div className="stat-title text-xs">Buildings</div>
          <div className="stat-value text-lg">{stats.totalBuildings}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg shadow p-3">
          <div className="stat-title text-xs">Heat</div>
          <div className="stat-value text-lg">{stats.totalHeat.toLocaleString()}</div>
        </div>
        <div className="stat bg-base-200 rounded-lg shadow p-3">
          <div className="stat-title text-xs">Energy</div>
          <div className="stat-value text-lg">{stats.totalEnergyUsed.toLocaleString()}</div>
        </div>
      </div>

      {/* Desktop Layout - Horizontal Stats */}
      <div className="hidden sm:block">
        <div className="stats shadow stats-horizontal">
          <div className="stat">
            <div className="stat-title">Total Bases</div>
            <div className="stat-value text-2xl">{stats.totalBases}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Total Buildings</div>
            <div className="stat-value text-2xl">{stats.totalBuildings}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Total Heat</div>
            <div className="stat-value text-2xl">{stats.totalHeat.toLocaleString()}</div>
          </div>
          <div className="stat">
            <div className="stat-title">Total Energy Used</div>
            <div className="stat-value text-2xl">{stats.totalEnergyUsed.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </>
  );
};
