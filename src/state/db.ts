import { initAppDb } from '@flexsurfer/reflex';
import type { RawCorporationsData } from './data-utils';
import type { DataVersion } from './gameDataVersion';
import { DATA_VERSIONS, DEFAULT_DATA_VERSION } from './gameDataVersion';

export type { DataVersion } from './gameDataVersion';
export { DATA_VERSIONS, DEFAULT_DATA_VERSION, isValidDataVersion } from './gameDataVersion';

export type AppVersionedGameData = {
    items: Item[];
    buildings: Building[];
    corporations: RawCorporationsData;
};

export interface Item {
    id: string;
    name: string;
    type: string;
}

export interface RecipeInput {
    id: string;
    amount_per_minute: number;
}

export interface RecipeOutput {
    id: string;
    amount_per_minute: number;
}

export interface Recipe {
    output: RecipeOutput;
    inputs: RecipeInput[];
}

export interface CoreLevel {
    level: number;
    heatCapacity: number;
}

export interface Building {
    id: string;
    name: string;
    upgrade?: string; // Optional id of upgraded building variant (for example v.2)
    type?: string;
    power?: number;
    heat?: number;
    coreHeatCapacity?: number; // Used by base core amplifiers to increase base heat capacity
    levels?: CoreLevel[]; // Used by base_core building to define heat capacity per level
    recipes?: Recipe[];
}

/** Indexed buildings collection keyed by building id. */
export type BuildingsByIdMap = Record<string, Building>;

export interface Level {
    level: number;
    cost: number;
}

export interface CorporationComponent {
    id: string;
    points: number;
    cost?: number | null;
}

export interface Reward {
    name: string;
}

export interface CorporationLevel {
    level: number;
    xp?: number;
    components: CorporationComponent[];
    rewards: Reward[];
}

export interface Corporation {
    id: string;
    name: string;
    description?: string;
    levels: CorporationLevel[];
}

export type TabType = 'items' | 'recipes' | 'corporations' | 'planner' | 'mybases';

export interface Tab {
    id: TabType;
    label: string;
    icon: string;
}

/** Selected corporation level in planner and production plan forms. */
export interface CorporationLevelSelection {
    corporationId: string;
    level: number;
}

// Base-related types
export interface BaseBuilding {
    id: string;
    buildingTypeId: string; // References Building.id from buildings data
    sectionType: string; // Section where this building was added (e.g., 'inputs', 'production', 'outputs')
    selectedItemId?: string; // Selected item for input buildings
    ratePerMinute?: number; // Rate per minute for the selected item
    name?: string; // Optional custom name for this building instance
    description?: string; // Optional custom description for this building instance
}

/** A single building requirement entry stored on a production plan. */
export interface PlanRequiredBuilding {
    buildingId: string;
    count: number;
}

export interface Production {
    id: string;
    name: string;
    selectedItemId: string;
    targetAmount: number;
    active?: boolean;
    corporationLevel?: CorporationLevelSelection | null;
    recipeSelections?: Record<string, string>; // output item id -> `${buildingId}:${recipeIndex}`
    inputs?: BaseBuilding[]; // Snapshot of BaseBuilding inputs (not linked to base)
    status?: 'active' | 'inactive' | 'error'; // Plan status: active when running, inactive when stopped, error when inputs insufficient
    requiredBuildings?: PlanRequiredBuilding[]; // Aggregated building requirements, populated on save
}

export interface EnergyGroup {
    id: string;
    name: string;
}

export interface Base {
    id: string;
    name: string;
    coreLevel?: number; // Base Core level (0-4), defaults to 0
    energyGroupId?: string; // References EnergyGroup.id for pooled energy grids
    buildings: BaseBuilding[];
    productions: Production[];
}

/** Indexed bases collection keyed by base id. */
export type BasesById = Record<string, Base>;

export interface ConfirmationDialog {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    confirmButtonClass?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export interface CreateProductionPlanModalState {
    isOpen: boolean;
    baseId: string | null;
    editSectionId: string | null;
    // Form state
    name: string;
    selectedItemId: string;
    targetAmount: number;
    selectedCorporationLevel: CorporationLevelSelection | null;
    selectedInputIds: string[];
    recipeSelections: Record<string, string>; // output item id -> `${buildingId}:${recipeIndex}`
    matchInputs: boolean;
}

export interface AppState {
    appDataVersion: DataVersion;
    appDataVersions: { id: DataVersion; label: string }[];
    /** Populated as versions are fetched from `/game-data/{version}/`. */
    appVersionedData: Partial<Record<DataVersion, AppVersionedGameData>>;
    itemsList: Item[];
    itemsById: Record<string, Item>;
    itemsSelectedCategory: string;
    itemsSelectedBuilding: string;
    itemsSearchTerm: string;
    itemsCategories: string[];
    buildingsList: Building[];
    corporationsList: Corporation[];
    uiTheme: 'light' | 'dark';
    /** True while a user-requested game-data fetch is in flight (not used for `APP_INIT` load). */
    uiGameDataLoadPending: boolean;
    uiActiveTab: TabType;
    plannerSelectedItemId: string | null;
    plannerSelectedCorporationLevel: CorporationLevelSelection | null;
    plannerRecipeSelections: Record<string, string>; // output item id -> `${buildingId}:${recipeIndex}`
    plannerTargetAmount: number;
    basesList: Base[];
    energyGroups: EnergyGroup[];
    basesSelectedBaseId: string | null;
    uiConfirmationDialog: ConfirmationDialog;
    productionPlanModalState: CreateProductionPlanModalState;
}

/** Before `/game-data/{version}/` JSON loads; `APP_INIT` sets `appDataVersion` from coeffects. */
const appState: AppState = {
    appDataVersion: DEFAULT_DATA_VERSION,
    appDataVersions: DATA_VERSIONS,
    appVersionedData: {},
    itemsList: [],
    itemsById: {},
    itemsCategories: [],
    buildingsList: [],
    corporationsList: [],
    basesList: [],
    energyGroups: [],

    //UI
    uiTheme: 'dark',
    uiGameDataLoadPending: false,
    uiActiveTab: 'items',
    itemsSelectedCategory: 'all',
    itemsSelectedBuilding: 'all',
    itemsSearchTerm: '',
    plannerSelectedItemId: null,
    plannerSelectedCorporationLevel: null,
    plannerRecipeSelections: {},
    plannerTargetAmount: 60,
    basesSelectedBaseId: null,
    uiConfirmationDialog: {
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        confirmButtonClass: 'btn-primary',
        onConfirm: () => {},
        onCancel: undefined,
    },
    productionPlanModalState: {
        isOpen: false,
        baseId: null,
        editSectionId: null,
        name: '',
        selectedItemId: '',
        targetAmount: 60,
        selectedCorporationLevel: null,
        selectedInputIds: [],
        recipeSelections: {},
        matchInputs: false,
    },
};

initAppDb(appState);
