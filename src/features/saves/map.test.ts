// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './decoder/analyze';
import { extractionContext, saveLookups, snapshotFixture, transportFixture, saveEntity, heliumItemAsset } from './decoder/test-fixture';
import { createSaveWorkspace } from './workspace';
import { buildSaveOverview } from './overview';
import { buildSaveMap } from './map';
import { filterSaveMap } from './map-filter';

function cargoOverview() {
    const snapshot = analyzeSave(transportFixture(), extractionContext);
    for (const core of snapshot.cores) core.buildings = core.buildings.filter(building => [20, 30].includes(building.id));
    return { snapshot, overview: () => buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups) };
}

it('keeps overview cargo routes consistent with the filtered endpoints without altering the original map', () => {
    const { overview } = cargoOverview();
    const map = buildSaveMap(overview(), saveLookups);
    const sender = map.entities.find(entity => entity.id === 20)!;
    const receiver = map.entities.find(entity => entity.id === 30)!;
    const sendersOnly = filterSaveMap(map, [sender.detail!.instance.buildingTypeId]);
    expect(sendersOnly.entities.map(entity => entity.id).sort((a, b) => a - b)).toEqual([1, 2, 20]);
    expect(sendersOnly.links).toEqual([]);
    expect(sendersOnly.coreLinks).toEqual([]);
    expect(sendersOnly.entities.find(entity => entity.id === 20)).toBe(sender);
    expect(sendersOnly.stacks.get(20)?.above).not.toContain(30);
    expect(sendersOnly.stacks.get(20)?.below).not.toContain(30);
    expect(sendersOnly.levelCountsByCore).toBe(map.levelCountsByCore);
    const cargo = filterSaveMap(map, [sender.detail!.instance.buildingTypeId, receiver.detail!.instance.buildingTypeId]);
    expect(cargo).toBe(map);
    expect(cargo.links).toEqual(map.links);
    expect(cargo.coreLinks).toEqual(map.coreLinks);
    expect(map.links).toHaveLength(1);
    expect(map.coreLinks).toHaveLength(1);
    const hidden = filterSaveMap(map, []);
    expect(hidden.entities.map(entity => entity.id)).toEqual([1, 2]);
    expect(hidden.links).toEqual([]);
    expect(hidden.coreLinks).toEqual([]);
    expect(hidden.stacks.size).toBe(0);
    expect(hidden.levelCountsByCore).toBe(map.levelCountsByCore);
    expect(map.entities).toHaveLength(4);
});

it('routes cargo between the covering Cores even when both endpoints have the same nearest Core', () => {
    const save = transportFixture();
    save.itemData.Mass.entities['(ID=30)'].spawnData.transform.translation.x = 12;
    const snapshot = analyzeSave(save, extractionContext);
    for (const core of snapshot.cores) core.buildings = core.buildings.filter(building => [20, 30].includes(building.id));
    snapshot.cores[1].bounds!.min.x = 5;
    expect(snapshot.cores[0].buildings.map(building => building.id)).toEqual([20, 30]);
    const overview = buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups);
    expect(overview.cores.map(core => [core.incoming.length, core.outgoing.length])).toEqual([[0, 1], [1, 0]]);
    const map = buildSaveMap(overview, saveLookups);
    expect(map.entities.filter(entity => entity.detail).map(entity => entity.detail!.cores.map(core => core.id))).toEqual([[1], [2]]);
    expect(map.coreLinks).toEqual([{ source: 1, target: 2, items: [{ id: 'helium', name: 'Helium-3' }], bidirectional: false }]);
});

it('keeps a delivery local when every covering Core contains both endpoints', () => {
    const { snapshot, overview } = cargoOverview();
    for (const core of snapshot.cores) core.bounds = { min: { x: -10, y: -10, z: -10 }, max: { x: 40, y: 10, z: 10 } };
    const model = overview();
    expect(model.cores.map(core => [core.incoming.length, core.outgoing.length])).toEqual([[0, 0], [0, 0]]);
    const map = buildSaveMap(model, saveLookups);
    expect(map.coreLinks).toEqual([]);
    expect(map.links).toEqual([{ source: 20, target: 30, item: { id: 'helium', name: 'Helium-3' } }]);
    expect(map.entities.find(entity => entity.id === 20)?.connectedBuildingId).toBe(30);
    expect(map.entities.find(entity => entity.id === 30)?.connectedBuildingId).toBe(20);
});

it('retains routes across partial coverage without inventing transfers between shared Cores', () => {
    const { snapshot, overview } = cargoOverview();
    for (const id of [3, 4]) snapshot.cores.push({ ...snapshot.cores[0], id, position: { x: 15, y: 0, z: 0 }, buildings: [],
        bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 40, y: 10, z: 10 } } });
    const map = buildSaveMap(overview(), saveLookups);
    expect(map.entities.find(entity => entity.id === 20)?.detail?.cores.map(core => core.id)).toEqual([1, 3, 4]);
    expect(map.entities.find(entity => entity.id === 30)?.detail?.cores.map(core => core.id)).toEqual([2, 3, 4]);
    expect(map.coreLinks.map(({ source, target }) => [source, target])).toEqual([[1, 2], [1, 3], [1, 4], [3, 2], [4, 2]]);
    expect(map.coreLinks.every(route => route.items.length === 1 && !route.bidirectional)).toBe(true);
});

