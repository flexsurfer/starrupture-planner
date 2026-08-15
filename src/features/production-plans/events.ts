import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base } from '@/state/db';
import { clearOutputPlanLinksForProduction } from '@/utils/planOutputAllocations';

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
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
};
