import type { SaveGameData } from './game-data';
import type { SaveCoreReference, SaveOverview } from './overview';
import type { SaveStorageConfiguration, SaveStorageSpace } from './snapshot';

interface ItemAvailability {
    buildingCount: number;
    buildingsWithRoom: number;
    capacity: number | null;
    full: boolean;
}

export interface SaveStorageGroup {
    id: string;
    cores: SaveCoreReference[];
    buildingCount: number;
    total: number;
    complete: boolean;
    space: { status: 'available' | 'full' | 'unusable'; flexibleSlots: number } | null;
    items: { id: string; name: string; quantity: number; availability: ItemAvailability | null }[];
}

type StorageWithSpace = SaveStorageConfiguration & { space: SaveStorageSpace };
interface StorageGroupSource {
    cores: SaveCoreReference[];
    stores: SaveStorageConfiguration[];
}

function itemAvailability(id: string, quantity: number, stores: StorageWithSpace[], stackSize: number | undefined): ItemAvailability {
    let buildingCount = 0, buildingsWithRoom = 0, assignedFree = 0, unrestrictedSlots = 0;
    let hasUsableSlots = false;
    for (const { items, space } of stores) {
        const assigned = Object.hasOwn(space.freeByItem, id);
        if (!assigned && !space.unrestrictedSlots && !Object.hasOwn(items, id)) continue;
        buildingCount++;
        const free = assigned ? space.freeByItem[id] : 0;
        if (free > 0 || space.unrestrictedSlots > 0) buildingsWithRoom++;
        if (assigned || space.unrestrictedSlots > 0) hasUsableSlots = true;
        assignedFree += free;
        unrestrictedSlots += space.unrestrictedSlots;
    }
    const capacity = !hasUsableSlots || (unrestrictedSlots > 0 && stackSize === undefined) ? null
        : quantity + assignedFree + unrestrictedSlots * (stackSize ?? 0);
    return { buildingCount, buildingsWithRoom, capacity: Number.isSafeInteger(capacity) ? capacity : null,
        full: hasUsableSlots && buildingsWithRoom === 0 };
}

function summarizeGroup(id: string, { cores, stores }: StorageGroupSource, data: SaveGameData, stackSizes?: Record<string, number>): SaveStorageGroup {
    const quantities = new Map<string, number>();
    for (const config of stores) {
        for (const [itemId, quantity] of Object.entries(config.items)) {
            quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
        }
    }

    const known = stores.filter((config): config is StorageWithSpace => config.space !== null);
    const itemIds = new Set(quantities.keys());
    let flexibleSlots = 0, hasAssignedSlots = false, hasRoom = false;
    for (const { space } of known) {
        for (const [itemId, free] of Object.entries(space.freeByItem)) {
            itemIds.add(itemId);
            hasAssignedSlots = true;
            if (free > 0) hasRoom = true;
        }
        flexibleSlots += space.flexibleSlots;
    }
    const groupSpace: SaveStorageGroup['space'] = known.length === stores.length ? {
        status: hasRoom || flexibleSlots > 0 ? 'available' : hasAssignedSlots ? 'full' : 'unusable', flexibleSlots,
    } : null;
    const items = [...itemIds].map(itemId => {
        const quantity = quantities.get(itemId) ?? 0;
        return { id: itemId, name: data.items.get(itemId)?.name ?? itemId, quantity,
            availability: groupSpace ? itemAvailability(itemId, quantity, known, stackSizes?.[itemId]) : null };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    return { id, cores, buildingCount: stores.length, total: items.reduce((sum, item) => sum + item.quantity, 0),
        complete: stores.every(store => store.complete), space: groupSpace, items };
}

/** Group physical buildings once. Null means the imported snapshot predates inventory capture. */
export function groupStorageInventory(overview: SaveOverview, data: SaveGameData): SaveStorageGroup[] | null {
    const groups = new Map<string, StorageGroupSource>();
    for (const { building, instance, cores } of overview.buildingDetails) {
        const config = instance.configuration;
        if (config.kind === 'other' && building.type === 'storage') return null;
        if (config.kind !== 'storage') continue;
        const key = cores.map(core => core.id).join(',');
        let group = groups.get(key);
        if (!group) {
            group = { cores, stores: [] };
            groups.set(key, group);
        }
        group.stores.push(config);
    }
    const stackSizes = data.metadata?.revision === overview.workspace.snapshot.gameData.revision ? data.metadata.stackSizes : undefined;
    return [...groups].map(([id, group]) => summarizeGroup(id, group, data, stackSizes))
        .sort((a, b) => (a.cores[0]?.number ?? Infinity) - (b.cores[0]?.number ?? Infinity)
            || a.cores.length - b.cores.length || a.id.localeCompare(b.id));
}
