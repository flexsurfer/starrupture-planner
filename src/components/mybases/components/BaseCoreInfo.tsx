import { useSubscription } from '@flexsurfer/reflex';
import { SUB_IDS } from '../../../state/sub-ids';
import type { BaseDetailStats } from '../types';

export const BaseCoreInfo: React.FC = () => {

  const detailStats = useSubscription<BaseDetailStats | null>([SUB_IDS.SELECTED_BASE_DETAIL_STATS]);

  // Early return if data not available
  if (!detailStats) {
    return null;
  }

  const { buildingCount, totalHeat, energyGeneration, energyConsumption, baseCoreHeatCapacity, heatPercentage, energyPercentage, isHeatOverCapacity, isEnergyInsufficient } = detailStats;

  return (
    <div className="bg-base-200 rounded-lg p-2 sm:p-4">
      <div className="flex items-start gap-2 sm:gap-4 mb-2 sm:mb-4">
        <div className="flex-shrink-0">
          <img
            src="/icons/buildings/base_core.png"
            alt="Base Core"
            className="w-16 h-16 sm:w-30 sm:h-30 object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold mb-1 sm:mb-2 text-base sm:text-lg">Core Information</h2>
          <p className="hidden sm:block text-sm text-base-content/70 mb-4">
            The Core defines the buildable area for this Base. Buildings can only be placed inside the Core area.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mt-2 sm:mt-4">
            <div>
              <div className="text-xs sm:text-sm text-base-content/70 mb-0.5 sm:mb-1">Buildings</div>
              <div className="text-sm sm:text-xl font-bold">{buildingCount}</div>
            </div>
            <div>
              <div className={`text-xs sm:text-sm mb-0.5 sm:mb-1 ${isHeatOverCapacity ? 'text-error' : 'text-base-content/70'}`}>Heat</div>
              <div className={`text-sm sm:text-xl font-bold ${isHeatOverCapacity ? 'text-error' : ''}`}>{totalHeat} / {baseCoreHeatCapacity}</div>
              <div className="w-full bg-base-300 rounded-full h-1.5 sm:h-2 mt-0.5 sm:mt-1">
                <div
                  className={`h-1.5 sm:h-2 rounded-full transition-all ${isHeatOverCapacity ? 'bg-error' : 'bg-sky-400'}`}
                  style={{ width: `${heatPercentage}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className={`text-xs sm:text-sm mb-0.5 sm:mb-1 ${isEnergyInsufficient ? 'text-error' : 'text-base-content/70'}`}>Energy</div>
              <div className={`text-sm sm:text-xl font-bold ${isEnergyInsufficient ? 'text-error' : ''}`}>{energyConsumption} / {energyGeneration} MW</div>
              <div className="w-full bg-base-300 rounded-full h-1.5 sm:h-2 mt-0.5 sm:mt-1">
                <div
                  className={`h-1.5 sm:h-2 rounded-full transition-all ${isEnergyInsufficient ? 'bg-error' : 'bg-success'
                    }`}
                  style={{ width: `${energyPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
