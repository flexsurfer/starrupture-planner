import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import React, { useCallback } from 'react';
import { EnergyGroupSelector } from '@/features/energy-groups/ui';

interface BaseCoreInfoProps {
  onRename?: () => void;
}

export const BaseCoreInfo: React.FC<BaseCoreInfoProps> = ({ onRename }) => {
  const runtime = useRuntime();
  const expanded = useSubscription([appIds.subscriptions.BASES_DETAILS_EXPANDED]);
  const detailStats = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE_DETAIL_STATS]);
  const coreLevels = useSubscription([appIds.subscriptions.BASES_CORE_LEVELS]);
  const selectedBase = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE]);

  const onClose = useCallback(() => {
    runtime.dispatch([appIds.events.BASES_SET_SELECTED_BASE, null]);
  }, [runtime]);

  const onCoreLeveChange = useCallback((level: number) => {
    runtime.dispatch([appIds.events.BASES_SET_CORE_LEVEL, level]);
  }, [runtime]);
  
  // Early return if data not available
  if (!detailStats) {
    return null;
  }

  const { baseName, coreLevel, buildingCount, totalHeat, energyGeneration, energyConsumption, energyGridConsumption, baseCoreHeatCapacity, heatPercentage, energyPercentage, isHeatOverCapacity, isEnergyInsufficient, energyGroupId, energyGroupName } = detailStats;

  return (
    <div className="relative bg-base-200 rounded-lg p-2 pr-20 sm:p-3 sm:pr-20">
      <div className="absolute right-0 top-0 flex">
        <button
          type="button"
          className={`relative grid size-8 cursor-pointer place-items-center rounded-bl-md border border-base-content/20 bg-base-200 transition-colors hover:bg-base-300 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${!expanded && (isHeatOverCapacity || isEnergyInsufficient) ? 'text-error' : 'text-base-content/65 hover:text-base-content'}`}
          aria-label={expanded ? 'Hide base details' : 'Show base details'}
          title={expanded ? 'Hide base details' : isHeatOverCapacity || isEnergyInsufficient ? 'Show base details — heat or energy needs attention' : 'Show base details'}
          aria-expanded={expanded}
          onClick={() => runtime.dispatch([appIds.events.BASES_SET_DETAILS_EXPANDED, !expanded])}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
            {expanded ? <path d="M5 16h14" /> : <><rect x="5" y="9" width="10" height="10" /><path d="M9 9V5h10v10h-4" /></>}
          </svg>
        </button>
        <button
          type="button"
          className="relative -ml-px grid size-8 cursor-pointer place-items-center rounded-tr-lg border border-base-content/20 bg-base-200 text-base-content/65 transition-colors hover:bg-base-300 hover:text-base-content focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Close base"
          title="Close base"
          onClick={onClose}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
            <path d="m6 6 12 12M6 18 18 6" />
          </svg>
        </button>
      </div>
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-3">
        {/* Header Section: Icon and Base Name */}
        <div className="flex items-start gap-2 sm:gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
          {/* Core Icon */}
          {expanded && <div className="flex-shrink-0">
            <img
              src="/icons/buildings/base_core.webp"
              alt="Base Core"
              className="w-12 h-12 sm:w-16 sm:h-16 object-contain"
              width={64}
              height={64}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>}

          {/* Base Name and Description */}
          <div className="flex-1 min-w-0">
            <div className="flex min-h-8 min-w-0 items-center gap-2">
              <h2 className="truncate text-base font-semibold sm:text-lg">{baseName}</h2>
              {onRename && expanded && (
                <button
                  type="button"
                  className="btn btn-xs btn-ghost shrink-0 text-base-content/55 hover:text-base-content"
                  onClick={onRename}
                >
                  Rename
                </button>
              )}
            </div>
            {expanded && <><p className="hidden sm:block text-xs text-base-content/70 mt-1">
              The Core defines the buildable area for this Base. Buildings can only be placed inside the Core area.
            </p>
            {/* Core Level Selector */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-xs text-base-content/70 whitespace-nowrap">Core Level:</span>
              <div className="join">
                {coreLevels.map(({ level, heatCapacity }) => (
                  <button
                    key={level}
                    className={`join-item btn btn-xs ${coreLevel === level ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => onCoreLeveChange(level)}
                    title={`Level ${level + 1} — Heat Capacity: ${heatCapacity.toLocaleString()}`}
                  >
                    {level + 1}
                  </button>
                ))}
              </div>
            </div></>}
          </div>
        </div>

        {/* Stats */}
        {expanded && <div className="flex w-full flex-col gap-1 self-stretch sm:w-auto">
        <div className="flex flex-wrap justify-between gap-3 sm:justify-start sm:gap-4">
          <div className="flex-shrink-0">
            <div className="text-xs text-base-content/70 mb-0.5">Buildings</div>
            <div className="text-base font-bold">{buildingCount}</div>
          </div>
          <div className="flex-shrink-0 min-w-[80px]">
            <div className={`text-xs mb-0.5 ${isHeatOverCapacity ? 'text-error' : 'text-base-content/70'}`}>Heat</div>
            <div className={`text-sm sm:text-base font-bold ${isHeatOverCapacity ? 'text-error' : ''}`}>{totalHeat} / {baseCoreHeatCapacity}</div>
            <div className="w-full bg-base-300 rounded-full h-1 mt-0.5">
              <div
                className={`h-1 rounded-full transition-all ${isHeatOverCapacity ? 'bg-error' : 'bg-sky-400'}`}
                style={{ width: `${heatPercentage}%` }}
              ></div>
            </div>
          </div>
          <div className="flex-shrink-0 min-w-[100px]">
            <div className={`text-xs mb-0.5 flex items-center gap-1 ${isEnergyInsufficient ? 'text-error' : 'text-base-content/70'}`}>
              Energy{energyGroupName ? ` [${energyGroupName}]` : ''}
              {selectedBase && <EnergyGroupSelector baseId={selectedBase.id} currentGroupId={energyGroupId} variant="text" />}
            </div>
            <div className={`text-sm sm:text-base font-bold ${isEnergyInsufficient ? 'text-error' : ''}`}>
              {energyConsumption}
              {energyGroupId && (
                <span className="text-xs text-base-content/60"> ({energyGridConsumption})</span>
              )}
              {' / '}
              {energyGeneration} MW
            </div>
            <div className="w-full bg-base-300 rounded-full h-1 mt-0.5">
              <div
                className={`h-1 rounded-full transition-all ${isEnergyInsufficient ? 'bg-error' : 'bg-success'}`}
                style={{ width: `${energyPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
        </div>}
      </div>
    </div>
  );
};
