import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from "@/app/uklad/bindings";
import { ShareBasesStatsButton } from "./ShareBasesStatsButton";

export const MyBasesStats = () => {
  const stats = useSubscription([appIds.subscriptions.BASES_STATS_SUMMARY]);
  const bases = useSubscription([appIds.subscriptions.BASES_LIST]);

  return (
    <div className="flex min-w-0 w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-base-200 px-3 py-2 text-xs sm:w-auto sm:gap-x-6 sm:text-sm">
      <div className="flex items-center gap-1.5 whitespace-nowrap" title="Bases">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 shrink-0 text-base-content/60">
          <path strokeLinecap="round" strokeLinejoin="round" d="m3 10 9-7 9 7M5 8.5V21h5v-7h4v7h5V8.5" />
        </svg>
        <span className="sr-only">Bases:</span>
        <span className="font-semibold">{stats.totalBases}</span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap" title="Buildings">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 shrink-0 text-base-content/60">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V3h10v18m0-12h4v12M8 7h1m2 0h1M8 11h1m2 0h1M8 15h1m2 0h1M9 21v-3h2v3" />
        </svg>
        <span className="sr-only">Buildings:</span>
        <span className="font-semibold">{stats.totalBuildings}</span>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap" title="Plans">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4 shrink-0 text-base-content/60">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H5v16h14V5h-3M8 3h8v4H8V3Zm0 9h8m-8 4h5" />
        </svg>
        <span className="sr-only">Plans:</span>
        <span className="font-semibold">{stats.totalPlans}</span>
      </div>
      <div className="flex min-w-[100px] flex-col gap-1 sm:min-w-[120px]" title="Heat / capacity">
        <div className="flex items-center justify-between gap-2">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={`size-4 shrink-0 ${stats.isHeatOverCapacity ? 'text-error' : 'text-base-content/60'}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1 4-3 5-3 8-1-1-1.5-2-1.5-3.5C5 10 4 12 4 14a8 8 0 0 0 16 0c0-4-3-8-8-11Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c0 3-3 3-3 6a3 3 0 0 0 6 0c0-2-1-4-3-6Z" />
          </svg>
          <span className="sr-only">Heat / capacity:</span>
          <span className={`font-semibold text-xs sm:text-sm ${stats.isHeatOverCapacity ? 'text-error' : ''}`}>
            {stats.totalHeat.toLocaleString()}/{stats.totalHeatCapacity.toLocaleString()}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-base-300">
          <div
            className={`h-full rounded-full transition-all ${stats.isHeatOverCapacity ? 'bg-error' : 'bg-sky-400'}`}
            style={{ width: `${stats.heatPercentage}%` }}
          ></div>
        </div>
      </div>
      <div className="flex min-w-[100px] flex-col gap-1 sm:min-w-[120px]" title="Energy used / produced (MW)">
        <div className="flex items-center justify-between gap-2">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={`size-4 shrink-0 ${stats.isEnergyInsufficient ? 'text-error' : 'text-base-content/60'}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
          </svg>
          <span className="sr-only">Energy used / produced (MW):</span>
          <span className={`font-semibold text-xs sm:text-sm ${stats.isEnergyInsufficient ? 'text-error' : ''}`}>
            {stats.totalEnergyUsed.toLocaleString()}/{stats.totalEnergyProduced.toLocaleString()}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-base-300">
          <div
            className={`h-full rounded-full transition-all ${stats.isEnergyInsufficient ? 'bg-error' : 'bg-success'}`}
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
