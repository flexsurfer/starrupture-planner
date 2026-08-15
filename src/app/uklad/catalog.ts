/**
 * The one application-wide vocabulary for Uklad state and handler IDs.
 *
 * Feature modules import these values; no feature owns a second ids file.
 */
export const stateKeys = {
    appDataVersion: 'appDataVersion',
    appDataVersions: 'appDataVersions',
    appVersionedData: 'appVersionedData',
    itemsList: 'itemsList',
    itemsById: 'itemsById',
    itemsSelectedCategory: 'itemsSelectedCategory',
    itemsSelectedBuilding: 'itemsSelectedBuilding',
    itemsSearchTerm: 'itemsSearchTerm',
    itemsCategories: 'itemsCategories',
    buildingsList: 'buildingsList',
    corporationsList: 'corporationsList',
    uiTheme: 'uiTheme',
    uiGameDataLoadPending: 'uiGameDataLoadPending',
    uiActiveTab: 'uiActiveTab',
    uiConfirmationDialog: 'uiConfirmationDialog',
    plannerSelectedItemId: 'plannerSelectedItemId',
    plannerSelectedCorporationLevel: 'plannerSelectedCorporationLevel',
    plannerRecipeSelections: 'plannerRecipeSelections',
    pinnedRecipeSelections: 'pinnedRecipeSelections',
    recipeAlternativePresets: 'recipeAlternativePresets',
    plannerTargetAmount: 'plannerTargetAmount',
    basesList: 'basesList',
    energyGroups: 'energyGroups',
    basesCardCollapsedSections: 'basesCardCollapsedSections',
    basesSelectedBaseId: 'basesSelectedBaseId',
    basesSelectedDetailTab: 'basesSelectedDetailTab',
    productionPlanModalState: 'productionPlanModalState',
} as const;

