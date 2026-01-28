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
    power: number;
    heat?: number;
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
export interface Core {
    id: string;
    baseId: string;
    // Core defines buildable area - can be extended with position/size data later
}

export interface BaseBuilding {
    id: string;
    baseId: string;
    buildingTypeId: string; // References Building.id from buildings data
    sectionType: string; // Section where this building was added (e.g., 'inputs', 'production', 'outputs')
    selectedItemId?: string; // Selected item for input buildings
    ratePerMinute?: number; // Rate per minute for the selected item
}

export interface ProductionPlanSection {
    id: string;
    name: string;
    selectedItemId: string;
    targetAmount: number;
    active?: boolean;
    corporationLevel?: { corporationId: string; level: number } | null;
}

export interface Base {
    id: string;
    name: string;
    core: Core;
    buildings: BaseBuilding[];
    productionPlanSections: ProductionPlanSection[];
    createdAt: number;
    updatedAt: number;
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

export interface ActivatePlanDialog {
    isOpen?: boolean;
    planName?: string;
    baseId?: string;
    sectionId?: string;
    allRequirementsSatisfied?: boolean;
}

export interface AppState {
    dataVersion: DataVersion;
    dataVersions: { id: DataVersion; label: string }[];
    versionedData: Record<DataVersion, {
        items: Item[];
        buildings: Building[];
        corporations: RawCorporationsData;
    }>;
    items: Item[];
    itemsMap: Record<string, Item>;
    selectedCategory: string;
    selectedBuilding: string;
    searchTerm: string;
    categories: string[];
    buildings: Building[];
    corporations: Corporation[];
    theme: 'light' | 'dark';
    activeTab: TabType;
    selectedPlannerItem: string | null;
    selectedPlannerCorporationLevel: { corporationId: string; level: number } | null;
    targetAmount: number;
    bases: Base[];
    selectedBaseId: string | null;
    baseDetailActiveTab: 'plans' | 'buildings';
    confirmationDialog: ConfirmationDialog;
    activatePlanDialog: ActivatePlanDialog;
}


// Initialize with default version data
const defaultData = versionedData[DEFAULT_DATA_VERSION];
const defaultItems = defaultData.items as Item[];
const defaultBuildings = defaultData.buildings as Building[];
const defaultCorporations = parseCorporations(defaultData.corporations as RawCorporationsData);

const appStore: AppState = {
    //Data
    dataVersion: DEFAULT_DATA_VERSION,
    dataVersions: DATA_VERSIONS,
    versionedData: versionedData,
    items: defaultItems,
    itemsMap: buildItemsMap(defaultItems),
    categories: extractCategories(defaultItems),
    buildings: defaultBuildings,
    corporations: defaultCorporations,
    bases: [],

    //UI
    theme: 'dark',
    activeTab: 'items',
    selectedCategory: 'all',
    selectedBuilding: 'all',
    searchTerm: '',
    selectedPlannerItem: null,
    selectedPlannerCorporationLevel: null,
    targetAmount: 60,
    selectedBaseId: null,
    baseDetailActiveTab: 'plans',
    confirmationDialog: {
        isOpen: false,
        title: '',
        message: '',
        confirmLabel: 'Confirm',
        cancelLabel: 'Cancel',
        confirmButtonClass: 'btn-primary',
        onConfirm: () => {},
        onCancel: undefined,
    },
    activatePlanDialog: {
        isOpen: false,
        planName: '',
        baseId: undefined,
        sectionId: undefined,
    },
};

initAppDb(appStore);
