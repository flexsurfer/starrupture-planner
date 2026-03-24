import { dispatch, useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import type { BaseDetailStats } from '../types';
import { EVENT_IDS } from '../../../state/event-ids';
import React, { useCallback } from 'react';
import type { Base } from '../../../state/db';
import { EnergyGroupSelector } from './EnergyGroupSelector';

export const BaseCoreInfo: React.FC = () => {

  const detailStats = useSubscription<BaseDetailStats | null>([SUB_IDS.BASES_SELECTED_BASE_DETAIL_STATS]);
  const coreLevels = useSubscription<{ level: number; heatCapacity: number }[]>([SUB_IDS.BASES_CORE_LEVELS]);
  const selectedBase = useSubscription<Base | null>([SUB_IDS.BASES_SELECTED_BASE]);

  const onBack = useCallback(() => {
    dispatch([EVENT_IDS.BASES_SET_SELECTED_BASE, null]);
  }, []);

  const onCoreLeveChange = useCallback((level: number) => {
    dispatch([EVENT_IDS.BASES_SET_CORE_LEVEL, level]);
  }, []);
  
  // Early return if data not available
  if (!detailStats) {
    return null;
  }

  const { baseName, coreLevel, buildingCount, totalHeat, energyGeneration, energyConsumption, energyGridConsumption, baseCoreHeatCapacity, heatPercentage, energyPercentage, isHeatOverCapacity, isEnergyInsufficient, energyGroupId, energyGroupName } = detailStats;

  return (
    <div className="bg-base-200 rounded-lg p-2 sm:p-3">
      <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-3">
        {/* Header Section: Back Button, Icon, and Base Name */}
        <div className="flex items-start gap-2 sm:gap-3 w-full sm:w-auto sm:flex-1 min-w-0">
          {/* Back Button */}
          <button
            className="btn btn-sm btn-outline gap-1 flex-shrink-0"
            onClick={onBack}
          >
            ← Back
          </button>

          {/* Core Icon */}
          <div className="flex-shrink-0">
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
          </div>

          {/* Base Name and Description */}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base sm:text-lg truncate">{baseName}</h2>
            <p className="hidden sm:block text-xs text-base-content/70 mt-1">
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
                    title={`Level ${level} — Heat Capacity: ${heatCapacity.toLocaleString()}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 sm:gap-4 flex-wrap w-full sm:w-auto justify-between sm:justify-start">
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
      </div>
    </div>
  );
};
