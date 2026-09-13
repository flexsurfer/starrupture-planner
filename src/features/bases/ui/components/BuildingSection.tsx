import { appIds } from '@/app/uklad/catalog';
import React, { useState } from 'react';
import { useSubscription } from '@/app/uklad/bindings';
import { ExpandableSection, SectionIcon } from '@/shared/ui';
import { BuildingSectionCard } from './BuildingSectionCard';
import type { BuildingSectionType } from '@/features/bases/types';

interface BuildingSectionProps {
  title: string;
  description: string;
  baseId: string;
  sectionType: BuildingSectionType;
  onAdd: () => void;
}

export const BuildingSection: React.FC<BuildingSectionProps> = ({ title, description, baseId, sectionType, onAdd }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sectionBuildings = useSubscription([appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, sectionType]);
  const stats = useSubscription([appIds.subscriptions.BASES_BUILDING_SECTION_STATS, baseId, sectionType]);
  const isLogisticsSection = sectionType === 'inputs' || sectionType === 'outputs';

  return (
    <ExpandableSection
      title={title}
      icon={null}
      expanded={!isCollapsed}
      onToggle={() => setIsCollapsed(previous => !previous)}
      summary={<>
        <span className="inline-flex items-center gap-1" aria-label={`${stats.buildingCount} ${stats.buildingCount === 1 ? 'building' : 'buildings'}`} title="Buildings">
          <SectionIcon name="buildings" className="size-3.5" />
          {stats.buildingCount}
        </span>
        {stats.totalHeat > 0 && <span title="Heat">🔥 {stats.totalHeat}</span>}
        {stats.totalPowerGeneration > 0 && <span title="Power generation">⚡ +{stats.totalPowerGeneration} MW</span>}
        {stats.totalPowerConsumption > 0 && <span title="Power consumption">⚡ −{stats.totalPowerConsumption} MW</span>}
      </>}
      actions={
        <button type="button" className="btn btn-sm btn-ghost h-8 min-h-8 gap-1 px-2 text-xs font-normal text-base-content/65"
          aria-label={`Add ${title.toLowerCase()} building`} onClick={onAdd}>
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
          </svg>
          Add
        </button>
      }
    >
      <p className="text-xs leading-relaxed text-base-content/60">{description}</p>
      {sectionBuildings.length > 0 ? (
        <div className={`mt-2 grid items-start gap-2 ${isLogisticsSection
          ? 'grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]'
          : 'grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))]'}`}>
          {sectionBuildings.map(sectionBuilding => (
            <BuildingSectionCard key={sectionBuilding.id} sectionBuilding={sectionBuilding} baseId={baseId} />
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-base-content/45">No buildings yet.</p>
      )}
    </ExpandableSection>
  );
};
