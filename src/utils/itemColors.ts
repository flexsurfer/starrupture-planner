import type { Item } from '@/app/uklad/model';

/** Shared item-category palette, matching the production diagram. */
const itemCategoryColors = {
    raw: '#3b82f6',
    processed: '#8b5cf6',
    component: '#06d6a0',
    ammo: '#f59e0b',
    final: '#10b981',
    material: '#6b7280',
} as const;

export function getItemCategoryColor(type?: string): string {
    return itemCategoryColors[type as keyof typeof itemCategoryColors] ?? '#6b7280';
}

/** Tinted category badges and highlighted recipe ingredients. */
export function getItemCategoryStyle(type?: string) {
    const color = getItemCategoryColor(type);
    return {
        color,
        backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
    };
}

export function getItemColor(itemId: string, items: readonly Item[]): string {
    const item = items.find((candidate) => candidate.id === itemId);
    return getItemCategoryColor(item?.type);
}
