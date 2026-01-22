import { CorporationIcon } from "./CorporationIcon";
import { LevelCard } from "./LevelCard";
import type { CorporationWithStats } from "./useCorporations";
import type { Item } from "../../state/db";

type CorporationCardProps = {
  corporation: CorporationWithStats;
  isCollapsed: boolean;
  onToggle: () => void;
  itemsMap: Record<string, Item>;
};

export const CorporationCard = ({
  corporation,
  isCollapsed,
  onToggle,
  itemsMap
}: CorporationCardProps) => {
  const { totalLevels, totalComponents, totalCost } = corporation.stats;
  const totalRewards = corporation.levels.reduce((sum, level) => sum + level.rewards.length, 0);
  
  return (
    <div className="card bg-base-100 shadow-lg border border-base-300">
      <div className="card-body">
        {/* Corporation Header - Clickable & Sticky */}
        <div 
          className="flex items-center gap-4 mb-4 cursor-pointer hover:bg-base-200 -mx-4 -mt-4 px-4 pt-4 pb-4 rounded-t-lg transition-colors sticky top-0 z-10 bg-base-100"
          onClick={onToggle}
        >
          <CorporationIcon corporationId={corporation.id} corporationName={corporation.name} />
          <div className="flex-1">
            <h2 className="card-title text-xl">{corporation.name}</h2>
            {corporation.description && (
              <p className="text-sm text-base-content/70">{corporation.description}</p>
            )}
            <div className="flex gap-2 flex-wrap mt-4">
              <div className="badge badge-outline">
                {totalLevels} level{totalLevels !== 1 ? 's' : ''}
              </div>
              <div className="badge badge-outline">
                {totalComponents} component{totalComponents !== 1 ? 's' : ''}
              </div>
              {totalRewards > 0 && (
                <div className="badge badge-success badge-outline">
                  {totalRewards} reward{totalRewards !== 1 ? 's' : ''}
                </div>
              )}
              {totalCost > 0 && (
                <div className="badge badge-info badge-outline">
                  {totalCost.toLocaleString()} G
                </div>
              )}
            </div>
          </div>
          {/* Collapse Arrow */}
          <div className="flex-shrink-0">
            <svg 
              className={`w-6 h-6 text-base-content transition-transform duration-200 ${isCollapsed ? 'rotate-0' : 'rotate-90'}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        {/* Levels - Collapsible */}
        {!isCollapsed && (
          <div className="space-y-3">
            <div className="grid gap-3">
              {corporation.levels.map((level) => (
                <LevelCard
                  key={`${corporation.name}-level-${level.level}`}
                  level={level.level}
                  xp={level.xp}
                  components={level.components}
                  rewards={level.rewards}
                  itemsMap={itemsMap}
                  corporationId={corporation.id}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
