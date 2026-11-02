import { field, members } from './fragments';
import { inventoryItemId, inventorySlots } from './inventory';

/** The configured input filter identifies the item even when inventory is empty. */
export function readLauncherItem(fragments: string[], items: ReadonlyMap<string, string>): string | null {
    const entries = inventorySlots(fragments, 'InputInventoryContainer');
    if (!entries) return null;
    const selected = new Set<string>();
    for (const slot of entries) {
        // Disabled inventory slots have no active filter; this is not the building's running state.
        if (field(slot, 'bIsDisabled') === 'True') continue;
        const filter = field(slot, 'ItemTypeFilter');
        if (filter === undefined) continue;
        const values = members(filter);
        if (!values) return null;
        for (const value of values) {
            const id = inventoryItemId(value, items);
            if (!id) return null;
            selected.add(id);
        }
    }
    return selected.size === 1 ? [...selected][0] : null;
}
