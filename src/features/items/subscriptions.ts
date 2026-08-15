import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Building, Recipe } from '@/app/uklad/model';
import {
    DRONE_MERGER_3_TO_1_BUILDING_ID,
    ORBITAL_CARGO_LAUNCHER_BUILDING_ID,
    ORBITAL_CARGO_LAUNCHER_TIER_2_BUILDING_ID,
    PACKAGE_DISPATCHER_BUILDING_ID,
    PACKAGE_RECEIVER_BUILDING_ID,
} from '@/constants/buildingIds';
import type { CorporationUsage } from '@/features/items/types';

export const registerItemsSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.ITEMS_LIST, stateKeys.itemsList);
    registrar.regRootSub(appIds.subscriptions.ITEMS_BY_ID_MAP, stateKeys.itemsById);
    registrar.regRootSub(appIds.subscriptions.ITEMS_SELECTED_CATEGORY, stateKeys.itemsSelectedCategory);
    registrar.regRootSub(appIds.subscriptions.ITEMS_SELECTED_BUILDING, stateKeys.itemsSelectedBuilding);
    registrar.regRootSub(appIds.subscriptions.ITEMS_SEARCH_TERM, stateKeys.itemsSearchTerm);
    registrar.regRootSub(appIds.subscriptions.ITEMS_CATEGORIES, stateKeys.itemsCategories);
    registrar.regSub(
        appIds.subscriptions.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS,
        () => [[appIds.subscriptions.BUILDINGS_LIST]],
        ([buildings], ..._params) => {
            void _params;
            const buildingNames = new Set<string>(['all']);
            for (const building of buildings) {
                if (building.type === 'production') {
                    buildingNames.add(building.name);
                }
            }
            return Array.from(buildingNames).sort();
        },
    );

    registrar.regSub(
        appIds.subscriptions.ITEMS_FILTERED_LIST,
        () => [
            [appIds.subscriptions.ITEMS_SELECTED_CATEGORY],
            [appIds.subscriptions.ITEMS_SELECTED_BUILDING],
            [appIds.subscriptions.ITEMS_SEARCH_TERM],
            [appIds.subscriptions.ITEMS_LIST],
            [appIds.subscriptions.BUILDINGS_LIST],
        ],
        ([category, selectedBuilding, searchTerm, items, buildings], ..._params) => {
            void _params;
            let filtered = category === 'all'
                ? items
                : items.filter((item) => item.type === category);

            if (selectedBuilding !== 'all') {
                const itemsProducedByBuilding = new Set<string>();
                for (const building of buildings) {
                    if (building.name === selectedBuilding) {
                        building.recipes?.forEach((recipe) => itemsProducedByBuilding.add(recipe.output.id));
                    }
                }
                filtered = filtered.filter((item) => itemsProducedByBuilding.has(item.id));
            }

            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                filtered = filtered.filter((item) => (
                    item.name.toLowerCase().includes(searchLower)
                    || item.id.toLowerCase().includes(searchLower)
                ));
            }

            return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
        },
    );

    registrar.regSub(
        appIds.subscriptions.ITEMS_TABLE_ROWS,
        () => [
            [appIds.subscriptions.ITEMS_FILTERED_LIST],
            [appIds.subscriptions.BUILDINGS_LIST],
            [appIds.subscriptions.CORPORATIONS_LIST],
        ],
        ([filteredItems, buildings, corporations], ..._params) => {
            void _params;
            const producingBuildingsMap = new Map<string, Map<string, number>>();
            for (const building of buildings) {
                for (const recipe of building.recipes || []) {
                    if (!producingBuildingsMap.has(recipe.output.id)) {
                        producingBuildingsMap.set(recipe.output.id, new Map<string, number>());
                    }
                    const buildingRates = producingBuildingsMap.get(recipe.output.id)!;
                    const existingRate = buildingRates.get(building.name);
                    if (existingRate === undefined || recipe.output.amount_per_minute < existingRate) {
                        buildingRates.set(building.name, recipe.output.amount_per_minute);
                    }
                }
            }

            const corporationUsageMap = new Map<string, CorporationUsage[]>();
            for (const corporation of corporations) {
                for (const level of corporation.levels) {
                    for (const component of level.components) {
                        if (!corporationUsageMap.has(component.id)) {
                            corporationUsageMap.set(component.id, []);
                        }
                        corporationUsageMap.get(component.id)!.push({
                            corporation: corporation.name,
                            level: level.level,
                        });
                    }
                }
            }

            return filteredItems.map((item) => ({
                item,
                producingBuildings: Array.from(
                    (producingBuildingsMap.get(item.id) || new Map<string, number>()).entries(),
                )
                    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
                    .map(([buildingName]) => buildingName),
                corporationUsage: corporationUsageMap.get(item.id) || [],
            }));
        },
    );

    registrar.regSub(
        appIds.subscriptions.ITEMS_HELPER_LOOKUPS,
        () => [[appIds.subscriptions.CORPORATIONS_LIST]],
        ([corporations], ..._params) => {
            void _params;
            const corporationNameToId = new Map<string, string>();
            const buildingCorporationUsage = new Map<string, CorporationUsage[]>();

            for (const corporation of corporations) {
                corporationNameToId.set(corporation.name, corporation.id);
                for (const level of corporation.levels) {
                    for (const reward of level.rewards) {
                        if (!buildingCorporationUsage.has(reward.name)) {
                            buildingCorporationUsage.set(reward.name, []);
                        }
                        buildingCorporationUsage.get(reward.name)!.push({
                            corporation: corporation.name,
                            level: level.level,
                        });
                    }
                }
            }

            return { corporationNameToId, buildingCorporationUsage };
        },
    );

    registrar.regSub(
        appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID,
        () => [[appIds.subscriptions.ITEMS_LIST], [appIds.subscriptions.BUILDINGS_LIST]],
        ([items, buildings], buildingId) => {
            const building = buildings.find((entry) => entry.id === buildingId);
            if (!building) return [];

            if (
                building.id === PACKAGE_RECEIVER_BUILDING_ID
                || building.id === PACKAGE_DISPATCHER_BUILDING_ID
                || building.id === ORBITAL_CARGO_LAUNCHER_BUILDING_ID
                || building.id === ORBITAL_CARGO_LAUNCHER_TIER_2_BUILDING_ID
                || building.type === 'storage'
                || building.id === DRONE_MERGER_3_TO_1_BUILDING_ID
            ) {
                return [...items].sort((a, b) => a.name.localeCompare(b.name));
            }

            const itemIds = new Set<string>();
            building.recipes?.forEach((recipe) => itemIds.add(recipe.output.id));
            return [...items]
                .filter((item) => itemIds.has(item.id))
                .sort((a, b) => a.name.localeCompare(b.name));
        },
    );

    registrar.regSub(
        appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID,
        () => [[appIds.subscriptions.BUILDINGS_LIST]],
        ([buildings], itemId) => {
            if (!itemId) return [];

            const results: { recipe: Recipe; building: Building }[] = [];
            for (const building of buildings) {
                for (const recipe of building.recipes || []) {
                    if (recipe.inputs.some((input) => input.id === itemId)) {
                        results.push({ recipe, building });
                    }
                }
            }
            return results;
        },
    );

};
