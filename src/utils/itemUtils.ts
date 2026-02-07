export interface ItemNameSource {
    id: string;
    name: string;
}

export function getItemName(itemId: string, items: ItemNameSource[]): string {
    return items.find(item => item.id === itemId)?.name || itemId;
}
