import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Building, BuildingsByIdMap } from '@/app/uklad/model';

/** Registers catalog-owned building queries over the shared game-data root. */
export const registerBuildingsSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.BUILDINGS_LIST, stateKeys.buildingsList);

    registrar.regSub(
        appIds.subscriptions.BUILDINGS_BY_ID_MAP,
        () => [[appIds.subscriptions.BUILDINGS_LIST]],
        ([buildings], ..._params) => {
            void _params;
            const byId: BuildingsByIdMap = {};
            for (const building of buildings) {
                byId[building.id] = building;
            }
            return byId;
        },
    );

    registrar.regSub(
        appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST,
        () => [[appIds.subscriptions.BUILDINGS_LIST], [appIds.subscriptions.ITEMS_HELPER_LOOKUPS]],
        ([buildings, helperMaps], ..._params) => {
            void _params;
            const productionBuildings = buildings.filter((building) => building.type === 'production');
            const sorted = [...productionBuildings].sort((a, b) => {
                const usageA = helperMaps.buildingCorporationUsage.get(a.name) || [];
                const usageB = helperMaps.buildingCorporationUsage.get(b.name) || [];
                const minLevelA = usageA.length > 0 ? Math.min(...usageA.map((usage) => usage.level)) : Infinity;
                const minLevelB = usageB.length > 0 ? Math.min(...usageB.map((usage) => usage.level)) : Infinity;

                if (minLevelA === Infinity && minLevelB !== Infinity) return 1;
                if (minLevelA !== Infinity && minLevelB === Infinity) return -1;
                if (minLevelA !== Infinity && minLevelB !== Infinity && minLevelA !== minLevelB) {
                    return minLevelA - minLevelB;
                }
                return a.name.localeCompare(b.name);
            });

            const buildingsById = new Map<string, Building>(sorted.map((building) => [building.id, building]));
            const upgradeTargetIds = new Set<string>();
            for (const building of sorted) {
                if (building.upgrade) upgradeTargetIds.add(building.upgrade);
            }

            const result: Building[] = [];
            const emittedIds = new Set<string>();
            for (const building of sorted) {
                if (emittedIds.has(building.id) || upgradeTargetIds.has(building.id)) continue;
                result.push(building);
                emittedIds.add(building.id);

                const upgradedBuilding = building.upgrade ? buildingsById.get(building.upgrade) : undefined;
                if (upgradedBuilding && !emittedIds.has(upgradedBuilding.id)) {
                    result.push(upgradedBuilding);
                    emittedIds.add(upgradedBuilding.id);
                }
            }

            for (const building of sorted) {
                if (!emittedIds.has(building.id)) {
                    result.push(building);
                    emittedIds.add(building.id);
                }
            }
            return result;
        },
    );
};
