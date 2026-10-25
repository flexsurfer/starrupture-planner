import { useTranslation } from '@/shared/i18n';
import { useRuntime } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import { ComponentIcon } from './ComponentIcon';
import type { CorporationComponent, Item, Reward } from '@/app/uklad/model';
import { useCodexView } from '@/shared/ui/CodexViewContext';

type LevelCardProps = {
  level: number;
  xp?: number;
  components: CorporationComponent[];
  rewards: Reward[];
  itemsMap: Record<string, Item>;
  corporationId: string;
};

export const LevelCard = ({ level, xp, components, rewards, itemsMap, corporationId }: LevelCardProps) => {
  const { t, formatNumber } = useTranslation();
  const runtime = useRuntime();
  const codex = useCodexView();

  return (
    <section aria-label={t('Level {level}', { level })} className="corporation-level min-w-0 overflow-hidden rounded-lg border border-base-300 bg-base-100">
      <header className="corporation-level-heading">
        <h3 className="text-sm font-semibold">
          <span className="sr-only">{t('Level {level}', { level })}</span>
          <span className="flex items-center gap-2.5" aria-hidden="true">
            <span>{t('Level')}</span>
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-primary/30 bg-primary/15 text-xl font-bold tabular-nums">
              {formatNumber(level)}
            </span>
          </span>
        </h3>
        {(xp ?? 0) > 0 && <div className="corporation-level-requirement">
          <p className="text-xs text-base-content/75">{t('Level requirement')}</p>
          <p className="mt-1 text-base font-bold text-info tabular-nums">{formatNumber(xp ?? 0)} G</p>
        </div>}
      </header>

      <div className="corporation-level-rewards p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <svg aria-hidden="true" className="size-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13M3 8h18v4H3zM5 12v9h14v-9M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z" />
          </svg>
          {t('Rewards')}
        </h4>
        {rewards.length > 0 ? <ul className="grid gap-2">
          {rewards.map((reward, index) => (
            <li key={index} className="flex items-start gap-2 text-sm leading-relaxed break-words">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-success/75" />
              <span className="min-w-0">{reward.name}</span>
            </li>
          ))}
        </ul> : <p className="text-sm text-base-content/70">{t('No rewards listed')}</p>}
      </div>

      <div className="min-w-0 p-4">
        <h4 className="text-sm font-semibold">{components.length > 1 ? t('Supply options') : t('Supply required')}</h4>
        {components.length > 1 && <p className="mt-1 text-xs leading-relaxed text-base-content/75">
          {t('Each option below can complete this level on its own.')}
        </p>}
        {components.length > 0 ? <ul className="mt-3">
          {components.map((component, index) => (
            <li key={`${component.id}-${index}`}>
              {index > 0 && <div className="flex items-center gap-3 py-1.5 text-xs text-base-content/65" aria-hidden="true">
                <span className="h-px flex-1 bg-base-300" />{t('or')}<span className="h-px flex-1 bg-base-300" />
              </div>}
              <div className="corporation-supply-row rounded-lg border border-base-300 bg-base-200/50 p-3">
                <ComponentIcon component={component} itemsMap={itemsMap} />
                {!codex && <button
                  type="button"
                  className="corporation-plan-button btn btn-sm btn-outline min-h-9 border-base-content/25 text-base-content hover:border-primary hover:bg-primary/10 hover:text-primary"
                  onClick={() => runtime.dispatch([appIds.events.PLANNER_OPEN_ITEM, component.id, { corporationId, level }])}
                  aria-label={t('Open {value} in planner for level {level}', { value: itemsMap[component.id]?.name || component.id, level })}
                  title={t('Open {value} in planner', { value: itemsMap[component.id]?.name || component.id })}
                >
                  {t('Plan')}<span aria-hidden="true">→</span>
                </button>}
              </div>
            </li>
          ))}
        </ul> : <p className="mt-3 text-sm text-base-content/75">{t('No supply required')}</p>}
      </div>
    </section>
  );
};
