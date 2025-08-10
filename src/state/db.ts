import { initAppDb } from '@flexsurfer/reflex';
import itemsData from '../data/items_catalog.json';
import buildingsData from '../data/buildings_and_recipes.json';
import corporationsData from '../data/corporations_components.json';
import levelsData from '../data/levels.json';

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

const appStore: AppState = {
    //Data
    items: itemsData as Item[],
    itemsMap: itemsData.reduce((acc, item) => {acc[item.id] = item; return acc;}, {} as Record<string, Item>), // Create a lookup map for items by ID for efficient access
    buildings: buildingsData as Building[],
    corporations: Object.entries(corporationsData as Record<string, { id: string; levels: { level: number; components: CorporationComponent[]; rewards: Reward[] }[] }>)
        .map(([name, data]) => ({ 
            id: data.id,
            name, 
            levels: data.levels.map(level => ({
                level: level.level,
                components: level.components.map(component => ({
                    id: component.id,
                    points: component.points,
                    cost: component.cost
                })),
                rewards: level.rewards
            }))
        })) as Corporation[],
    levels: levelsData as Level[],
    levelsMap: levelsData.reduce((acc, level) => {acc[level.level] = level; return acc;}, {} as Record<number, Level>),

    //UI
    theme: 'dark',
    activeTab: 'items',
    selectedCategory: 'all',
    searchTerm: '',
    categories: ['all', ...Array.from(new Set((itemsData as Item[]).map(item => item.type)))],
    selectedPlannerItem: null,
};

initAppDb(appStore);