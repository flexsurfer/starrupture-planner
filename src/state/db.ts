import { initAppDb } from '@flexsurfer/reflex';
import { buildItemsMap, buildLevelsMap, parseCorporations, extractCategories, type RawCorporationsData } from './data-utils';

// Import versioned data
import itemsDataEarlyAccess from '../data/ealryaccess/items_catalog.json';
import buildingsDataEarlyAccess from '../data/ealryaccess/buildings_and_recipes.json';
import corporationsDataEarlyAccess from '../data/ealryaccess/corporations_components.json';
import levelsDataEarlyAccess from '../data/ealryaccess/levels.json';

import itemsDataPlaytest from '../data/playtest/items_catalog.json';
import buildingsDataPlaytest from '../data/playtest/buildings_and_recipes.json';
import corporationsDataPlaytest from '../data/playtest/corporations_components.json';
import levelsDataPlaytest from '../data/playtest/levels.json';

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
        corporations: corporationsDataEarlyAccess,
        levels: levelsDataEarlyAccess,
    },
    playtest: {
        items: itemsDataPlaytest,
        buildings: buildingsDataPlaytest,
        corporations: corporationsDataPlaytest,
        levels: levelsDataPlaytest,
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
    power: number;
    recipes: Recipe[];
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
    components: CorporationComponent[];
    rewards: Reward[];
}

export interface Corporation {
    id: string;
    name: string;
    levels: CorporationLevel[];
}

export type TabType = 'items' | 'recipes' | 'corporations' | 'planner';

export interface Tab {
    id: TabType;
    label: string;
    icon: string;
}

interface AppState {
    dataVersion: DataVersion;
    dataVersions: { id: DataVersion; label: string }[];
    versionedData: Record<DataVersion, {
        items: Item[];
        buildings: Building[];
        corporations: RawCorporationsData;
        levels: Level[];
    }>;
    items: Item[];
    itemsMap: Record<string, Item>;
    selectedCategory: string;
    searchTerm: string;
    categories: string[];
    buildings: Building[];
    corporations: Corporation[];
    levels: Level[];
    levelsMap: Record<number, Level>;
    theme: 'light' | 'dark';
    activeTab: TabType;
    selectedPlannerItem: string | null;
}


// Initialize with default version data
const defaultData = versionedData[DEFAULT_DATA_VERSION];
const defaultItems = defaultData.items as Item[];
const defaultBuildings = defaultData.buildings as Building[];
const defaultLevels = defaultData.levels as Level[];
const defaultCorporations = parseCorporations(defaultData.corporations as RawCorporationsData);

const appStore: AppState = {
    //Data
    dataVersion: DEFAULT_DATA_VERSION,
    dataVersions: DATA_VERSIONS,
    versionedData: versionedData,
    items: defaultItems,
    itemsMap: buildItemsMap(defaultItems),
    buildings: defaultBuildings,
    corporations: defaultCorporations,
    levels: defaultLevels,
    levelsMap: buildLevelsMap(defaultLevels),

    //UI
    theme: 'dark',
    activeTab: 'items',
    selectedCategory: 'all',
    searchTerm: '',
    categories: extractCategories(defaultItems),
    selectedPlannerItem: null,
};

initAppDb(appStore);