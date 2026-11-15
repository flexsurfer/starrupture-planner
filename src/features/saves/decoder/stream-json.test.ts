// @vitest-environment node
import { expect, it } from 'vitest';
import { createSaveJsonParser } from './stream-json';
import { analyzeSave } from './analyze';
import { extractionContext, extractionFixture, saveFixture, snapshotFixture, storageFixture, transportFixture, saveEntity, heliumItemAsset } from './test-fixture';

function parse(text: string, chunkSize = 4096) {
    const parser = createSaveJsonParser(extractionContext);
    const bytes = new TextEncoder().encode(text);
    for (let offset = 0; offset < bytes.length; offset += chunkSize) parser.write(bytes.subarray(offset, offset + chunkSize));
    return parser.end();
}

it.each([saveFixture, transportFixture, extractionFixture, snapshotFixture, storageFixture].map(fixture => ({ name: fixture.name, fixture })))('matches the full analyzer for $name', ({ fixture }) => {
    const save = fixture();
    expect(analyzeSave(parse(JSON.stringify(save)), extractionContext)).toEqual(analyzeSave(save, extractionContext));
});

it.each([1, 2, 3, 7, 64, 4096])('preserves escaped names, Unicode, fragments and metadata across %s-byte chunks', chunkSize => {
    const save = snapshotFixture();
    save.itemData.CrBuildingCustomNameSubsystem.customNames['(ID=1)'] = 'Usine 🏭 — Żółć 日本語 "quoted" \\ path\nline \ud800 \udc00';
    // Dependencies can come before or after entities; no ordering is imposed on game saves.
    save.itemData = Object.fromEntries(Object.entries(save.itemData).reverse()) as typeof save.itemData;
    save.itemData.Mass = Object.fromEntries(Object.entries(save.itemData.Mass).reverse()) as typeof save.itemData.Mass;
    Object.assign(save.itemData.Mass.entities, {
        '(ID=300)': saveEntity('Exporter/DA_Exporter.DA_Exporter', 0, [
            `/Script/Chimera.CrInventoryFragment(InputInventoryContainer=(Items=((ItemTypeFilter=(${JSON.stringify(heliumItemAsset)})))))`,
        ]),
    });
    const json = JSON.stringify(save).replace('🏭', '\\ud83c\\udfed');
    expect(analyzeSave(parse(json, chunkSize), extractionContext)).toEqual(analyzeSave(save, extractionContext));
});

it('discards unrelated sections, unknown entities, unused fields and running state from its projection', () => {
    const save = saveFixture();
    const ignored = 'unused data '.repeat(100_000);
    const input = { ...save, unrelated: [{ notes: ignored }], itemData: { ...save.itemData,
        Mass: { ...save.itemData.Mass, stabilitySubsystemState: { nodes: [{ data: ignored }] }, entities: {
            ...save.itemData.Mass.entities,
            '(ID=90)': { ...saveEntity('Unknown/DA_Unknown.DA_Unknown', 0), ignored },
        } },
    } };
    const projection = parse(JSON.stringify(input));
    expect(JSON.stringify(projection).length).toBeLessThan(5000);
    expect(JSON.stringify(projection)).not.toMatch(/unused data|CrBuildingStateFragment|Unknown|rotation|scale3D/);
    expect(analyzeSave(projection, extractionContext)).toEqual(analyzeSave(input, extractionContext));
});

it('imports known buildings after more than 100,000 discarded world entities', () => {
    const save = saveFixture();
    const expected = analyzeSave(save, extractionContext);
    const unknown = { spawnData: { entityConfigDataPath: '/Game/Chimera/World/DA_Unknown.DA_Unknown' } };
    save.itemData.Mass.entities = {
        ...Object.fromEntries(Array.from({ length: 100_001 }, (_, index) => [`(ID=${index + 1000})`, unknown])),
        ...save.itemData.Mass.entities,
    };
    const projection = parse(JSON.stringify(save));
    expect(JSON.stringify(projection).length).toBeLessThan(5000);
    expect(analyzeSave(projection, extractionContext)).toEqual(expected);
});

