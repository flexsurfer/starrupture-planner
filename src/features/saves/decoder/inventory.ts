import { isStorageQuantity, type SaveStorageConfiguration, type SaveStorageSpace } from '../snapshot';
import { field, members, structFields } from './fragments';
import type { SaveDecodeContext } from './types';

export function inventorySlots(fragments: string[], container: 'InputInventoryContainer' | 'MainInventoryContainer'): string[] | null {
    const prefix = '/Script/Chimera.CrInventoryFragment';
    const matches = fragments.filter(fragment => fragment.startsWith(`${prefix}(`));
    if (matches.length !== 1) return null;
    const inventory = field(matches[0].slice(prefix.length), container);
    const slots = inventory ? field(inventory, 'Items') : undefined;
    return slots === '' ? [] : slots ? members(slots) : null;
}

export function inventoryItemId(value: string | undefined, items: ReadonlyMap<string, string>): string | undefined {
    if (!value?.startsWith('"')) return;
    try {
        const asset: unknown = JSON.parse(value);
        return typeof asset === 'string' ? items.get(asset) : undefined;
    } catch { return; }
}

interface Stack { id: string; count: number }

/** Null is an empty slot. Undefined means an occupied slot could not be read. */
function readStack(raw: string | undefined, context: SaveDecodeContext): Stack | null | undefined {
    if (raw === undefined) return null;
    const item = structFields(raw);
    const rawCount = item?.get('Count') ?? '';
    const count = /^\d+$/.test(rawCount) ? Number(rawCount) : NaN;
    if (count === 0) return null;
    const id = inventoryItemId(item?.get('ItemDataBase'), context.mappings.items);
    return id && context.itemIds.has(id) && isStorageQuantity(count) ? { id, count } : undefined;
}

function addSlotSpace(space: SaveStorageSpace, fields: ReadonlyMap<string, string>, stack: Stack | null, context: SaveDecodeContext): boolean {
    const disabled = fields.get('bIsDisabled');
    if (disabled === 'True') return true;
    if (disabled !== undefined && disabled !== 'False') return false;

    const filter = fields.get('ItemTypeFilter');
    const options = filter ? members(filter) : [];
    if (!options) return false;
    const accepted = new Set<string>();
    for (const option of options) {
        const itemId = inventoryItemId(option, context.mappings.items);
        if (!itemId || !context.itemIds.has(itemId)) return false;
        accepted.add(itemId);
    }
    if (stack && accepted.size > 0 && !accepted.has(stack.id)) return false;
    if (!stack && accepted.size !== 1) {
        space.flexibleSlots++;
        if (accepted.size === 0) space.unrestrictedSlots++;
    }
    const count = stack?.count ?? 0;
    for (const id of stack ? [stack.id] : accepted) {
        const limit = context.mappings.stackSizes.get(id);
        if (limit === undefined || count > limit) return false;
        const free = (space.freeByItem[id] ?? 0) + (limit - count);
        if (free > 0xffffffff) return false;
        space.freeByItem[id] = free;
    }
    return true;
}

export function readStorageInventory(fragments: string[], context: SaveDecodeContext): SaveStorageConfiguration {
    const slots = inventorySlots(fragments, 'MainInventoryContainer');
    const totals = new Map<string, number>();
    let complete = slots !== null;
    let space: SaveStorageSpace | null = slots === null ? null : { freeByItem: Object.create(null), flexibleSlots: 0, unrestrictedSlots: 0 };
    for (const slot of slots ?? []) {
        const fields = structFields(slot);
        const stack = readStack(fields?.get('Item'), context);
        if (!fields || stack === undefined) {
            complete = false;
            space = null;
            continue;
        }
        if (space && !addSlotSpace(space, fields, stack, context)) space = null;
        if (!stack) continue;
        const { id, count } = stack;
        const total = (totals.get(id) ?? 0) + count;
        if (isStorageQuantity(total)) totals.set(id, total);
        else {
            complete = false;
            space = null;
        }
    }
    return { kind: 'storage', items: Object.fromEntries(totals), complete, space };
}
