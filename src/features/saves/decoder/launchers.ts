import { field, members } from './fragments';

/** The configured input filter identifies the item even when inventory is empty. */
export function readLauncherItem(fragments: string[], items: ReadonlyMap<string, string>): string | null {
    const prefix = '/Script/Chimera.CrInventoryFragment';
    const fragmentsFound = fragments.filter(value => value.startsWith(`${prefix}(`));
    if (fragmentsFound.length !== 1) return null;
    const input = field(fragmentsFound[0].slice(prefix.length), 'InputInventoryContainer');
    const slots = input && field(input, 'Items');
    const entries = slots ? members(slots) : null;
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
            try {
                const asset: unknown = JSON.parse(value);
                if (typeof asset !== 'string' || !items.has(asset)) return null;
                selected.add(items.get(asset)!);
            } catch { return null; }
        }
    }
    return selected.size === 1 ? [...selected][0] : null;
}
