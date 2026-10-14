// @vitest-environment node
import { expect, it } from 'vitest';
import { analyzeSave } from './decoder/analyze';
import { saveLookups, extractionContext, extractionFixture, saveFixture, snapshotFixture } from './decoder/test-fixture';
import { buildSaveOverview } from './overview';
import { createSaveWorkspace } from './workspace';
import { normalizeSaveWorkspace } from './storage-schema';

it('stores only the app contract and detaches imported data', () => {
    const snapshot = analyzeSave(snapshotFixture(), extractionContext);
    const workspace = createSaveWorkspace('one', 'World', snapshot);
    snapshot.cores[0].name = 'Changed outside the app';
    expect(workspace.snapshot.cores[0].name).toBe('Workshop');
    const normalized = normalizeSaveWorkspace({ ...workspace, catalog: [{ raw: true }], snapshot: { ...workspace.snapshot, raw: { private: true } } });
    expect(Object.keys(normalized).sort()).toEqual(['coreSettings', 'id', 'name', 'schemaVersion', 'snapshot']);
    expect(normalized.snapshot).not.toHaveProperty('raw');
    expect(() => normalizeSaveWorkspace({ ...workspace, schemaVersion: 2 })).toThrow();
});
it('derives rates and counts without combining individual extractors or transport endpoints', () => {
    const snapshot = analyzeSave(extractionFixture(), extractionContext);
    const workspace = createSaveWorkspace('one', 'World', snapshot);
    const overview = buildSaveOverview(workspace, saveLookups);
    expect(overview.cores[0].incoming.find(resource => resource.itemId === 'ore_titanium')?.rate).toBe(420);
    expect(overview.cores[1].incoming.find(resource => resource.itemId === 'ore_titanium')?.rate).toBe(960);
    expect(overview.cores[0].outgoing.find(resource => resource.itemId === 'helium')?.rate).toBe(480);
    expect(overview.cores[1].incoming.find(resource => resource.source === 'delivery')?.rate).toBe(480);
    expect(overview.cores[0].buildingDetails.filter(building => building.instance.configuration.kind === 'extractor')).toHaveLength(3);
    expect(overview.cores[1].buildingDetails.filter(building => building.instance.configuration.kind === 'receiver')).toHaveLength(2);
    expect(overview.cores[0].outgoing[0].buildings.map(building => building.relatedBuilding?.id)).toEqual([30, 31]);
    expect(JSON.stringify(workspace)).not.toMatch(/rate|capacity|catalog|disabled|fragment|interpretation/);
});
it('uses nominal recipes independent of running state and retains same-item alternatives', () => {
    const snapshot = analyzeSave(snapshotFixture(), extractionContext);
    const overview = buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups);
    const details = overview.cores.flatMap(core => core.buildingDetails);
    expect(details.find(building => building.instance.id === 200)?.resources[0].rate).toBeGreaterThan(0);
    expect(details.find(building => building.instance.id === 201)?.resources[0].rate).not.toBe(details.find(building => building.instance.id === 202)?.resources[0].rate);
    const unknown = details.find(building => building.instance.id === 203)!;
    expect(unknown.resources).toEqual([]);
});
it('never merges different power networks just because they belong to one Core', () => {
    const snapshot = analyzeSave(saveFixture(), extractionContext);
    snapshot.cores[0].powerNetworkId = 1;
    snapshot.cores[1].powerNetworkId = 1;
    snapshot.cores[0].buildings = [
        { id: 10, name: null, position: { x: 0, y: 0, z: 0 }, buildingTypeId: 'smelter', powerNetworkId: 1, configuration: { kind: 'production', recipeId: null } },
        { id: 11, name: null, position: { x: 0, y: 0, z: 0 }, buildingTypeId: 'solar_generator_v2', powerNetworkId: 2, configuration: { kind: 'other' } },
    ];
    snapshot.cores[1].buildings = [];
    const overview = buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups);
    expect(overview.powerNetworks).toEqual([
        { id: 1, coreIds: [1, 2], powerUse: 5, powerGeneration: 0 },
        { id: 2, coreIds: [], powerUse: 0, powerGeneration: 140 },
    ]);
    expect(overview.cores[0].powerNetworks).toHaveLength(2);
    expect(overview.cores[1].powerNetworks).toEqual([overview.powerNetworks[0]]);
});
it('derives heat capacity from each persisted Core level and its own individual amplifiers', () => {
    const snapshot = analyzeSave(saveFixture(), extractionContext);
    snapshot.cores[0].buildings.push(
        { id: 90, name: null, position: { x: 0, y: 0, z: 0 }, buildingTypeId: 'base_core_amplifier_v1', powerNetworkId: null, configuration: { kind: 'other' } },
        { id: 91, name: null, position: { x: 0, y: 0, z: 0 }, buildingTypeId: 'base_core_amplifier_v2', powerNetworkId: null, configuration: { kind: 'other' } },
    );
    const workspace = normalizeSaveWorkspace(JSON.parse(JSON.stringify(createSaveWorkspace('one', 'World', snapshot))));
    const overview = buildSaveOverview(workspace, saveLookups);
    expect(overview.cores.map(core => [core.core.level, core.heat, core.heatCapacity])).toEqual([[0, 3, 1270], [3, 5, 6000]]);
    expect(workspace.snapshot.cores[0]).not.toHaveProperty('heatCapacity');
});
it.each([null, 99])('keeps heat capacity unknown for a missing or unsupported level: %s', level => {
    const snapshot = analyzeSave(saveFixture(), extractionContext);
    snapshot.cores[0].level = level;
    const overview = buildSaveOverview(createSaveWorkspace('one', 'World', snapshot), saveLookups);
    expect(overview.cores[0]).toMatchObject({ heat: 3, heatCapacity: null });
});
it('loads snapshots without level as unknown and rejects invalid persisted levels', () => {
    const workspace = createSaveWorkspace('one', 'World', analyzeSave(saveFixture(), extractionContext));
    Reflect.deleteProperty(workspace.snapshot.cores[0], 'level');
    expect(normalizeSaveWorkspace(workspace).snapshot.cores[0].level).toBeNull();
    for (const level of [-1, 1.5, NaN, '3']) {
        Object.assign(workspace.snapshot.cores[0], { level });
        expect(() => normalizeSaveWorkspace(workspace)).toThrow();
    }
});
it('rejects invalid references before replacing the stored snapshot', () => {
    const workspace = createSaveWorkspace('one', 'World', analyzeSave(extractionFixture(), extractionContext));
    const dispatcher = workspace.snapshot.cores[0].buildings.find(building => building.id === 21)!;
    dispatcher.configuration = { kind: 'dispatcher', itemId: 'helium', receiverId: 30 };
    expect(() => normalizeSaveWorkspace(workspace)).toThrow();
});
it('keeps Core settings inside their workspace even if IDs and times coincide', () => {
    const snapshot = analyzeSave(saveFixture(), extractionContext);
    const previous = createSaveWorkspace('one', 'World', snapshot);
    previous.coreSettings['1:10.5'] = { objective: { kind: 'intermediate', itemIds: ['tube'] } };
    expect(createSaveWorkspace('two', 'Other world', snapshot, previous).coreSettings).toEqual({});
});
