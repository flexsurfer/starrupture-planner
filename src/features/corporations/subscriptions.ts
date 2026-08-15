import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerCorporationsSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.CORPORATIONS_LIST, stateKeys.corporationsList);

    registrar.regSub(
        appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS,
        () => [[appIds.subscriptions.CORPORATIONS_LIST]],
        ([corporations], ..._params) => {
            void _params;
            return corporations.map((corporation) => ({
                ...corporation,
                stats: {
                    totalLevels: corporation.levels.length,
                    totalComponents: corporation.levels.reduce((sum, level) => sum + level.components.length, 0),
                    totalCost: corporation.levels.reduce((sum, level) => sum + (level.xp ?? 0), 0),
                },
            }));
        },
    );

    registrar.regSub(
        appIds.subscriptions.CORPORATIONS_STATS_SUMMARY,
        () => [[appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS]],
        ([corporationsWithStats], ..._params) => {
            void _params;
            return {
                totalCorporations: corporationsWithStats.length,
                totalLevels: corporationsWithStats.reduce((total, corporation) => total + corporation.stats.totalLevels, 0),
                totalCost: corporationsWithStats.reduce((total, corporation) => total + corporation.stats.totalCost, 0),
            };
        },
    );
};
