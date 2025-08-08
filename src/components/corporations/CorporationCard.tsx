import { CorporationIcon } from "./CorporationIcon";
import { LevelCard } from "./LevelCard";
import type { CorporationWithStats } from "./useCorporations";
import type { Item, Level } from "../../state/db";

type CorporationCardProps = {
  corporation: CorporationWithStats;
  isCollapsed: boolean;
  onToggle: () => void;
  levelsMap: Record<number, Level>;
  itemsMap: Record<string, Item>;
};

export const CorporationCard = ({ 
  corporation, 
  isCollapsed, 
  onToggle,
  levelsMap,
  itemsMap 
}: CorporationCardProps) => {
  const { totalLevels, totalComponents, totalCost } = corporation.stats;
  
  return (
    <div className="card bg-base-100 shadow-lg border border-base-300">
      <div className="card-body">
        {/* Corporation Header - Clickable */}
        <div 
          className="flex items-center gap-4 mb-4 cursor-pointer hover:bg-base-200 -mx-4 -mt-4 px-4 pt-4 pb-4 rounded-t-lg transition-colors"
          onClick={onToggle}
        >
          <CorporationIcon corporationId={corporation.id} corporationName={corporation.name} />
          <div className="flex-1">
            <h2 className="card-title text-xl">{corporation.name}</h2>
            <div className="flex gap-2 flex-wrap">
              <div className="badge badge-outline">
                {totalLevels} level{totalLevels !== 1 ? 's' : ''}
              </div>
              <div className="badge badge-outline">
                {totalComponents} component{totalComponents !== 1 ? 's' : ''}
              </div>
              {totalCost > 0 && (
                <div className="badge badge-warning">
                  {totalCost.toLocaleString()} pts
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
            <h3 className="text-lg font-semibold">Levels</h3>
            <div className="grid gap-3">
              {corporation.levels.map((level) => (
                <LevelCard 
                  key={`${corporation.name}-level-${level.level}`} 
                  level={level.level}
                  components={level.components}
                  rewards={level.rewards}
                  levelsMap={levelsMap}
                  itemsMap={itemsMap}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
