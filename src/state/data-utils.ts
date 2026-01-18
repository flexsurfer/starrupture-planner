import type { Item, Level, Corporation, CorporationComponent, Reward } from './db';

export interface RawCorporationData {
    id: string;
    levels: {
        level: number;
        components: CorporationComponent[];
        rewards: Reward[];
    }[];
}

export interface RawCorporationsData {
    [name: string]: RawCorporationData;
}

// Helper to build items map
export function buildItemsMap(items: Item[]): Record<string, Item> {
    return items.reduce((acc, item) => { acc[item.id] = item; return acc; }, {} as Record<string, Item>);
}

// Helper to build levels map
export function buildLevelsMap(levels: Level[]): Record<number, Level> {
    return levels.reduce((acc, level) => { acc[level.level] = level; return acc; }, {} as Record<number, Level>);
}

// Helper to parse corporations data
export function parseCorporations(corporationsData: RawCorporationsData): Corporation[] {
    return Object.entries(corporationsData)
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
        }));
}

// Helper to extract categories from items
export function extractCategories(items: Item[]): string[] {
    return ['all', ...Array.from(new Set(items.map(item => item.type)))];
}