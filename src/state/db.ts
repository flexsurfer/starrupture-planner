import { initAppDb } from '@flexsurfer/reflex';
import itemsData from '../data/items_catalog.json';
import buildingsData from '../data/buildings_and_recipes.json';

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
    recipes: Recipe[];
}

export type TabType = 'items' | 'buildings' | 'recipes' | 'planner';

export interface Tab {
    id: TabType;
    label: string;
    icon: string;
}

interface AppState {
    items: Item[];
    itemsMap: Record<string, Item>;
    selectedCategory: string;
    categories: string[];
    buildings: Building[];
    theme: 'light' | 'dark';
    activeTab: TabType;
}

const appStore: AppState = {
    //Data
    items: itemsData as Item[],
    itemsMap: itemsData.reduce((acc, item) => {acc[item.id] = item; return acc;}, {} as Record<string, Item>), // Create a lookup map for items by ID for efficient access
    buildings: buildingsData as Building[],

    //UI
    theme: 'dark',
    activeTab: 'items',
    selectedCategory: 'all',
    categories: ['all', ...Array.from(new Set((itemsData as Item[]).map(item => item.type)))],
};

initAppDb(appStore);