export const appIds = {
    events: {
        APP_INIT: 'app/init', APP_REQUEST_LOAD_GAME_DATA: 'app/request-load-game-data', APP_GAME_DATA_LOAD_FAILED: 'app/game-data-load-failed', APP_SET_DATA_VERSION: 'app/set-data-version',
        UI_SET_THEME: 'ui/set-theme', UI_SET_ACTIVE_TAB: 'ui/set-active-tab', UI_SHOW_CONFIRMATION_DIALOG: 'ui/show-confirmation-dialog', UI_CLOSE_CONFIRMATION_DIALOG: 'ui/close-confirmation-dialog',
        ITEMS_SET_SELECTED_CATEGORY: 'items/set-selected-category', ITEMS_SET_SELECTED_BUILDING: 'items/set-selected-building', ITEMS_SET_SEARCH_TERM: 'items/set-search-term',
        PLANNER_OPEN_ITEM: 'planner/open-item', PLANNER_SET_SELECTED_ITEM: 'planner/set-selected-item', PLANNER_SET_SELECTED_CORPORATION_LEVEL: 'planner/set-selected-corporation-level', PLANNER_SET_RECIPE_SELECTION: 'planner/set-recipe-selection', PLANNER_SET_RECIPE_SELECTIONS: 'planner/set-recipe-selections', PLANNER_SET_TARGET_AMOUNT: 'planner/set-target-amount',
        RECIPE_ALTERNATIVES_SET_DEFAULTS: 'recipe-alternatives/set-defaults', RECIPE_ALTERNATIVES_SAVE_PRESET: 'recipe-alternatives/save-preset', RECIPE_ALTERNATIVES_DELETE_PRESET: 'recipe-alternatives/delete-preset',
        BASES_CREATE_BASE: 'bases/create-base', BASES_UPDATE_BASE_NAME: 'bases/update-base-name', BASES_DELETE_BASE: 'bases/delete-base', BASES_OPEN_BASE: 'bases/open-base', BASES_SET_SELECTED_BASE: 'bases/set-selected-base', BASES_SET_DETAIL_TAB: 'bases/set-detail-tab', BASES_SET_CORE_LEVEL: 'bases/set-core-level', BASES_ADD_BUILDING: 'bases/add-building', BASES_ADD_BUILDINGS: 'bases/add-buildings', BASES_SET_BUILDING_SECTION_TYPE_COUNT: 'bases/set-building-section-type-count', BASES_REMOVE_BUILDING: 'bases/remove-building', BASES_UPDATE_BUILDING_ITEM_SELECTION: 'bases/update-building-item-selection', BASES_UPDATE_BUILDING_LINKED_OUTPUT: 'bases/update-building-linked-output', BASES_UPDATE_OUTPUT_PLAN_LINK: 'bases/update-output-plan-link', BASES_TOGGLE_CARD_SECTION_COLLAPSED: 'bases/toggle-card-section-collapsed', BASES_SET_ENERGY_GROUP: 'bases/set-energy-group',
        ENERGY_GROUP_CREATE: 'energy-groups/create', ENERGY_GROUP_DELETE: 'energy-groups/delete', ENERGY_GROUP_RENAME: 'energy-groups/rename',
        PRODUCTION_PLAN_DELETE_SECTION: 'production-plans/delete-section', PRODUCTION_PLAN_ACTIVATE_SECTION: 'production-plans/activate-section', PRODUCTION_PLAN_DEACTIVATE_SECTION: 'production-plans/deactivate-section', PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE: 'production-plans/add-buildings-to-base',
        PRODUCTION_PLAN_MODAL_OPEN: 'production-plan-modal/open', PRODUCTION_PLAN_MODAL_CLOSE: 'production-plan-modal/close', PRODUCTION_PLAN_MODAL_SET_NAME: 'production-plan-modal/set-name', PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM: 'production-plan-modal/set-selected-item', PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT: 'production-plan-modal/set-target-amount', PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL: 'production-plan-modal/set-selected-corporation-level', PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION: 'production-plan-modal/set-recipe-selection', PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS: 'production-plan-modal/set-recipe-selections', PRODUCTION_PLAN_MODAL_TOGGLE_INPUT: 'production-plan-modal/toggle-input', PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT: 'production-plan-modal/link-output-input', PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS: 'production-plan-modal/set-match-inputs', PRODUCTION_PLAN_MODAL_SUBMIT: 'production-plan-modal/submit',
    },
    subscriptions: {
        APP_DATA_VERSION: 'app/data-version', APP_DATA_VERSIONS: 'app/data-versions', UI_THEME: 'ui/theme', UI_GAME_DATA_LOAD_PENDING: 'ui/game-data-load-pending', UI_ACTIVE_TAB: 'ui/active-tab', UI_CONFIRMATION_DIALOG: 'ui/confirmation-dialog',
        BUILDINGS_LIST: 'buildings/list', BUILDINGS_BY_ID_MAP: 'buildings/by-id-map', BUILDINGS_SORTED_PRODUCTION_LIST: 'buildings/sorted-production-list', CORPORATIONS_LIST: 'corporations/list', CORPORATIONS_STATS_SUMMARY: 'corporations/stats-summary', CORPORATIONS_LIST_WITH_STATS: 'corporations/list-with-stats',
        ITEMS_LIST: 'items/list', ITEMS_BY_ID_MAP: 'items/by-id-map', ITEMS_FILTERED_LIST: 'items/filtered-list', ITEMS_SELECTED_CATEGORY: 'items/selected-category', ITEMS_SELECTED_BUILDING: 'items/selected-building', ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID: 'items/available-items-by-building-id', ITEMS_AVAILABLE_PRODUCTION_BUILDINGS: 'items/available-production-buildings', ITEMS_SEARCH_TERM: 'items/search-term', ITEMS_CATEGORIES: 'items/categories', ITEMS_TABLE_ROWS: 'items/table-rows', ITEMS_HELPER_LOOKUPS: 'items/helper-lookups', ITEMS_RECIPES_BY_INPUT_ITEM_ID: 'items/recipes-by-input-item-id',
        PLANNER_SELECTED_ITEM_ID: 'planner/selected-item-id', PLANNER_SELECTED_CORPORATION_LEVEL: 'planner/selected-corporation-level', PLANNER_RECIPE_SELECTIONS: 'planner/recipe-selections', PINNED_RECIPE_SELECTIONS: 'recipe-alternatives/default-selections', RECIPE_ALTERNATIVE_PRESETS: 'recipe-alternatives/presets', PLANNER_RECIPE_OPTIONS: 'planner/recipe-options', PLANNER_AVAILABLE_CORPORATION_LEVELS: 'planner/available-corporation-levels', PLANNER_TARGET_AMOUNT: 'planner/target-amount', PLANNER_PRODUCTION_FLOW: 'planner/production-flow', PLANNER_FLOW_GRAPH: 'planner/flow-graph', PLANNER_STATS_SUMMARY: 'planner/stats-summary', PLANNER_STATS_DETAILED: 'planner/stats-detailed', PLANNER_SELECTABLE_ITEMS: 'planner/selectable-items',
        BASES_LIST: 'bases/list', BASES_CARD_COLLAPSED_SECTIONS: 'bases/card-collapsed-sections', BASES_CARD_COLLAPSED_SECTIONS_BY_BASE_ID: 'bases/card-collapsed-sections-by-base-id', BASES_BY_ID_MAP: 'bases/by-id-map', BASES_BASE_BY_ID: 'bases/base-by-id', BASES_SELECTED_BASE_ID: 'bases/selected-base-id', BASES_SELECTED_DETAIL_TAB: 'bases/selected-detail-tab', BASES_SELECTED_BASE: 'bases/selected-base', BASES_SELECTED_BASE_DETAIL_STATS: 'bases/selected-base-detail-stats', BASES_DETAIL_STATS_BY_BASE_ID: 'bases/detail-stats-by-base-id', BASES_INPUT_ITEMS_BY_BASE_ID: 'bases/input-items-by-base-id', BASES_OUTPUT_ITEMS_BY_BASE_ID: 'bases/output-items-by-base-id', BASES_DEFENSE_BUILDINGS_BY_BASE_ID: 'bases/defense-buildings-by-base-id', BASES_BUILDING_SECTION_STATS: 'bases/building-section-stats', BASES_BUILDING_SECTION_BUILDINGS: 'bases/building-section-buildings', BASES_AVAILABLE_BUILDINGS_FOR_SECTION: 'bases/available-buildings-for-section', BASES_CORE_LEVELS: 'bases/core-levels', BASES_STATS_SUMMARY: 'bases/stats-summary', BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID: 'bases/logistics-view-model-by-base-id', BASES_LOGISTICS_VIEW_MODELS: 'bases/logistics-view-models', BASES_ALL_DETAIL_STATS: 'bases/all-detail-stats',
        ENERGY_GROUPS_LIST: 'energy-groups/list', ENERGY_GROUPS_BY_ID_MAP: 'energy-groups/by-id-map',
        PRODUCTION_PLAN_SECTION_FLOW_BY_ID: 'production-plans/section-flow-by-id', PRODUCTION_PLAN_SECTION_STATS_BY_ID: 'production-plans/section-stats-by-id', PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID: 'production-plans/section-view-model-by-id', PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID: 'production-plans/section-item-name-by-item-id', PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID: 'production-plans/section-requirements-status-by-id', PRODUCTION_PLAN_SECTION_IDS: 'production-plans/section-ids', PRODUCTION_PLAN_SECTION_ENTITY_BY_ID: 'production-plans/section-entity-by-id',
        PRODUCTION_PLAN_MODAL_FLOW: 'production-plan-modal/flow', PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS: 'production-plan-modal/recipe-options', PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS: 'production-plan-modal/available-corporation-levels', PRODUCTION_PLAN_MODAL_STATE: 'production-plan-modal/state', PRODUCTION_PLAN_MODAL_OPEN_STATE: 'production-plan-modal/open-state', PRODUCTION_PLAN_MODAL_HEADER_DATA: 'production-plan-modal/header-data', PRODUCTION_PLAN_MODAL_FORM_VALUES: 'production-plan-modal/form-values', PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA: 'production-plan-modal/input-selector-data', PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS: 'production-plan-modal/linkable-outputs', PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID: 'production-plan-modal/selected-item-id', PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS: 'production-plan-modal/raw-material-deficits', PRODUCTION_PLAN_MODAL_FORM_VALIDITY: 'production-plan-modal/form-validity',
        BASES_OVERVIEW_PLAN_ROWS: 'bases/overview-plan-rows', BASES_OVERVIEW_MATERIAL_BALANCE_ROWS: 'bases/overview-material-balance-rows', BASES_OVERVIEW_BUILDING_COVERAGE_ROWS: 'bases/overview-building-coverage-rows',
    },
    effects: { setTheme: 'ui/set-theme-in-dom', loadGameData: 'app/load-game-data' },
} as const;
