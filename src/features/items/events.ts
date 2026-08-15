import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerItemsEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.ITEMS_SET_SELECTED_CATEGORY, ({ draftState }, category) => {
        draftState.itemsSelectedCategory = category;
    });

    registrar.regEvent(appIds.events.ITEMS_SET_SELECTED_BUILDING, ({ draftState }, building) => {
        draftState.itemsSelectedBuilding = building;
    });

    registrar.regEvent(appIds.events.ITEMS_SET_SEARCH_TERM, ({ draftState }, searchTerm) => {
        draftState.itemsSearchTerm = searchTerm;
    });
};
