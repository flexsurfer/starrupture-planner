import { useRuntime } from '@/app/uklad/bindings';
import { appIds } from '@/app/uklad/catalog';
import { ComponentIcon } from './ComponentIcon';
import type { CorporationComponent, Item, Reward } from '@/app/uklad/model';

type LevelCardProps = {
  level: number;
  xp?: number;
  components: CorporationComponent[];
  rewards: Reward[];
  itemsMap: Record<string, Item>;
  corporationId: string;
};

export const LevelCard = ({ level, xp, components, rewards, itemsMap, corporationId }: LevelCardProps) => {
  const runtime = useRuntime();

  return (
    <section aria-label={`Level ${level}`} className="min-w-0 overflow-hidden rounded-lg border border-base-300 bg-base-200">
      <div className="flex items-center justify-between gap-2 border-b border-base-300 px-2 py-2 sm:px-3">
        <h3 className="text-sm font-semibold text-base-content">Level {level}</h3>
        {(xp ?? 0) > 0 && <span className="text-xs font-semibold text-info tabular-nums">{(xp ?? 0).toLocaleString()} G</span>}
      </div>

      {components.length > 0 && <div className="p-2 sm:p-3">
        <p className="mb-1.5 text-[10px] font-medium text-base-content/60 sm:text-xs">
          {components.length > 1 ? 'Supply options · choose one to plan' : 'Supply item'}
        </p>
        <div className={`grid gap-1.5 ${components.length > 1 ? 'xl:grid-cols-2' : ''}`}>
          {components.map((component, index) => (
            <button
              key={`${component.id}-${index}`}
              type="button"
              className="flex min-w-0 items-center gap-2 rounded-md border border-transparent bg-base-content/5 p-2 text-left hover:border-base-content/25 hover:bg-base-content/10 focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => runtime.dispatch([appIds.events.PLANNER_OPEN_ITEM, component.id, { corporationId, level }])}
              aria-label={`Open ${itemsMap[component.id]?.name || component.id} in planner for level ${level}`}
              title={`Open ${itemsMap[component.id]?.name || component.id} in planner`}
            >
              <ComponentIcon component={component} itemsMap={itemsMap} />
              <span className="ml-auto shrink-0 text-[10px] text-base-content/50" aria-hidden="true">Plan →</span>
            </button>
          ))}
        </div>
      </div>}

      {rewards.length > 0 && <div className="border-t border-base-300 px-2 py-2 sm:px-3">
        <h4 className="mb-1.5 text-[10px] font-medium text-base-content/60 sm:text-xs">Rewards</h4>
        <ul className="flex flex-wrap gap-1">
          {rewards.map((reward, index) => (
            <li key={index} className="max-w-full rounded border border-transparent bg-base-content/5 px-1.5 py-1 text-[11px] leading-snug text-base-content/85 break-words sm:text-xs">
              {reward.name}
            </li>
          ))}
        </ul>
      </div>}
    </section>
  );
};
