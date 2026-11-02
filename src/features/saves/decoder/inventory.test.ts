// @vitest-environment node
import { expect, it } from 'vitest';
import { readStorageInventory } from './inventory';
import { extractionContext, heliumItemAsset } from './test-fixture';

const inventory = (items: string) => `/Script/Chimera.CrInventoryFragment(MainInventoryContainer=(Items=${items},ArrayReplicationKey=1))`;
const helium = (count: string) => `(SlotID=(ID=1),Item=(ItemId=(Handle=A),ItemDataBase="${heliumItemAsset}",Count=${count}))`;

it.each(['', '()', '((SlotID=(ID=1),ItemTypeFilter=("filter")))', `(${helium('0')})`])('recognizes an empty storage inventory: %s', slots => {
    expect(readStorageInventory([inventory(slots)], extractionContext)).toMatchObject({ items: {}, complete: true });
});

it('distinguishes missing, conflicting and malformed inventories from empty storage', () => {
    for (const fragments of [[], [inventory('()'), inventory('()')], [inventory('broken')], [inventory('((Item=invalid))')]]) {
        expect(readStorageInventory(fragments, extractionContext)).toMatchObject({ items: {}, complete: false });
    }
});

it.each([helium('-2'), helium('1.5'), helium('9007199254740992'), '(Item=(Count=9))',
    '(Item=(ItemDataBase="/Game/Unknown",Count=6))', `(Item=(ItemDataBase="${heliumItemAsset}"))`])(
    'retains readable stacks when a slot is invalid or unmapped: %s', slot => {
        expect(readStorageInventory([inventory(`(${helium('4')},${slot})`)], extractionContext))
            .toMatchObject({ items: { helium: 4 }, complete: false, space: null });
    });

it('uses item stack limits and counts each flexible slot once, excluding disabled slots from usable space', () => {
    const material = "/Game/Chimera/Items/I_BasicBuildingMaterial.I_BasicBuildingMaterial_C'/Game/Chimera/Items/I_BasicBuildingMaterial.Default__I_BasicBuildingMaterial_C'";
    const slots = [
        helium('99'), `(ItemTypeFilter=("${material}"))`, '()', `(ItemTypeFilter=("${heliumItemAsset}","${material}"))`,
        '(bIsDisabled=True)', `(bIsDisabled=True,Item=(ItemDataBase="${material}",Count=700))`,
    ];
    expect(readStorageInventory([inventory(`(${slots.join(',')})`)], extractionContext)).toEqual({
        kind: 'storage', items: { helium: 99, basic_building: 700 }, complete: true,
        space: { freeByItem: { helium: 101, basic_building: 2000 }, flexibleSlots: 2, unrestrictedSlots: 1 },
    });
});

it.each([helium('101'), '(ItemTypeFilter=("unknown"))', '(bIsDisabled=invalid)', '(ItemTypeFilter=broken)'])(
    'keeps stock quantities but withholds capacity for an unreadable limit or slot: %s', slot => {
        expect(readStorageInventory([inventory(`(${slot})`)], extractionContext)).toMatchObject({ complete: true, space: null });
    });