it('bounds source electricity records at 500,000 even when every record is discarded', () => {
    const input = { itemData: { Mass: { entities: {}, electricitySubsystemState: {
        nodeData: Object.fromEntries(Array.from({ length: 500_001 }, (_, index) => [`(UId=(ID=${index}))`, null])),
    } } } };
    expect(() => parse(JSON.stringify(input))).toThrow(expect.objectContaining({ code: 'complexity', diagnostic: {
        subcode: 'power-network-records', actual: 500_001, limit: 500_000,
    } }));
});

it('keeps the 100,000-record budget for other metadata collections', () => {
    const save = { itemData: { Mass: { entities: {} }, CrBuildingCustomNameSubsystem: {
        customNames: Object.fromEntries(Array.from({ length: 100_001 }, (_, index) => [`(ID=${index})`, null])),
    } } };
    expect(() => parse(JSON.stringify(save))).toThrow(expect.objectContaining({ diagnostic: {
        subcode: 'custom-name-records', actual: 100_001, limit: 100_000,
    } }));
});

it.each([true, false])('filters metadata while preserving conflicts and invalid references (metadata first: %s)', metadataFirst => {
    const save = saveFixture();
    Object.assign(save.itemData.Mass.electricitySubsystemState.nodeData, {
        unrelated: { handle: { iD: 500 }, subGraph: { subGraphId: 7 } },
        same: { handle: { iD: 1 }, subGraph: { subGraphId: 7 } },
        conflict: { handle: { iD: 10 }, subGraph: { subGraphId: 12 } },
        repeated: { handle: { iD: 10 }, subGraph: { subGraphId: 9 } },
        invalid: { handle: { iD: 11 }, subGraph: { subGraphId: 4294967295 } },
        afterInvalid: { handle: { iD: 11 }, subGraph: { subGraphId: 9 } },
        stringHandle: { handle: { iD: '1' }, subGraph: { subGraphId: 9 } },
    });
    Object.assign(save.itemData.CrBuildingCustomNameSubsystem.customNames, {
        '(ID=500)': 'unused name'.repeat(100), '(ID=01)': 'alias', '(ID=10)': 'Smelter 🏭',
    });
    save.itemData.BaseCoreReplicationHelperSaveData.baseCoreSaveData.push(
        { baseCore: { iD: 1 }, upgradeLevel: 0 }, { baseCore: { iD: 2 }, upgradeLevel: 2 },
        { baseCore: { iD: 2 }, upgradeLevel: 3 }, { baseCore: { iD: 10 }, upgradeLevel: 1 },
        { baseCore: { iD: 500 }, upgradeLevel: 1 },
    );
    const { Mass, ...metadata } = save.itemData;
    save.itemData = metadataFirst ? { ...metadata, Mass } : { Mass, ...metadata };
    const { entities, electricitySubsystemState } = Mass;
    save.itemData.Mass = metadataFirst ? { electricitySubsystemState, entities } : { entities, electricitySubsystemState };
    const projection = parse(JSON.stringify(save), 7);
    expect(projection).toMatchObject({ itemData: {
        Mass: { electricitySubsystemState: { nodeData: {
            '1': { handle: { iD: 1 }, subGraph: { subGraphId: 7 } },
            '10': { handle: { iD: 10 }, subGraph: { subGraphId: null } },
            '11': { handle: { iD: 11 }, subGraph: { subGraphId: null } },
        } } },
        CrBuildingCustomNameSubsystem: { customNames: { '(ID=1)': 'Workshop', '(ID=10)': 'Smelter 🏭' } },
        BaseCoreReplicationHelperSaveData: { baseCoreSaveData: [
            { baseCore: { iD: 1 }, upgradeLevel: 0 }, { baseCore: { iD: 2 }, upgradeLevel: null },
        ] },
    } });
    expect(JSON.stringify(projection)).not.toMatch(/unused name|alias|"iD":500/);
    expect(analyzeSave(projection, extractionContext)).toEqual(analyzeSave(save, extractionContext));
});

