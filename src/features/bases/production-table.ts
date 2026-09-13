import type { Base, Building, Item } from '@/app/uklad/model';
import { buildProductionFlow } from '@/features/planner/production-flow';
import { getFlowInputBuildings, sanitizeRecipeSelectionsForInputItems } from '@/utils/productionPlanInputs';
import { isBuildingAvailableForSection } from './building-section';
import type { BaseProductionRecipeCard, BaseProductionTable, BaseProductionTableCard, BuildingCoverageRow, CoveragePlanDemand, MaterialBalanceRow, PlanSummaryRow, ProductionItemCoverage } from './types';

export function buildBaseProductionTable(
  base: Base | null,
  bases: Base[],
  buildings: Building[],
  itemsById: Record<string, Item>,
  plans: PlanSummaryRow[],
  materials: MaterialBalanceRow[],
): BaseProductionTable {
  if (!base) return { groups: [], requiredBuildings: 0, missingBuildings: 0, missingMaterials: 0 };

  const recipes = new Map<string, BaseProductionRecipeCard>();
  const coverage = new Map<string, BuildingCoverageRow>();
  const unavailable: BaseProductionTableCard[] = [];
  const buildingsById = new Map(buildings.map(building => [building.id, building]));
  const owned = new Map<string, number>();
  const capacityOwned = new Map<string, number>();
  const recipeDemands = new Map<string, { card: BaseProductionRecipeCard; required: number; rate: number }[]>();
  for (const building of base.buildings) {
    if (building.sectionType === 'production') owned.set(building.buildingTypeId, (owned.get(building.buildingTypeId) ?? 0) + 1);
    const definition = buildingsById.get(building.buildingTypeId);
    if (building.sectionType === 'production' || (definition && !isBuildingAvailableForSection(definition, 'production'))) {
      capacityOwned.set(building.buildingTypeId, (capacityOwned.get(building.buildingTypeId) ?? 0) + 1);
    }
  }
  const getItem = (id: string) => itemsById[id] ?? { id, name: id, type: 'unknown' };
  const demand = (plan: PlanSummaryRow, amount: number): CoveragePlanDemand => ({
    planId: plan.id, name: plan.name, status: plan.status, targetItem: plan.targetItem, amount,
  });

  for (const summary of plans) {
    const plan = base.productions.find(entry => entry.id === summary.id)!;
    const inputs = getFlowInputBuildings(plan.inputs ?? [], bases);
    const flow = buildProductionFlow({
      targetItemId: plan.selectedItemId,
      targetAmount: plan.targetAmount,
      inputBuildings: inputs,
      rawProductionDisabled: true,
      includeLauncher: !!plan.corporationLevel,
      recipeSelections: sanitizeRecipeSelectionsForInputItems(plan.recipeSelections, inputs),
    }, buildings);
    if (!flow.nodes.some(node => node.nodeType === 'production' && node.outputItem === plan.selectedItemId)) {
      unavailable.push({ kind: 'unavailable', id: `unavailable:${plan.id}`, item: getItem(plan.selectedItemId), rate: plan.targetAmount,
        itemCoverage: { required: plan.targetAmount, covered: 0, planDemands: [{ ...demand(summary, plan.targetAmount), covered: 0 }] } });
    }
    for (const node of flow.nodes) {
      if (node.nodeType === 'input') continue;
      // Plans retain their own recipes and rounding; combining targets first would change their requirements.
      const id = JSON.stringify([node.nodeType, node.buildingId, node.recipeIndex, node.outputItem]);
      const rate = node.outputAmount * node.buildingCount;
      const required = Math.ceil(node.buildingCount);
      const targetRate = node.nodeType === 'production' && node.outputItem === plan.selectedItemId ? plan.targetAmount : 0;
      const existing = recipes.get(id);
      if (existing) {
        existing.rate += rate;
        existing.targetRate += targetRate;
        existing.requiredBuildings += required;
      } else {
        recipes.set(id, { kind: 'recipe', id, item: getItem(node.outputItem), node, rate, targetRate, requiredBuildings: required, coverage: null,
          itemCoverage: { required: 0, covered: 0, planDemands: [] } });
      }
      const allocations = recipeDemands.get(plan.id) ?? [];
      allocations.push({ card: recipes.get(id)!, required, rate });
      recipeDemands.set(plan.id, allocations);

      const building = buildingsById.get(node.buildingId);
      if (!building || !isBuildingAvailableForSection(building, 'production')) continue;
      const row = coverage.get(building.id) ?? {
        buildingId: building.id, building, perPlan: {}, planDemands: [], totalRequired: 0,
        owned: owned.get(building.id) ?? 0, covered: 0, missing: 0,
      };
      row.totalRequired += required;
      row.perPlan[plan.id] = (row.perPlan[plan.id] ?? 0) + required;
      coverage.set(building.id, row);
    }
  }
  for (const row of coverage.values()) {
    row.covered = Math.min(row.owned, row.totalRequired);
    row.missing = Math.max(0, row.totalRequired - row.owned);
    row.planDemands = plans.filter(plan => row.perPlan[plan.id] > 0).map(plan => demand(plan, row.perPlan[plan.id]));
  }
  for (const card of recipes.values()) card.coverage = coverage.get(card.node.buildingId) ?? null;

  // Active plans reserve capacity first in base order, matching base building occupancy.
  // These are local output capacities; upstream material shortages have their own cards.
  const allocationOrder = [...base.productions].sort((a, b) => Number(!!b.active) - Number(!!a.active));
  const remainingBuildings = new Map(capacityOwned);
  for (const plan of allocationOrder) {
    const summary = plans.find(entry => entry.id === plan.id)!;
    for (const { card, required, rate } of recipeDemands.get(plan.id) ?? []) {
      const available = remainingBuildings.get(card.node.buildingId) ?? 0;
      const assigned = Math.min(required, available);
      const covered = Math.min(rate, assigned * card.node.outputAmount);
      remainingBuildings.set(card.node.buildingId, available - assigned);
      card.itemCoverage.planDemands.push({ ...demand(summary, rate), covered });
      card.itemCoverage.required += rate;
      card.itemCoverage.covered += covered;
    }
  }
  const coverInput = (balance: MaterialBalanceRow): ProductionItemCoverage => {
    let available = balance.available;
    const planDemands = allocationOrder.flatMap(plan => {
      const entry = balance.planDemands.find(candidate => candidate.planId === plan.id);
      if (!entry) return [];
      const covered = Math.min(entry.amount, available);
      available -= covered;
      return [{ ...entry, covered }];
    });
    return { required: balance.totalRequired, covered: balance.covered, planDemands };
  };

  const cards: BaseProductionTableCard[] = [
    ...recipes.values(), ...unavailable,
    ...materials.map(balance => ({ kind: 'input' as const, id: `input:${balance.itemId}`, item: balance.item, balance, itemCoverage: coverInput(balance) })),
  ];
  const grouped = new Map<string, BaseProductionTableCard[]>();
  for (const card of cards) {
    const type = card.kind === 'unavailable' || (card.kind === 'recipe' && card.targetRate > 0) ? 'target'
      : card.kind === 'recipe' && card.node.nodeType === 'launcher' ? 'launcher' : card.item.type || 'unknown';
    const group = grouped.get(type) ?? [];
    group.push(card);
    grouped.set(type, group);
  }
  const order = ['launcher', 'target', 'final', 'ammo', 'component', 'processed', 'raw', 'unknown'];
  const rank = (type: string) => order.includes(type) ? order.indexOf(type) : order.indexOf('unknown');
  return {
    groups: [...grouped].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([type, entries]) => ({
      type, cards: entries.sort((a, b) => a.item.name.localeCompare(b.item.name) || a.id.localeCompare(b.id)),
    })),
    requiredBuildings: [...coverage.values()].reduce((sum, row) => sum + row.totalRequired, 0),
    missingBuildings: [...coverage.values()].reduce((sum, row) => sum + row.missing, 0),
    missingMaterials: materials.filter(row => row.missing > 0).length,
  };
}
