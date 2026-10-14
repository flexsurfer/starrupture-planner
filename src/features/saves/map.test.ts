// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './decoder/analyze';
import { extractionContext, saveLookups, snapshotFixture, saveEntity, heliumItemAsset } from './decoder/test-fixture';
import { createSaveWorkspace } from './workspace';
import { buildSaveOverview } from './overview';
import { buildSaveMap } from './map';

it('projects positions, selected items, recipe inputs and only explicit cargo links across Cores', () => {
    const save = snapshotFixture();
    save.itemData.Mass.entities['(ID=50)'] = saveEntity('Exporter/DA_Exporter.DA_Exporter', 0, [
        `/Script/Chimera.CrInventoryFragment(InputInventoryContainer=(Items=((ItemTypeFilter=(${JSON.stringify(heliumItemAsset)})))))`,
    ]);
    const snapshot = analyzeSave(save, extractionContext);
    const map = buildSaveMap(buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups), saveLookups);
    expect(map.entities).toHaveLength(snapshot.cores.length + snapshot.cores.flatMap(core => core.buildings).length);
    expect(map.entities.find(entity => entity.id === 200)?.detail?.resources[0].name).toBe('Tube');
    expect(map.entities.find(entity => entity.id === 200)?.inputs.length).toBeGreaterThan(0);
    expect(map.entities.find(entity => entity.id === 203)?.inputs).toEqual([]);
    expect(map.entities.find(entity => entity.id === 50)?.detail?.resources[0]).toMatchObject({ itemId: 'helium', source: 'corporation', rate: 10 });
    expect(map.entities.find(entity => entity.id === 30)?.detail?.resources[0]).toMatchObject({ itemId: 'helium', source: 'delivery' });
    expect(map.entities.find(entity => entity.id === 22)?.detail?.resources[0]).toMatchObject({ itemId: 'helium', rate: null });
    expect(map.links).toEqual([
        { source: 20, target: 30, item: { id: 'helium', name: 'Helium-3' } },
        { source: 21, target: 31, item: { id: 'helium', name: 'Helium-3' } },
    ]);
    for (const core of snapshot.cores) for (const entity of [core, ...core.buildings]) {
        expect(map.entities.find(marker => marker.id === entity.id)?.position).toEqual(entity.position);
    }
});

it('keeps cargo endpoints when an item is unknown without inferring conveyor or launcher routes', () => {
    const snapshot = analyzeSave(snapshotFixture(), extractionContext);
    for (const core of snapshot.cores) for (const building of core.buildings) {
        if (building.configuration.kind === 'dispatcher') building.configuration.itemId = null;
    }
    const map = buildSaveMap(buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups), saveLookups);
    expect(map.links).toEqual([{ source: 20, target: 30, item: null }, { source: 21, target: 31, item: null }]);
});
