import type { Base, BaseBuilding, Production } from '@/app/uklad/model';
import { isLogisticsExcludedOutputBuildingId } from '@/features/bases/building-section';
import { resolveOutputBuilding } from '@/utils/planOutputAllocations';
import { takeOverPlanningEndpoint } from '@/features/bases/building-operations';

/** A Planning connection may claim only a free output and may not create a plan cycle. */
export function canUsePlanningOutput(bases: Base[], sourceBase: Base, output: BaseBuilding, targetBaseId: string, targetPlan: Production, existingInputId?: string): boolean {
    if (output.sectionType !== 'outputs' || isLogisticsExcludedOutputBuildingId(output.buildingTypeId)) return false;
    const resolved = resolveOutputBuilding(output, sourceBase);
    if (!resolved.selectedItemId || resolved.selectedItemId === targetPlan.selectedItemId || !resolved.ratePerMinute || resolved.ratePerMinute <= 0) return false;
    if (bases.some(base => base.buildings.some(input => input.sectionType === 'inputs' &&
        !(base.id === targetBaseId && input.id === existingInputId) &&
        input.linkedOutput?.baseId === sourceBase.id && input.linkedOutput.buildingId === output.id))) return false;

    const visited = new Set<string>();
    const dependsOnTarget = (base: Base, planId: string): boolean => {
        if (base.id === targetBaseId && planId === targetPlan.id) return true;
        const key = JSON.stringify([base.id, planId]);
        if (visited.has(key)) return false;
        visited.add(key);
        const plan = base.productions.find(candidate => candidate.id === planId);
        return (plan?.inputs ?? []).some(snapshot => {
            // Saved flows use these snapshots even after the physical receiver is edited.
            const upstream = bases.find(candidate => candidate.id === snapshot.linkedOutput?.baseId);
            const endpoint = upstream?.buildings.find(candidate => candidate.id === snapshot.linkedOutput?.buildingId);
            return !!(upstream && endpoint?.sourceProductionId && dependsOnTarget(upstream, endpoint.sourceProductionId));
        });
    };
    return !output.sourceProductionId || !dependsOnTarget(sourceBase, output.sourceProductionId);
}

/** Existing receivers may retain their own output reservation, but must obey the same connection rules. */
export function canSelectPlanningInput(bases: Base[], input: BaseBuilding, targetBaseId: string, targetPlan: Production | undefined): boolean {
    if (input.sectionType !== 'inputs') return false;
    if (input.planningOwnerPlanId && input.planningOwnerPlanId !== targetPlan?.id) return false;
    if (!input.linkedOutput) return true;
    const sourceBase = bases.find(base => base.id === input.linkedOutput?.baseId);
    const output = sourceBase?.buildings.find(building => building.id === input.linkedOutput?.buildingId);
    return !!(sourceBase && output && targetPlan &&
        canUsePlanningOutput(bases, sourceBase, output, targetBaseId, targetPlan, input.id));
}

/** Keep manually shared inputs intact when removing an automatic plan endpoint. */
export function removeOwnedPlanningInput(base: Base, inputId: string, planId: string): void {
    const input = base.buildings.find(building => building.id === inputId);
    if (input?.planningOwnerPlanId !== planId) return;
    if (base.productions.some(plan => plan.id !== planId && plan.inputs?.some(candidate => candidate.id === inputId))) {
        takeOverPlanningEndpoint(base, input);
        for (const plan of base.productions) {
            if (plan.id === planId) continue;
            for (const snapshot of plan.inputs ?? []) {
                if (snapshot.id === inputId) delete snapshot.planningOwnerPlanId;
            }
        }
    } else {
        base.buildings = base.buildings.filter(building => building.id !== inputId);
    }
    const owner = base.productions.find(plan => plan.id === planId);
    if (owner) owner.inputs = owner.inputs?.filter(candidate => candidate.id !== inputId);
}
