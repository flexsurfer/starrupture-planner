import { ComponentIcon } from "./ComponentIcon";
import type { CorporationComponent, Item, Reward } from "../../state/db";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';

type LevelCardProps = {
  level: number;
  xp?: number;
  components: CorporationComponent[];
  rewards: Reward[];
  itemsMap: Record<string, Item>;
  corporationId: string;
};

export const LevelCard = ({ level, xp, components, rewards, itemsMap, corporationId }: LevelCardProps) => {
  return (
    <div className="card bg-base-200 shadow-sm border border-base-300">
      <div className="card-body p-4">
        {/* Header Section */}
        <div className="border-b border-base-300 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <h4 className="text-lg font-bold text-white">Level {level}</h4>
            {(xp ?? 0) > 0 && (
              <div className="badge badge-info badge-sm">{(xp ?? 0).toLocaleString()} G</div>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {components.flatMap((component, idx) => [
            <div key={`${component.id}-${idx}`} className="flex flex-col items-center gap-2">
              <ComponentIcon
                component={component}
                itemsMap={itemsMap}
              />
              <button
                className="btn btn-xs btn-primary"
                onClick={() => {
                  dispatch([EVENT_IDS.OPEN_ITEM_IN_PLANNER, component.id, { corporationId, level }]);
                }}
                title={`Open ${itemsMap[component.id]?.name || component.id} in planner`}
              >
                Open in Planner
              </button>
            </div>,
            idx < components.length - 1 ? (
              <div key={`or-${idx}`} className="flex items-center">
                <span className="text-base-content/50 font-medium">OR</span>
              </div>
            ) : null
          ].filter(Boolean))}
        </div>

        {/* Rewards Section */}
        {rewards && rewards.length > 0 && (
          <div className="border-t border-base-300 pt-3">
            <h5 className="text-xs font-medium text-base-content/70 mb-2">Rewards:</h5>
            <div className="flex flex-wrap gap-1">
              {rewards.map((reward, idx) => (
                <div key={idx} className="badge badge-success badge-sm">
                  {reward.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
