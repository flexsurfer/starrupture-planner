import { useTranslation } from '@/shared/i18n';
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
    const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sectionBuildings = useSubscription([appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, sectionType]);
  const stats = useSubscription([appIds.subscriptions.BASES_BUILDING_SECTION_STATS, baseId, sectionType]);
  const addLabel = {
    inputs: t("Add inputs building"),
    outputs: t("Add outputs building"),
    production: t("Add production building"),
    energy: t("Add energy building"),
    infrastructure: t("Add infrastructure building"),
  }[sectionType];
  const isLogisticsSection = sectionType === 'inputs' || sectionType === 'outputs';

  return (
    <ExpandableSection
      title={title}
      icon={null}
      expanded={!isCollapsed}
      onToggle={() => setIsCollapsed(previous => !previous)}
      summary={<>
        <span className="inline-flex items-center gap-1" aria-label={t("{count} buildings", { count: stats.buildingCount })} title={t("Buildings")}>
          <SectionIcon name="buildings" className="size-3.5" />
          {stats.buildingCount}
        </span>
        {stats.totalHeat > 0 && <span title={t("Heat")}>🔥 {stats.totalHeat}</span>}
        {stats.totalPowerGeneration > 0 && <span title={t("Power generation")}>⚡ +{stats.totalPowerGeneration} MW</span>}
        {stats.totalPowerConsumption > 0 && <span title={t("Power consumption")}>⚡ −{stats.totalPowerConsumption} MW</span>}
      </>}
      actions={
        <button type="button" className="btn btn-sm btn-primary btn-outline h-8 min-h-8 min-w-8 shrink-0 gap-1 px-2 text-xs"
          aria-label={addLabel} onClick={onAdd}>
          <span aria-hidden="true">＋</span>{t("Add")}</button>
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
        <p className="mt-1 text-xs text-base-content/45">{t("No buildings yet.")}</p>
      )}
    </ExpandableSection>
  );
};