it('matches the Core import and export summaries for every four-Core endpoint coverage combination', () => {
    const { snapshot, overview } = cargoOverview();
    for (const id of [3, 4]) snapshot.cores.push({ ...snapshot.cores[0], id, buildings: [] });
    // Each Core covers neither endpoint, only the sender, only the receiver, or both.
    const ranges = [[100, 110], [-10, 10], [20, 40], [-10, 40]];
    for (let combination = 0; combination < ranges.length ** snapshot.cores.length; combination++) {
        for (const [index, core] of snapshot.cores.entries()) {
            const [min, max] = ranges[Math.floor(combination / ranges.length ** index) % ranges.length];
            core.bounds = { min: { x: min, y: -10, z: -10 }, max: { x: max, y: 10, z: 10 } };
        }
        const model = overview();
        const expected = new Set<string>();
        // Derive the expected routes independently from the user-facing resource summaries.
        for (const core of model.cores) {
            for (const resource of core.outgoing) for (const building of resource.buildings) {
                for (const target of building.relatedCores) expected.add(`${core.core.id}:${target.id}`);
            }
            for (const resource of core.incoming.filter(resource => resource.source === 'delivery')) for (const building of resource.buildings) {
                for (const source of building.relatedCores) expected.add(`${source.id}:${core.core.id}`);
            }
        }
        const map = buildSaveMap(model, saveLookups);
        expect(map.coreLinks.map(({ source, target }) => `${source}:${target}`).sort(), `Coverage combination ${combination}`)
            .toEqual([...expected].sort());
        expect(map.links).toHaveLength(1);
        expect(map.coreLinks.every(route => route.source !== route.target && !route.bidirectional)).toBe(true);
    }
});

it.each([20, 30])('keeps the physical cargo link without assigning uncovered endpoint %s to a Core', id => {
    const { snapshot, overview } = cargoOverview();
    snapshot.cores.flatMap(core => core.buildings).find(building => building.id === id)!.position.z = 100;
    const map = buildSaveMap(overview(), saveLookups);
    expect(map.entities.find(entity => entity.id === id)?.detail?.cores).toEqual([]);
    expect(map.coreLinks).toEqual([]);
    expect(map.links).toHaveLength(1);
});

it('uses imported grouping for cargo routes when Core bounds are unavailable', () => {
    const { snapshot, overview } = cargoOverview();
    for (const core of snapshot.cores) core.bounds = null;
    const map = buildSaveMap(overview(), saveLookups);
    expect(map.coreLinks).toEqual([{ source: 1, target: 2, items: [{ id: 'helium', name: 'Helium-3' }], bidirectional: false }]);
});

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
    const snapshot = analyzeSave(transportFixture(), extractionContext);
    for (const core of snapshot.cores) for (const building of core.buildings) {
        if (building.configuration.kind === 'dispatcher') building.configuration.itemId = null;
    }
    const map = buildSaveMap(buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups), saveLookups);
    expect(map.links).toEqual([{ source: 20, target: 30, item: null }, { source: 21, target: 31, item: null }]);
    expect(map.coreLinks).toEqual([{ source: 1, target: 2, items: [null], bidirectional: false }]);
});

it.each([false, true])('combines repeated inter-Core deliveries while preserving direction and excluding local routes (shared Core: %s)', shared => {
    const save = transportFixture();
    const entities: Record<string, ReturnType<typeof saveEntity>> = save.itemData.Mass.entities;
    entities['(ID=21)'].spawnData.transform.translation.x = 0;
    entities['(ID=31)'].spawnData.transform.translation.x = 30;
    for (const [sender, receiver, from, to] of [[40, 41, 30, 0], [24, 32, 0, 0], [25, 33, 0, 30]]) {
        entities[`(ID=${sender})`] = saveEntity('PackageStation/PackageSender/DA_PackageSender.DA_PackageSender', from);
        entities[`(ID=${receiver})`] = saveEntity('PackageStation/PackageReceiver/DA_PackageReceiver.DA_PackageReceiver', to);
        save.itemData.CrPackageTransportReplicator.senderConnections[`(ID=${sender})`] = {
            receiver: { iD: receiver }, item: heliumItemAsset, requestedAmount: 100,
        };
    }
    const snapshot = analyzeSave(save, extractionContext);
    if (shared) snapshot.cores.push({ ...snapshot.cores[0], id: 3, position: { x: 15, y: 0, z: 0 }, buildings: [],
        bounds: { min: { x: -10, y: -10, z: -10 }, max: { x: 40, y: 10, z: 10 } } });
    const unknown = snapshot.cores.flatMap(core => core.buildings).find(building => building.id === 25)!;
    if (unknown.configuration.kind === 'dispatcher') unknown.configuration.itemId = null;
    const original = structuredClone(snapshot);
    const map = buildSaveMap(buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups), saveLookups);
    expect(map.links).toHaveLength(5);
    const expected = [
        { source: 1, target: 2, items: [{ id: 'helium', name: 'Helium-3' }, null], bidirectional: true },
        { source: 2, target: 1, items: [{ id: 'helium', name: 'Helium-3' }], bidirectional: true },
    ];
    if (shared) expected.push(
        { source: 1, target: 3, items: [{ id: 'helium', name: 'Helium-3' }, null], bidirectional: true },
        { source: 3, target: 2, items: [{ id: 'helium', name: 'Helium-3' }, null], bidirectional: true },
        { source: 2, target: 3, items: [{ id: 'helium', name: 'Helium-3' }], bidirectional: true },
        { source: 3, target: 1, items: [{ id: 'helium', name: 'Helium-3' }], bidirectional: true },
    );
    const routeOrder = (a: { source: number; target: number }, b: { source: number; target: number }) => a.source - b.source || a.target - b.target;
    expect(map.coreLinks.sort(routeOrder)).toEqual(expected.sort(routeOrder));
    expect(snapshot).toEqual(original);
});
