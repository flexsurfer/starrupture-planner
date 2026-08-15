import type { SubscriptionParam, UkladContracts } from '@ukladjs/core/vanilla';
import type { LinkedInputReference } from '@/components/mybases/types';
import type { BuildingSectionType } from '@/components/mybases/types';
import type {
    AppState,
    AppVersionedGameData,
    BaseBuilding,
    BaseCardSectionKey,
    BaseDetailTab,
    CorporationLevelSelection,
    DataVersion,
    TabType,
} from '@/state/db';
import { appIds, stateKeys } from './catalog';

export interface ConfirmationDialogOptions {
    confirmLabel?: string;
    cancelLabel?: string;
    confirmButtonClass?: string;
    onCancel?: () => void;
}

export interface UpdateOutputPlanLinkPayload {
    sourceProductionId?: string | null;
    allocationMode?: BaseBuilding['allocationMode'];
    requestedRatePerMinute?: number | null;
    capacityPerMinute?: number | null;
    priority?: number | null;
}

type CatalogValue<TCatalog extends Record<string, string>> = TCatalog[keyof TCatalog];
type UnmigratedSubscription = {
    params: readonly SubscriptionParam[];
    result: unknown;
};

/**
 * The runtime's complete vocabulary. Feature contracts stay here so handlers,
 * effects, and hooks always agree on one application graph.
 *
 * Subscription result types become specific as each feature is moved from the
 * legacy registration boundary. The catalog keeps those remaining IDs closed
 * while that work continues.
 */
