import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { BaseCardCollapsedSections, BasesById } from '@/state/db';
import { resolveBaseCardCollapsedSections } from '@/state/base-card-sections';
import { registerBasesDerivedSubscriptions } from './derived-subscriptions';

export const registerBasesSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.BASES_LIST, stateKeys.basesList);
    registrar.regRootSub(appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS, stateKeys.basesCardCollapsedSections);
    registrar.regRootSub(appIds.subscriptions.BASES_SELECTED_BASE_ID, stateKeys.basesSelectedBaseId);
    registrar.regRootSub(appIds.subscriptions.BASES_SELECTED_DETAIL_TAB, stateKeys.basesSelectedDetailTab);

    registrar.regSub(
        appIds.subscriptions.BASES_BY_ID_MAP,
        () => [[appIds.subscriptions.BASES_LIST]],
        ([bases], ..._params) => {
            void _params;
            const basesById: BasesById = {};
            for (const base of bases) basesById[base.id] = base;
            return basesById;
        },
    );

    registrar.regSub(
        appIds.subscriptions.BASES_SELECTED_BASE,
        () => [[appIds.subscriptions.BASES_SELECTED_BASE_ID], [appIds.subscriptions.BASES_BY_ID_MAP]],
        ([selectedBaseId, basesById], ..._params) => {
            void _params;
            return selectedBaseId ? basesById[selectedBaseId] || null : null;
        },
    );

    registrar.regSub(
        appIds.subscriptions.BASES_BASE_BY_ID,
        () => [[appIds.subscriptions.BASES_BY_ID_MAP]],
        ([basesById], baseId) => (baseId ? basesById[baseId] || null : null),
    );

    registrar.regSub(
        appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS_BY_BASE_ID,
        () => [[appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS]],
        ([collapsedSectionsByBaseId], baseId) => (
            resolveBaseCardCollapsedSections(
                collapsedSectionsByBaseId[baseId] as BaseCardCollapsedSections | undefined,
            )
        ),
    );

    registerBasesDerivedSubscriptions(registrar);
};
