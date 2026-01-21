import type { Item, Corporation, CorporationComponent, Reward } from './db';

export interface RawCorporationData {
    id: string;
    levels: {
        level: number;
        xp?: number;
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

// Helper to parse corporations data
export function parseCorporations(corporationsData: RawCorporationsData): Corporation[] {
    return Object.entries(corporationsData)
        .map(([name, data]) => ({
            id: data.id,
            name,
            levels: data.levels.map(level => ({
                level: level.level,
                xp: level.xp ?? 0,
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