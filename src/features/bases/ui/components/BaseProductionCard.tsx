import { appIds } from '@/app/uklad/catalog';
import { useRuntime } from '@/app/uklad/bindings';
import type { BaseProductionTableCard, ProductionItemCoverage } from '@/features/bases/types';
import { BuildingImage, ItemImage, RecipeTypeIcon, SectionIcon } from '@/shared/ui';
import { NodeRecipeButton } from '@/features/planner/ui/visualization/NodeRecipeButton';
import { getItemCategoryColor } from '@/utils/itemColors';
import { formatQuantity } from '@/utils/formatQuantity';
import { BuildingCountControl } from './BuildingCountControl';

const PlanCoverage = ({ plans, color }: { plans: ProductionItemCoverage['planDemands']; color: string }) => {
  const runtime = useRuntime();
  if (!plans.length) return null;
  return <ul className="space-y-2 px-2 pb-2 text-left">
    {plans.map(plan => <li key={plan.planId} className="text-[10px] leading-snug sm:text-[11px]">
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 break-words text-base-content/70" title={plan.status === 'active' ? 'Active plan' : plan.status === 'error' ? 'Plan needs attention' : 'Inactive plan'}>{plan.name}</p>
        <button type="button" className="btn btn-xs h-6 min-h-6 shrink-0 rounded border border-base-content/25 bg-base-300 px-1 text-[10px] font-normal text-base-content/75 shadow-sm hover:border-base-content/40 hover:bg-base-content/15" aria-label={`Edit ${plan.name}`}
          onClick={() => runtime.dispatch([appIds.events.PRODUCTION_PLAN_MODAL_OPEN, plan.planId])}>Edit</button>
      </div>
      <dl className="mt-0.5 grid grid-cols-2 gap-1 tabular-nums">
        <div className="min-w-0"><dt className="text-[10px] text-base-content/50">Required</dt><dd className="break-words" style={{ color }}>{formatQuantity(plan.amount)}/min</dd></div>
        <div className="min-w-0 text-right"><dt className="text-[10px] text-base-content/50">Covered</dt><dd className="break-words" style={{ color }}>{formatQuantity(plan.covered)}/min</dd></div>
      </dl>
    </li>)}
  </ul>;
};

const CoverageBar = ({ label, required, covered, color, unit = '', description }: {
  label: string; required: number; covered: number; color?: string; unit?: string; description: string;
}) => {
  if (required <= 0) return null;
  const percent = Math.max(0, Math.min(100, covered / required * 100));
  return <div title={description}>
    <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-0.5 pb-1 text-[10px] leading-tight text-base-content/55 tabular-nums">
      <span>{label}</span>
      <span>{formatQuantity(covered)} / {formatQuantity(required)}{unit}</span>
    </div>
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      aria-valuetext={`${formatQuantity(covered)}${unit} of ${formatQuantity(required)}${unit} covered`}
      className="h-1 w-full overflow-hidden bg-base-content/10">
      <div className="h-full bg-base-content/35" style={{ width: `${percent}%`, ...(color ? { backgroundColor: color } : {}) }} />
    </div>
  </div>;
};

