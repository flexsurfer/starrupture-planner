import React, { useState } from 'react';
import { useSubscription } from '@flexsurfer/reflex';
import type { BaseBuilding, Building as DbBuilding } from '../../../state/db';
import { SUB_IDS } from '../../../state/sub-ids';
import { BuildingSectionCard } from './BuildingSectionCard';
import type { BuildingSectionType, BuildingSectionStats } from '../types';
import type { ActivePlansBuildingsMap } from '../../../state/subs';

interface BuildingSectionProps {
  title: string;
  description: string;
  baseId: string;
  sectionType: BuildingSectionType;
  onAdd: () => void;
}

export const BuildingSection: React.FC<BuildingSectionProps> = ({title, description, baseId, sectionType, onAdd}) => {
  
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Get buildings and stats from subscriptions
  const baseBuildings = useSubscription<BaseBuilding[]>([SUB_IDS.BUILDING_SECTION_BUILDINGS, baseId, sectionType]);
  const buildings = useSubscription<DbBuilding[]>([SUB_IDS.BUILDINGS]);
  const stats = useSubscription<BuildingSectionStats>([SUB_IDS.BUILDING_SECTION_STATS, baseId, sectionType]);
  const activePlansBuildingsMap = useSubscription<ActivePlansBuildingsMap>([SUB_IDS.ACTIVE_PLANS_BUILDINGS_MAP]);

  const isEmpty = baseBuildings.length === 0;

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className="card bg-base-100 shadow-lg border border-base-300">
      <div className="card-body">
        {/* Collapsible Header */}
        <div
          className="flex items-center gap-4 mb-4 cursor-pointer hover:bg-base-200 -mx-4 -mt-4 px-4 pt-4 pb-4 rounded-t-lg transition-colors sticky top-0 z-10 bg-base-100"
          onClick={toggleCollapse}
        >
          <div className="flex-1">
            <h2 className="card-title text-xl">{title}</h2>
            {description && (
              <p className="text-sm text-base-content/70 mt-1">{description}</p>
            )}
            <div className="flex gap-2 flex-wrap items-center mt-3">
              <div className="badge badge-outline">
                {stats.buildingCount} building{stats.buildingCount !== 1 ? 's' : ''}
              </div>
              {stats.totalHeat > 0 && (
                <>
                  <span className="text-xs text-base-content/40">|</span>
                  <span className="text-sm">🔥 {stats.totalHeat}</span>
                </>
              )}
              {stats.totalPowerGeneration > 0 && (
                <>
                  <span className="text-xs text-base-content/40">|</span>
                  <span className="text-sm">⚡ +{stats.totalPowerGeneration} MW</span>
                </>
              )}
              {stats.totalPowerConsumption > 0 && (
                <>
                  <span className="text-xs text-base-content/40">|</span>
                  <span className="text-sm">⚡ -{stats.totalPowerConsumption} MW</span>
                </>
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

        {/* Collapsible Content */}
        {!isCollapsed && (
          <>
            {isEmpty ? (
              <div className="text-center py-8">
                <p className="text-sm text-base-content/70 mb-4">{description}</p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={onAdd}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Add Building
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {baseBuildings.map((baseBuilding) => {
                  const building = buildings.find(b => b.id === baseBuilding.buildingTypeId);
                  if (!building) return null;
                  
                  const activePlanNames = activePlansBuildingsMap[baseBuilding.buildingTypeId] || [];

                  return (
                    <BuildingSectionCard
                      key={baseBuilding.id}
                      baseBuilding={baseBuilding}
                      building={building}
                      baseId={baseBuilding.baseId}
                      activePlanNames={activePlanNames}
                    />
                  );
                })}
                {/* Add button when section has buildings */}
                <div
                  className="card bg-base-200 border border-dashed border-base-300 hover:border-primary cursor-pointer transition-colors"
                  onClick={onAdd}
                >
                  <div className="card-body p-3 flex items-center justify-center min-h-[150px]">
                    <div className="btn btn-circle btn-primary btn-sm pointer-events-none">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
