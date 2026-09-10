import type { Item } from './types';

const itemColors = {
    raw: '#3b82f6',
    processed: '#8b5cf6',
    component: '#06d6a0',
    ammo: '#f59e0b',
    final: '#10b981',
} as const;

export function getItemColor(itemId: string, items: Item[]): string {
    const item = items.find((candidate) => candidate.id === itemId);
    return item ? (itemColors[item.type as keyof typeof itemColors] || '#6b7280') : '#6b7280';
}
