import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../../state/sub-ids";
import type { Base } from "../../../state/db";
import type { MyBasesStats as MyBasesStatsType } from "../types";
import { ShareBasesStatsButton } from "./ShareBasesStatsButton";

export const MyBasesStats = () => {
  const stats = useSubscription<MyBasesStatsType>([SUB_IDS.BASES_STATS_SUMMARY]);
  const bases = useSubscription<Base[]>([SUB_IDS.BASES_LIST]);

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-base bg-base-200 rounded-lg px-2 sm:px-4 py-2 sm:py-2.5 min-w-0 w-full sm:w-auto">
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="text-base-content/60">Bases:</span>
        <span className="font-semibold">{stats.totalBases}</span>
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="text-base-content/60">Buildings:</span>
        <span className="font-semibold">{stats.totalBuildings}</span>
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <span className="text-base-content/60">Plans:</span>
        <span className="font-semibold">{stats.totalPlans}</span>
      </div>
      <div className="flex flex-col gap-1 min-w-[120px] sm:min-w-[140px]">
        <div className="flex items-center justify-between gap-2">
          <span className={stats.isHeatOverCapacity ? 'text-error text-xs sm:text-sm' : 'text-base-content/60 text-xs sm:text-sm'}>Heat:</span>
          <span className={`font-semibold text-xs sm:text-sm ${stats.isHeatOverCapacity ? 'text-error' : ''}`}>
            {stats.totalHeat.toLocaleString()}/{stats.totalHeatCapacity.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-base-300 rounded-full h-1.5 sm:h-2">
          <div
            className={`h-1.5 sm:h-2 rounded-full transition-all ${stats.isHeatOverCapacity ? 'bg-error' : 'bg-sky-400'}`}
            style={{ width: `${stats.heatPercentage}%` }}
          ></div>
        </div>
      </div>
      <div className="flex flex-col gap-1 min-w-[120px] sm:min-w-[140px]">
        <div className="flex items-center justify-between gap-2">
          <span className={stats.isEnergyInsufficient ? 'text-error text-xs sm:text-sm' : 'text-base-content/60 text-xs sm:text-sm'}>Energy:</span>
          <span className={`font-semibold text-xs sm:text-sm ${stats.isEnergyInsufficient ? 'text-error' : ''}`}>
            {stats.totalEnergyUsed.toLocaleString()}/{stats.totalEnergyProduced.toLocaleString()}
          </span>
        </div>
        <div className="w-full bg-base-300 rounded-full h-1.5 sm:h-2">
          <div
            className={`h-1.5 sm:h-2 rounded-full transition-all ${stats.isEnergyInsufficient ? 'bg-error' : 'bg-success'}`}
            style={{ width: `${stats.energyPercentage}%` }}
          ></div>
        </div>
      </div>
      <ShareBasesStatsButton
        stats={stats}
        bases={bases}
        className="sm:ml-auto"
      />
    </div>
  );
};
