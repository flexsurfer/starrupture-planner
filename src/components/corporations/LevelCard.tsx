import { ComponentIcon } from "./ComponentIcon";
import type { CorporationComponent, Item, Level, Reward } from "../../state/db";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';

type LevelCardProps = {
  level: number;
  components: CorporationComponent[];
  rewards: Reward[];
  levelsMap: Record<number, Level>;
  itemsMap: Record<string, Item>;
};

export const LevelCard = ({ level, components, rewards, levelsMap, itemsMap }: LevelCardProps) => {
  const levelInfo = levelsMap[level];
  const levelCost = levelInfo ? levelInfo.cost : 0;
  
  return (
    <div className="card bg-base-200 shadow-sm border border-base-300">
      <div className="card-body p-4">
        <div className="flex items-center mb-3 gap-5">
          <h4 className="text-sm font-medium text-base-content/70">Level {level}</h4>
          <div className="flex gap-2">
            {levelCost > 0 && (
              <div className="badge badge-warning badge-sm">{levelCost.toLocaleString()} pts</div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mb-4">
          {components.map((component, idx) => (
            <ComponentIcon 
              key={`${component.id}-${idx}`} 
              component={component}
              itemsMap={itemsMap}
            />
          ))}
        </div>

        {/* Open in Planner button for levels 2+ */}
        {components.length > 0 && (
          <div className="mb-4">
            <button 
              className="btn btn-xs btn-primary"
              onClick={() => {
                // Open the first component of the level in the planner
                dispatch([EVENT_IDS.OPEN_ITEM_IN_PLANNER, components[0].id]);
              }}
              title={`Open ${itemsMap[components[0].id]?.name || components[0].id} in planner`}
            >
              Open in Planner
            </button>
          </div>
        )}
        
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
