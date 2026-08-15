import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base, BaseBuilding, PlanRequiredBuilding } from '@/app/uklad/model';
import { buildProductionFlow } from '@/components/planner/core/productionFlowBuilder';
import { getSectionTypeForBuilding, buildActivePlanOccupancy } from '@/components/mybases/utils';
import { computeRequiredBuildings, getFlowInputBuildings, sanitizeRecipeSelectionsForInputItems } from '@/utils/productionPlanInputs';
import { clearOutputPlanLinksForProduction } from '@/utils/planOutputAllocations';
import { ORBITAL_CARGO_LAUNCHER_BUILDING_ID } from '@/constants/buildingIds';
import { createBaseBuilding } from '@/features/bases/building-operations';

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
}

function buildAvailableBuildingCountByType(base: Base, excludePlanId?: string | null): Map<string, number> {
    const totals = new Map<string, number>();
    for (const baseBuilding of base.buildings) {
        totals.set(baseBuilding.buildingTypeId, (totals.get(baseBuilding.buildingTypeId) || 0) + 1);
    }

    const occupied = buildActivePlanOccupancy(base, { excludePlanId }).occupiedBuildingTypeCounts;
    const available = new Map<string, number>();
    totals.forEach((totalCount, buildingTypeId) => {
        available.set(buildingTypeId, Math.max(0, totalCount - (occupied.get(buildingTypeId) || 0)));
    });
    return available;
}

export const registerProductionPlansEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, ({ draftState }, baseId, sectionId) => {
        const section = getBaseById(draftState.basesList, baseId)?.productions.find((plan) => plan.id === sectionId);
        if (section) {
            section.active = true;
            section.status = 'active';
        }
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, ({ draftState }, baseId, sectionId) => {
        const section = getBaseById(draftState.basesList, baseId)?.productions.find((plan) => plan.id === sectionId);
        if (section) {
            section.active = false;
            section.status = 'inactive';
        }
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_DELETE_SECTION, ({ draftState }, baseId, sectionId) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        base.productions = base.productions.filter((plan) => plan.id !== sectionId);
        clearOutputPlanLinksForProduction(base, sectionId);
    });

    registrar.regEvent(appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE, ({ draftState }, baseId, planId, mode) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        const plan = base.productions.find((section) => section.id === planId);
        if (!plan) return;

        const planInputBuildings = getFlowInputBuildings(plan.inputs || [], draftState.basesList);
        const recipeSelections = sanitizeRecipeSelectionsForInputItems(plan.recipeSelections || {}, planInputBuildings);
        const flow = buildProductionFlow(
            {
                targetItemId: plan.selectedItemId,
                targetAmount: plan.targetAmount > 0 ? plan.targetAmount : 1,
                inputBuildings: planInputBuildings,
                rawProductionDisabled: true,
                includeLauncher: plan.corporationLevel !== null && plan.corporationLevel !== undefined,
                recipeSelections,
            },
            draftState.buildingsList,
        );
        const requiredBuildings = computeRequiredBuildings(flow);
        if (requiredBuildings.length === 0) return;

        const existingCountByType = mode === 'missing'
            ? buildAvailableBuildingCountByType(base, plan.id)
            : new Map<string, number>();
        const buildingCountsToAdd: PlanRequiredBuilding[] = [];

        for (const { buildingId, count: requiredCount } of requiredBuildings) {
            if (requiredCount <= 0) continue;

            const existingCount = mode === 'missing' ? (existingCountByType.get(buildingId) || 0) : 0;
            const countToAdd = mode === 'missing'
                ? Math.max(0, requiredCount - existingCount)
                : requiredCount;
            if (countToAdd === 0) continue;

            buildingCountsToAdd.push({ buildingId, count: countToAdd });
            existingCountByType.set(buildingId, existingCount + countToAdd);
        }

        if (buildingCountsToAdd.length === 0) return;

        const buildingsById = new Map(draftState.buildingsList.map((building) => [building.id, building]));
        const newBuildings: BaseBuilding[] = [];
        for (const { buildingId, count } of buildingCountsToAdd) {
            const sectionType = buildingsById.has(buildingId)
                ? getSectionTypeForBuilding(buildingsById.get(buildingId)!)
                : 'production';
            for (let index = 0; index < count; index += 1) {
                const newBuilding = createBaseBuilding({ buildingTypeId: buildingId, sectionType });
                if (buildingId === ORBITAL_CARGO_LAUNCHER_BUILDING_ID && plan.selectedItemId) {
                    newBuilding.selectedItemId = plan.selectedItemId;
                    newBuilding.ratePerMinute = 10;
                }
                newBuildings.push(newBuilding);
            }
        }

        base.buildings.push(...newBuildings);
    });
};
