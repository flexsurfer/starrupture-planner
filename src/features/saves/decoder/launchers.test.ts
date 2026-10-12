// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './analyze';
import { readLauncherItem } from './launchers';
import { extractionContext, heliumItemAsset, saveEntity, saveFixture } from './test-fixture';

const otherAsset = '/Game/Unknown.Unknown';
const filter = (asset: string) => `ItemTypeFilter=(${JSON.stringify(asset)})`;
const inventory = (slots: string, main = '') => `/Script/Chimera.CrInventoryFragment(InputInventoryContainer=(Items=(${slots})),MainInventoryContainer=(Items=(${main})))`;

it.each(['Exporter', 'ExporterTier2'])('imports the selected item from an empty %s input slot, ignoring cargo and output inventory', folder => {
    const save = saveFixture();
    Object.assign(save.itemData.Mass.entities, { '(ID=50)': saveEntity(`${folder}/DA_${folder}.DA_${folder}`, 0, [
        inventory(`(SlotID=(ID=299),Item=(ItemDataBase="${otherAsset}",Count=0),${filter(heliumItemAsset)}),(bIsDisabled=True,${filter(otherAsset)})`, `(${filter(otherAsset)})`),
    ]) });
    const report = analyzeSave(save, extractionContext);
    const launcher = report.cores.flatMap(core => core.buildings).find(building => building.id === 50);
    expect(launcher).toMatchObject({ configuration: { kind: 'launcher', itemId: 'helium' } });
    expect(launcher).not.toHaveProperty('ratePerMinute');
});

it.each([
    inventory(`(Item=(ItemDataBase="${heliumItemAsset}",Count=20))`),
    inventory('', `(${filter(heliumItemAsset)})`),
    inventory(`(${filter(otherAsset)})`),
    inventory(`(${filter(heliumItemAsset)}),(ItemTypeFilter=("${otherAsset}"))`),
    inventory(`(bIsDisabled=True,${filter(heliumItemAsset)})`),
    inventory('(ItemTypeFilter=(None))'),
    inventory(`(${filter(heliumItemAsset)})`).slice(0, -1),
])('leaves unsupported, ambiguous or absent selection unknown: %s', fragment => {
    expect(readLauncherItem([fragment], extractionContext.mappings.items)).toBeNull();
});

it('supports repeated filters and quoted punctuation without treating nested fields as selection', () => {
    const asset = '/Game/Chimera/Items/Example,(test)"quoted"';
    expect(readLauncherItem([inventory(`(Item=(Count=3,${filter(otherAsset)}),${filter(asset)}),(${filter(asset)})`)], new Map([[asset, 'test-item']]))).toBe('test-item');
});

it('retains each storage and transport building as an observed instance without assigning My Bases sections', () => {
    const save = saveFixture();
    const paths = [
        'ResourceRedistributor/DA_ResourceRedistributor.DA_ResourceRedistributor',
        'Storage/DA_Storage.DA_Storage', 'StorageDepot/DA_StorageDepot.DA_StorageDepot',
        'UniversalStorage/DA_UniversalStorage.DA_UniversalStorage',
        'PackageStation/PackageReceiver/DA_PackageReceiver.DA_PackageReceiver',
        'PackageStation/PackageSender/DA_PackageSender.DA_PackageSender',
    ];
    Object.assign(save.itemData.Mass.entities, Object.fromEntries(paths.map((path, index) => [`(ID=${50 + index})`, saveEntity(path, 0)])));
    const report = analyzeSave(save, extractionContext);
    expect(report.cores.flatMap(core => core.buildings).filter(building => building.id >= 50).map(building => building.buildingTypeId)).toEqual([
        'storage_depot_v1', 'storage_depot_v2', 'expandable_storage', 'multistorage', 'package_receiver', 'package_dispatcher',
    ]);
    expect(report.cores.flatMap(core => core.buildings).every(building => !('sectionType' in building))).toBe(true);
});

it('reads launcher filters using mapping roles even when the catalog ID is unrelated to My Bases', () => {
    const save = saveFixture();
    const asset = '/Game/Chimera/Buildings/Custom/DA_Custom.DA_Custom';
    Object.assign(save.itemData.Mass.entities, { '(ID=50)': saveEntity('Custom/DA_Custom.DA_Custom', 0, [inventory(`(${filter(heliumItemAsset)})`)]) });
    const buildings = new Map(extractionContext.mappings.buildings);
    buildings.set(asset, { id: 'custom_launcher', tier: null, role: 'launcher' });
    const report = analyzeSave(save, { ...extractionContext,
        buildingIds: new Set([...extractionContext.buildingIds, 'custom_launcher']), mappings: { ...extractionContext.mappings, buildings },
    });
    expect(report.cores.flatMap(core => core.buildings).find(building => building.id === 50)).toMatchObject({ id: 50, buildingTypeId: 'custom_launcher', configuration: { kind: 'launcher', itemId: 'helium' } });
});
