import { useId } from 'react';
import { useTranslation } from '@/shared/i18n';
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
  const { t } = useTranslation();
  const contentId = useId();
  const { totalLevels, totalCost } = corporation.stats;
  const totalRewards = corporation.levels.reduce((sum, level) => sum + level.rewards.length, 0);

  return (
    <section className="min-w-0 rounded-xl border border-base-300 bg-base-200">
      <h2 className="sticky top-0 z-10 rounded-t-xl bg-base-200">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-base-content/5 focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2 sm:gap-4"
          aria-label={corporation.name}
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          onClick={onToggle}
        >
          <CorporationIcon corporationId={corporation.id} corporationName={corporation.name} />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold leading-snug break-words">{corporation.name}</span>
            <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs font-normal leading-relaxed text-base-content/75 tabular-nums">
              <span>{t('{count} levels', { count: totalLevels })}</span>
              <span>{t('{count} rewards', { count: totalRewards })}</span>
              {totalCost > 0 && <span>{t('{cost} G total cost', { cost: totalCost })}</span>}
            </span>
          </span>
          <span className="hidden text-sm font-medium text-base-content/75 sm:block">
            {isCollapsed ? t('View levels') : t('Hide levels')}
          </span>
          <svg aria-hidden="true" className={`size-5 shrink-0 text-base-content/75 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h2>
      {!isCollapsed && <div id={contentId} className="border-t border-base-300 p-3 sm:p-4">
        {corporation.description && <p className="mb-4 text-sm leading-relaxed text-base-content/75">{corporation.description}</p>}
        <div className="grid gap-4">
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
      </div>}
    </section>
  );
};