it('discards fragments according to building role while preserving storage, recipes and Core identity', () => {
    const save = storageFixture();
    const original = analyzeSave(save, extractionContext);
    for (const entity of Object.values(save.itemData.Mass.entities)) {
        const mapping = extractionContext.mappings.buildings.get(entity.spawnData.entityConfigDataPath);
        if (mapping?.role !== 'core') entity.fragmentValues.push('/Script/AuActorPlacement.AuAPMassFragment(UNUSED_IDENTITY)');
        if (!mapping || !extractionContext.storageBuildingIds.has(mapping.id)) entity.fragmentValues.push('/Script/Chimera.CrInventoryFragment(UNUSED_INVENTORY)');
        if (!mapping || !extractionContext.mappings.recipes.has(mapping.id)) entity.fragmentValues.push('/Script/Chimera.CrCraftingFragment(UNUSED_RECIPE)');
    }
    const projection = parse(JSON.stringify(save));
    expect(JSON.stringify(projection)).not.toContain('UNUSED_');
    expect(analyzeSave(projection, extractionContext)).toEqual(original);
    expect(analyzeSave(projection, extractionContext)).toEqual(analyzeSave(save, extractionContext));
});

it('still validates dangling transport links instead of discarding them as unused metadata', () => {
    const save = transportFixture();
    save.itemData.CrPackageTransportReplicator.senderConnections['(ID=999)'] = { receiver: { iD: 30 }, item: heliumItemAsset };
    expect(() => analyzeSave(parse(JSON.stringify(save)), extractionContext)).toThrow('transport');
});

it.each([
    '{}', 'null', '[]', '{"itemData":[]}', '{"itemData":{"Mass":[]}}',
    '{"itemData":{"Mass":{"entities":[]}}}', '{"itemData.Mass.entities":{}}',
    '{"unrelated":{"itemData":{"Mass":{"entities":{}}}}}',
])('rejects a missing or invalid required structure: %s', json => {
    expect(() => parse(json)).toThrow('structure');
});

it.each([
    '{"a":1,}', '{"a":[1,]}', '{"a":01}', '{"a":"bad\nstring"}', '{"a":true false}',
    '{"a":{"b":1,}}', '{"a":1,"a":2}', '{"a":1,"\\u0061":2}',
    '{"__proto__":{"polluted":true}}', '{"a":"\\q"}',
])('validates JSON even inside ignored sections: %s', invalid => {
    const text = JSON.stringify({ ...saveFixture(), ignored: null }).replace('"ignored":null', `"ignored":${invalid}`);
    expect(() => parse(text, 3)).toThrow('structure');
    expect(Object.prototype).not.toHaveProperty('polluted');
});

it('rejects truncation, trailing documents, duplicate collections, and an unsupported version', () => {
    const json = JSON.stringify(saveFixture());
    expect(() => parse(json.slice(0, -1))).toThrow('structure');
    expect(() => parse(`${json}{}`)).toThrow('structure');
    expect(() => parse(json.replace('"entities":{', '"entities":{},"entities":{'))).toThrow('structure');
    expect(() => parse(JSON.stringify({ ...saveFixture(), version: null }))).toThrow('mapping-version');
});

it('preserves empty saves and the handling of malformed optional metadata', () => {
    for (const value of [null, [], {}, false, 1]) {
        const input = { itemData: { Mass: { entities: {}, electricitySubsystemState: { nodeData: value } },
            CrBuildingCustomNameSubsystem: { customNames: value }, BaseCoreReplicationHelperSaveData: { baseCoreSaveData: value } } };
        expect(analyzeSave(parse(JSON.stringify(input)), extractionContext)).toEqual(analyzeSave(input, extractionContext));
    }
    expect(() => parse('{"itemData":{"Mass":{"entities":{}},"CrPackageTransportReplicator":{"senderConnections":null}}}'))
        .toThrow('transport');
});