export interface AppContracts extends UkladContracts {
    state: {
        [stateKeys.appDataVersion]: AppState['appDataVersion'];
        [stateKeys.appDataVersions]: AppState['appDataVersions'];
        [stateKeys.appVersionedData]: AppState['appVersionedData'];
        [stateKeys.itemsList]: AppState['itemsList'];
        [stateKeys.itemsById]: AppState['itemsById'];
        [stateKeys.itemsSelectedCategory]: AppState['itemsSelectedCategory'];
        [stateKeys.itemsSelectedBuilding]: AppState['itemsSelectedBuilding'];
        [stateKeys.itemsSearchTerm]: AppState['itemsSearchTerm'];
        [stateKeys.itemsCategories]: AppState['itemsCategories'];
        [stateKeys.buildingsList]: AppState['buildingsList'];
        [stateKeys.corporationsList]: AppState['corporationsList'];
        [stateKeys.uiTheme]: AppState['uiTheme'];
        [stateKeys.uiGameDataLoadPending]: AppState['uiGameDataLoadPending'];
        [stateKeys.uiActiveTab]: AppState['uiActiveTab'];
        [stateKeys.uiConfirmationDialog]: AppState['uiConfirmationDialog'];
        [stateKeys.plannerSelectedItemId]: AppState['plannerSelectedItemId'];
        [stateKeys.plannerSelectedCorporationLevel]: AppState['plannerSelectedCorporationLevel'];
        [stateKeys.plannerRecipeSelections]: AppState['plannerRecipeSelections'];
        [stateKeys.pinnedRecipeSelections]: AppState['pinnedRecipeSelections'];
        [stateKeys.recipeAlternativePresets]: AppState['recipeAlternativePresets'];
        [stateKeys.plannerTargetAmount]: AppState['plannerTargetAmount'];
        [stateKeys.basesList]: AppState['basesList'];
        [stateKeys.energyGroups]: AppState['energyGroups'];
        [stateKeys.basesCardCollapsedSections]: AppState['basesCardCollapsedSections'];
        [stateKeys.basesSelectedBaseId]: AppState['basesSelectedBaseId'];
        [stateKeys.basesSelectedDetailTab]: AppState['basesSelectedDetailTab'];
        [stateKeys.productionPlanModalState]: AppState['productionPlanModalState'];
    };
    events: {
        [appIds.events.APP_INIT]: [];
        [appIds.events.APP_REQUEST_LOAD_GAME_DATA]: [version: DataVersion];
        [appIds.events.APP_GAME_DATA_LOAD_FAILED]: [];
        [appIds.events.APP_SET_DATA_VERSION]: [version: DataVersion, bundle?: AppVersionedGameData];
        [appIds.events.UI_SET_THEME]: [theme: 'light' | 'dark'];
        [appIds.events.UI_SET_ACTIVE_TAB]: [tab: TabType];
        [appIds.events.UI_SHOW_CONFIRMATION_DIALOG]: [title: string, message: string, onConfirm: () => void, options?: ConfirmationDialogOptions];
        [appIds.events.UI_CLOSE_CONFIRMATION_DIALOG]: [];
        [appIds.events.ITEMS_SET_SELECTED_CATEGORY]: [category: string];
        [appIds.events.ITEMS_SET_SELECTED_BUILDING]: [building: string];
        [appIds.events.ITEMS_SET_SEARCH_TERM]: [searchTerm: string];
        [appIds.events.PLANNER_OPEN_ITEM]: [itemId: string, corporationLevel?: CorporationLevelSelection];
        [appIds.events.PLANNER_SET_SELECTED_ITEM]: [itemId: string | null];
        [appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL]: [level: CorporationLevelSelection | null];
        [appIds.events.PLANNER_SET_RECIPE_SELECTION]: [itemId: string, recipeKey: string | null];
        [appIds.events.PLANNER_SET_RECIPE_SELECTIONS]: [selections: Record<string, string>];
        [appIds.events.PLANNER_SET_TARGET_AMOUNT]: [targetAmount: number];
        [appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS]: [selections: Record<string, string>];
        [appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET]: [name: string, selections: Record<string, string>];
        [appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET]: [presetId: string];
        [appIds.events.BASES_CREATE_BASE]: [name: string];
        [appIds.events.BASES_UPDATE_BASE_NAME]: [baseId: string, name: string];
        [appIds.events.BASES_DELETE_BASE]: [baseId: string];
        [appIds.events.BASES_OPEN_BASE]: [baseId: string, tab?: BaseDetailTab];
        [appIds.events.BASES_SET_SELECTED_BASE]: [baseId: string | null];
        [appIds.events.BASES_SET_DETAIL_TAB]: [tab: BaseDetailTab];
        [appIds.events.BASES_SET_CORE_LEVEL]: [level: number];
        [appIds.events.BASES_ADD_BUILDING]: [baseId: string, buildingTypeId: string, sectionType: string, name?: string, description?: string];
        [appIds.events.BASES_ADD_BUILDINGS]: [baseId: string, buildingTypeId: string, sectionType: string, count: number, name?: string, description?: string, selectedItemId?: string | null, ratePerMinute?: number | null, linkedOutput?: BaseBuilding['linkedOutput'] | null, sourceProductionId?: string | null, allocationMode?: BaseBuilding['allocationMode'] | null, requestedRatePerMinute?: number | null, capacityPerMinute?: number | null, priority?: number | null, linkedInputRef?: LinkedInputReference | null];
        [appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT]: [baseId: string, buildingTypeId: string, sectionType: BuildingSectionType, targetCount: number];
        [appIds.events.BASES_REMOVE_BUILDING]: [buildingId: string];
        [appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION]: [baseId: string, buildingId: string, itemId: string | null, ratePerMinute: number | null];
        [appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT]: [baseId: string, buildingId: string, sourceBaseId: string, sourceOutputBuildingId: string];
        [appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK]: [baseId: string, buildingId: string, payload: UpdateOutputPlanLinkPayload];
        [appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED]: [baseId: string, section: BaseCardSectionKey];
        [appIds.events.BASES_SET_ENERGY_GROUP]: [baseId: string, groupId: string | null];
        [appIds.events.ENERGY_GROUP_CREATE]: [name: string, assignBaseId?: string];
        [appIds.events.ENERGY_GROUP_DELETE]: [groupId: string];
        [appIds.events.ENERGY_GROUP_RENAME]: [groupId: string, name: string];
        [appIds.events.PRODUCTION_PLAN_DELETE_SECTION]: [baseId: string, sectionId: string];
        [appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION]: [baseId: string, sectionId: string];
        [appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION]: [baseId: string, sectionId: string];
        [appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE]: [baseId: string, planId: string, mode: 'all' | 'missing'];
        [appIds.events.PRODUCTION_PLAN_MODAL_OPEN]: [editSectionId?: string | null];
        [appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]: [];
        [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME]: [name: string];
        [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM]: [itemId: string];
        [appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT]: [amount: number];
        [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL]: [level: CorporationLevelSelection | null];
        [appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION]: [itemId: string, recipeKey: string | null];
        [appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS]: [selections: Record<string, string>];
        [appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT]: [baseBuildingId: string];
        [appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT]: [sourceBaseId: string, sourceOutputBuildingId: string, targetBuildingTypeId?: string, name?: string, description?: string];
        [appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS]: [enabled: boolean];
        [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]: [];
    };
    effects: {
        [appIds.effects.setTheme]: 'light' | 'dark';
        [appIds.effects.loadGameData]: DataVersion;
    };
    subscriptions: {
        [id in CatalogValue<typeof appIds.subscriptions>]: UnmigratedSubscription;
    } & {
        [appIds.subscriptions.APP_DATA_VERSION]: { params: []; result: DataVersion };
        [appIds.subscriptions.APP_DATA_VERSIONS]: { params: []; result: AppState['appDataVersions'] };
        [appIds.subscriptions.UI_THEME]: { params: []; result: AppState['uiTheme'] };
        [appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING]: { params: []; result: boolean };
        [appIds.subscriptions.UI_ACTIVE_TAB]: { params: []; result: TabType };
        [appIds.subscriptions.UI_CONFIRMATION_DIALOG]: { params: []; result: AppState['uiConfirmationDialog'] };
    };
}
