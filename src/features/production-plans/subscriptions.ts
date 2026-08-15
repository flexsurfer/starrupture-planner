import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerProductionPlansSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regSub(
        appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS,
        () => [[appIds.subscriptions.BASES_SELECTED_BASE]],
        ([selectedBase], ..._params) => {
            void _params;
            return selectedBase ? selectedBase.productions.map((section) => section.id) : [];
        },
    );

    registrar.regSub(
        appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID,
        (baseId, sectionId) => {
            void sectionId;
            return [[appIds.subscriptions.BASES_BASE_BY_ID, baseId]];
        },
        ([base], _baseId, sectionId) => (
            base && sectionId ? base.productions.find((section) => section.id === sectionId) || null : null
        ),
    );

    registrar.regSub(
        appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID,
        () => [[appIds.subscriptions.ITEMS_BY_ID_MAP]],
        ([itemsById], itemId) => (itemId ? itemsById[itemId]?.name || itemId : ''),
    );
};
