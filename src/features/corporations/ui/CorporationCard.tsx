import { ExpandableSection } from '@/shared/ui';
import { CorporationIcon } from './CorporationIcon';
import { LevelCard } from './LevelCard';
import type { CorporationWithStats } from '@/features/corporations/types';
import type { Item } from '@/app/uklad/model';

type CorporationCardProps = {
  corporation: CorporationWithStats;
  isCollapsed: boolean;
  onToggle: () => void;
  itemsMap: Record<string, Item>;
};

export const CorporationCard = ({ corporation, isCollapsed, onToggle, itemsMap }: CorporationCardProps) => {
  const { totalLevels, totalComponents, totalCost } = corporation.stats;
  const totalRewards = corporation.levels.reduce((sum, level) => sum + level.rewards.length, 0);

  return (
    <ExpandableSection
      title={corporation.name}
      icon={<CorporationIcon corporationId={corporation.id} corporationName={corporation.name} />}
      expanded={!isCollapsed}
      onToggle={onToggle}
      summary={<>
        <span>{totalLevels} {totalLevels === 1 ? 'level' : 'levels'}</span>
        <span>{totalComponents} {totalComponents === 1 ? 'component' : 'components'}</span>
        {totalRewards > 0 && <span>{totalRewards} {totalRewards === 1 ? 'reward' : 'rewards'}</span>}
        {totalCost > 0 && <span className="text-info">{totalCost.toLocaleString()} G</span>}
      </>}
    >
      {corporation.description && <p className="mb-3 text-xs leading-relaxed text-base-content/65 sm:text-sm">{corporation.description}</p>}
      <div className="grid grid-cols-1 gap-2 sm:gap-3">
        {corporation.levels.map(level => (
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
    </ExpandableSection>
  );
};
