// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './decoder/analyze';
import { extractionContext, saveFixture, saveLookups } from './decoder/test-fixture';
import { buildSaveOverview } from './overview';
import type { SaveStorageConfiguration } from './snapshot';
import { groupStorageInventory } from './storage-inventory';
import { createSaveWorkspace } from './workspace';

function inventory(...stores: SaveStorageConfiguration[]) {
    const snapshot = analyzeSave(saveFixture(), extractionContext);
    const core = snapshot.cores[0];
    core.buildings = stores.map((configuration, index) => ({
        ...core.buildings[0], id: 100 + index, buildingTypeId: 'multistorage', configuration,
    }));
    const workspace = createSaveWorkspace('one', 'World', snapshot);
    return groupStorageInventory(buildSaveOverview(workspace, saveLookups), saveLookups)![0];
}

const fullHelium: SaveStorageConfiguration = { kind: 'storage', complete: true, items: { helium: 100 },
    space: { freeByItem: { helium: 0 }, flexibleSlots: 0, unrestrictedSlots: 0 } };

it('marks an item full only when all its eligible buildings are full, respecting filters and stack sizes', () => {
    const group = inventory(fullHelium, { kind: 'storage', complete: true, items: { helium: 100, basic_building: 750 },
        space: { freeByItem: { helium: 0, basic_building: 1250, calcite_sheets: 100 }, flexibleSlots: 1, unrestrictedSlots: 0 } });
    expect(group.space).toEqual({ status: 'available', flexibleSlots: 1 });
    expect(group.items.map(({ id, quantity, availability }) => [id, quantity, availability])).toEqual([
        ['basic_building', 750, { buildingCount: 1, buildingsWithRoom: 1, capacity: 2000, full: false }],
        ['calcite_sheets', 0, { buildingCount: 1, buildingsWithRoom: 1, capacity: 100, full: false }],
        ['helium', 200, { buildingCount: 2, buildingsWithRoom: 0, capacity: 200, full: true }],
    ]);
});

it('counts a building once when its assigned and unrestricted slots both accept the same item', () => {
    const group = inventory(fullHelium, { kind: 'storage', complete: true, items: { helium: 80 },
        space: { freeByItem: { helium: 20 }, flexibleSlots: 2, unrestrictedSlots: 2 } });
    expect(group.items).toMatchObject([{ id: 'helium', quantity: 180, availability: {
        buildingCount: 2, buildingsWithRoom: 1, capacity: 400, full: false,
    } }]);
});