it('bounds nesting and an unfinished oversized token before the entire input is read', () => {
    expect(() => parse(`{"ignored":${'['.repeat(129)}`)).toThrow(expect.objectContaining({ code: 'complexity', diagnostic: {
        subcode: 'json-depth', actual: 129, limit: 128,
    } }));
    const parser = createSaveJsonParser(extractionContext);
    const bytes = new TextEncoder();
    parser.write(bytes.encode('{"ignored":"'));
    const chunk = bytes.encode('a'.repeat(64 * 1024));
    expect(() => { for (let i = 0; i < 130; i++) parser.write(chunk); }).toThrow(expect.objectContaining({ diagnostic: {
        subcode: 'json-token-chars', actual: 4 * 1024 * 1024 + 1, limit: 4 * 1024 * 1024,
    } }));
});

it('preserves fragment-count and fragment-size checks before discarding running state', () => {
    for (const [fragments, diagnostic] of [
        [Array.from({ length: 4097 }, () => 'unused'), { subcode: 'entity-fragment-count', actual: 4097, limit: 4096 }],
        [['a'.repeat(1024 * 1024 + 1)], { subcode: 'entity-fragment-chars', actual: 1024 * 1024 + 1, limit: 1024 * 1024 }],
    ] as const) {
        const save = saveFixture();
        save.itemData.Mass.entities['(ID=10)'].fragmentValues = [...fragments];
        expect(() => parse(JSON.stringify(save))).toThrow(expect.objectContaining({ code: 'complexity', diagnostic }));
    }
});

it('bounds selected records, unexpected timestamp containers and retained object keys', () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    for (const prefix of ['{"timestamp":[', '{"itemData":{"Mass":{"entities":{"(ID=1)":{"ignored":[']) {
        const parser = createSaveJsonParser(extractionContext);
        parser.write(encode(prefix));
        const chunk = encode(`${JSON.stringify('x'.repeat(64 * 1024))},`);
        expect(() => { for (let i = 0; i < 140; i++) parser.write(chunk); }).toThrow(expect.objectContaining({ diagnostic: {
            subcode: 'json-record-chars', actual: expect.any(Number), limit: 8 * 1024 * 1024,
        } }));
    }
    expect(() => parse(`{"${'k'.repeat(2049)}":0}`)).toThrow(expect.objectContaining({ diagnostic: {
        subcode: 'json-key-chars', actual: 2049, limit: 2048,
    } }));
    const parser = createSaveJsonParser(extractionContext);
    parser.write(encode('{"ignored":{'));
    expect(() => {
        for (let i = 0; i < 8500; i++) parser.write(encode(`${JSON.stringify(`${i}-${'k'.repeat(2040)}`)}:0,`));
    }).toThrow(expect.objectContaining({ diagnostic: {
        subcode: 'json-active-key-chars', actual: expect.any(Number), limit: 16 * 1024 * 1024,
    } }));
});

it('reports the compact projection limit independently of individual fragment and record limits', () => {
    const prefix = '/Script/Chimera.CrInventoryFragment(';
    const fragment = prefix + 'x'.repeat(1024 * 1024 - prefix.length - 1) + ')';
    const entity = JSON.stringify(saveEntity('Storage/DA_Storage.DA_Storage', 0, [fragment]));
    const parser = createSaveJsonParser(extractionContext), encode = new TextEncoder();
    parser.write(encode.encode('{"itemData":{"Mass":{"entities":{'));
    const write = (index: number) => parser.write(encode.encode(`${index ? ',' : ''}"(ID=${index})":${entity}`));
    // The former 16 Mi-character budget must no longer reject these retained fragments.
    for (let index = 0; index < 20; index++) write(index);
    expect(() => { for (let index = 20; index < 70; index++) write(index); }).toThrow(expect.objectContaining({ code: 'complexity', diagnostic: {
        subcode: 'projection-chars', actual: expect.any(Number), limit: 64 * 1024 * 1024,
    } }));
});