export const BaseProductionCard = ({ card, baseId, target }: { card: BaseProductionTableCard; baseId: string; target: boolean }) => {
  const runtime = useRuntime();
  const color = getItemCategoryColor(card.item.type);
  const coverage = card.kind === 'recipe' ? card.coverage : null;
  const balance = card.kind === 'input' ? card.balance : null;
  const rate = card.itemCoverage.required;

  return <article aria-label={`${card.item.name}${card.kind === 'input' ? ' input' : card.kind === 'recipe' && card.node.nodeType === 'launcher' ? ' delivery' : ''}`}
    className={`relative flex h-full min-w-0 flex-col rounded-md border bg-base-200 text-center ${target ? 'border-primary' : 'border-base-300'}`}>
    {card.kind === 'input' && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded border border-teal-400/20 bg-base-200 px-1.5 text-[10px] leading-4 text-teal-300/70">Input</span>}

    <div className={`space-y-1 p-1.5 sm:space-y-2 sm:p-2 ${card.kind === 'input' ? 'pt-4 sm:pt-4' : ''}`}>
      <div className="flex items-start gap-1">
        <h3 className="min-w-0 flex-1 break-words text-xs font-normal leading-tight text-base-content/80 sm:text-sm">{card.item.name}</h3>
        {card.kind === 'recipe' && card.node.nodeType === 'production' && <NodeRecipeButton item={card.item} node={card.node} />}
      </div>
      <div className="relative flex items-center justify-center gap-1.5">
        {card.kind === 'recipe' && card.node.recipeType && <RecipeTypeIcon recipeType={card.node.recipeType} className="absolute left-0 top-0" />}
        <div className="shrink-0 [&>div]:size-10 sm:[&>div]:size-12">
          <ItemImage itemId={card.item.id} item={card.item} size="medium" className="!size-10 sm:!size-12" />
        </div>
        <div className="min-w-0 break-words text-lg font-semibold leading-tight tabular-nums sm:text-xl" style={{ color }}>
          {formatQuantity(rate)}<span className="block text-[10px] font-normal sm:text-xs">/min {card.kind === 'input' ? 'needed' : 'planned'}</span>
        </div>
      </div>
      {card.kind === 'recipe' && card.targetRate > 0 && Math.abs(card.rate - card.targetRate) > 0.01 && <p className="text-[10px] text-base-content/55">Target {formatQuantity(card.targetRate)}/min · rest used in plans</p>}
    </div>

    <PlanCoverage plans={card.itemCoverage.planDemands} color={color} />
    <div className="mt-auto">
      <div className="px-2 pt-1 pb-1.5">
        <CoverageBar label="Item coverage" required={rate} covered={card.itemCoverage.covered} color={color} unit="/min"
          description={card.kind === 'input' ? 'Available input supply, shared between plans with active plans first.' : 'Output capacity from owned buildings, shared between plans with active plans first. Input supply is shown on its own cards.'} />
      </div>
      <div className="space-y-1.5 rounded-b bg-base-content/5 p-1.5 sm:p-2">
        {card.kind === 'recipe' ? <>
          <div className="flex items-center gap-1.5 text-left">
            <BuildingImage buildingId={card.node.buildingId} size="small" className="!size-6 shrink-0 sm:!size-8" />
            <span className="min-w-0 flex-1 break-words text-[10px] leading-tight text-base-content/60 sm:text-xs">{card.node.buildingName}</span>
            <span className="shrink-0 text-xs text-base-content/75 tabular-nums" title="Whole buildings needed for this recipe across plans">×{formatQuantity(card.requiredBuildings)}</span>
          </div>
          {coverage ? <div className="space-y-1.5">
            <div className="flex flex-wrap justify-between gap-x-1 text-[10px] text-base-content/55">
              <span title="Shared count for this building type across all recipes in this base">Owned in base</span>
              {coverage.owned !== coverage.totalRequired && <span className={coverage.missing > 0 ? 'text-error' : ''}>
                {coverage.missing > 0 ? `${formatQuantity(coverage.missing)} missing` : `${formatQuantity(coverage.owned - coverage.totalRequired)} extra`}
              </span>}
            </div>
            <BuildingCountControl cardLayout value={coverage.owned} ariaLabel={`${coverage.building.name} owned count`}
              onChange={count => runtime.dispatch([appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT, baseId, coverage.buildingId, 'production', count])} />
            <CoverageBar label="Base coverage" required={coverage.totalRequired} covered={coverage.owned}
              description={`Owned ${coverage.building.name} buildings against requirements across all recipes.`} />
          </div> : <button type="button" className="btn btn-xs btn-ghost w-full text-[10px] font-normal text-base-content/65"
            onClick={() => runtime.dispatch([appIds.events.BASES_SET_DETAIL_TAB, 'buildings'])}>Manage buildings</button>}
        </> : balance ? <>
          <div className="flex flex-wrap items-baseline justify-between gap-1 text-[10px] text-base-content/60">
            <span>Base supply</span><span className="text-xs tabular-nums" style={{ color }}>{formatQuantity(balance.available)}/min</span>
          </div>
          <p className={`text-[10px] tabular-nums ${balance.missing > 0 ? 'text-error' : 'text-base-content/55'}`}>
            {balance.missing > 0 ? `${formatQuantity(balance.missing)}/min missing` : rate === 0 ? 'No plan demand' : balance.available > rate ? `${formatQuantity(balance.available - rate)}/min extra` : 'All available'}
          </p>
          <button type="button" className="btn btn-xs btn-ghost h-8 w-full gap-1 px-0 text-[10px] font-normal text-base-content/65"
            onClick={() => runtime.dispatch([appIds.events.BASES_SET_DETAIL_TAB, 'buildings'])}>
            <SectionIcon name="buildings" className="size-3" />Manage inputs
          </button>
        </> : <p className="text-[11px] text-warning">Review plan setup</p>}
      </div>
    </div>
  </article>;
};
