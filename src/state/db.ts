import { initAppDb } from '@flexsurfer/reflex';
import { buildItemsMap, parseCorporations, extractCategories, type RawCorporationsData } from './data-utils';

// Import versioned data
import itemsDataEarlyAccess from '../data/earlyaccess/items_catalog.json';
import buildingsDataEarlyAccess from '../data/earlyaccess/buildings_and_recipes.json';
import corporationsDataEarlyAccess from '../data/earlyaccess/corporations_components.json';

import itemsDataPlaytest from '../data/playtest/items_catalog.json';
import buildingsDataPlaytest from '../data/playtest/buildings_and_recipes.json';
import corporationsDataPlaytest from '../data/playtest/corporations_components.json';

// Data version types and constants
export type DataVersion = 'earlyaccess' | 'playtest';

const DATA_VERSIONS: { id: DataVersion; label: string }[] = [
    { id: 'earlyaccess', label: 'Early Access' },
    { id: 'playtest', label: 'Playtest' },
];

const DEFAULT_DATA_VERSION: DataVersion = 'earlyaccess';

// Versioned data maps
const versionedData = {
    earlyaccess: {
        items: itemsDataEarlyAccess,
        buildings: buildingsDataEarlyAccess,
        corporations: corporationsDataEarlyAccess
    },
    playtest: {
        items: itemsDataPlaytest,
        buildings: buildingsDataPlaytest,
        corporations: corporationsDataPlaytest
    },
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

export interface Building {
    id: string;
    name: string;
    type?: string;
    power?: number;
    heat?: number;
    coreHeatCapacity?: number; // Used by base core amplifiers to increase base heat capacity
    recipes?: Recipe[];
}

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

// Base-related types
export interface BaseBuilding {
    id: string;
    baseId: string;
    buildingTypeId: string; // References Building.id from buildings data
    sectionType: string; // Section where this building was added (e.g., 'inputs', 'production', 'outputs')
    selectedItemId?: string; // Selected item for input buildings
    ratePerMinute?: number; // Rate per minute for the selected item
}

export interface BasePlanBuilding {
    buildingTypeId: string; // References Building.id from buildings data
    selectedItemId: string; // Selected item for input buildings
    ratePerMinute: number; // Rate per minute for the selected item
}

/** A single building requirement entry stored on a production plan. */
export interface PlanRequiredBuilding {
    buildingId: string;
    buildingName: string;
    count: number;
}

export interface Production {
    id: string;
    name: string;
    selectedItemId: string;
    targetAmount: number;
    active?: boolean;
    corporationLevel?: { corporationId: string; level: number } | null;
    inputs?: BaseBuilding[]; // Snapshot of BaseBuilding inputs (not linked to base)
    status?: 'active' | 'inactive' | 'error'; // Plan status: active when running, inactive when stopped, error when inputs insufficient
    requiredBuildings?: PlanRequiredBuilding[]; // Aggregated building requirements, populated on save
}

export interface Base {
    id: string;
    name: string;
    buildings: BaseBuilding[];
    productions: Production[];
}

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
    selectedCorporationLevel: { corporationId: string; level: number } | null;
    selectedInputIds: string[];
}

export interface AppState {
    appDataVersion: DataVersion;
    appDataVersions: { id: DataVersion; label: string }[];
    appVersionedData: Record<DataVersion, {
        items: Item[];
        buildings: Building[];
        corporations: RawCorporationsData;
    }>;
    itemsList: Item[];
    itemsById: Record<string, Item>;
    itemsSelectedCategory: string;
    itemsSelectedBuilding: string;
    itemsSearchTerm: string;
    itemsCategories: string[];
    buildingsList: Building[];
    corporationsList: Corporation[];
    uiTheme: 'light' | 'dark';
    uiActiveTab: TabType;
    plannerSelectedItemId: string | null;
    plannerSelectedCorporationLevel: { corporationId: string; level: number } | null;
    plannerTargetAmount: number;
    basesList: Base[];
    basesSelectedBaseId: string | null;
    uiConfirmationDialog: ConfirmationDialog;
    productionPlanModalState: CreateProductionPlanModalState;
}


// Initialize with default version data
const defaultData = versionedData[DEFAULT_DATA_VERSION];
const defaultItems = defaultData.items as Item[];
const defaultBuildings = defaultData.buildings as Building[];
const defaultCorporations = parseCorporations(defaultData.corporations as RawCorporationsData);

const appState: AppState = {
    //Data
    appDataVersion: DEFAULT_DATA_VERSION,
    appDataVersions: DATA_VERSIONS,
    appVersionedData: versionedData,
    itemsList: defaultItems,
    itemsById: buildItemsMap(defaultItems),
    itemsCategories: extractCategories(defaultItems),
    buildingsList: defaultBuildings,
    corporationsList: defaultCorporations,
    basesList: [],

    //UI
    uiTheme: 'dark',
    uiActiveTab: 'items',
    itemsSelectedCategory: 'all',
    itemsSelectedBuilding: 'all',
    itemsSearchTerm: '',
    plannerSelectedItemId: null,
    plannerSelectedCorporationLevel: null,
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
    },
};

initAppDb(appState);
