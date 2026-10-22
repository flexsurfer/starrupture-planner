// @vitest-environment node
import { expect, it } from 'vitest';
import { createSaveJsonParser } from './stream-json';
import { analyzeSave } from './analyze';
import { extractionContext, extractionFixture, saveFixture, snapshotFixture, transportFixture, saveEntity, heliumItemAsset } from './test-fixture';

function parse(text: string, chunkSize = 4096) {
    const parser = createSaveJsonParser(extractionContext);
    const bytes = new TextEncoder().encode(text);
    for (let offset = 0; offset < bytes.length; offset += chunkSize) parser.write(bytes.subarray(offset, offset + chunkSize));
    return parser.end();
}

it.each([saveFixture, transportFixture, extractionFixture, snapshotFixture].map(fixture => ({ name: fixture.name, fixture })))('matches the full analyzer for $name', ({ fixture }) => {
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

it('still rejects more than 100,000 retained records in a collection', () => {
    const input = { itemData: { Mass: { entities: {}, electricitySubsystemState: {
        nodeData: Object.fromEntries(Array.from({ length: 100_001 }, (_, index) => [`(UId=(ID=${index}))`, null])),
    } } } };
    expect(() => parse(JSON.stringify(input))).toThrow('complexity');
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
    expect(() => parse(`{"ignored":${'['.repeat(129)}`)).toThrow('complexity');
    const parser = createSaveJsonParser(extractionContext);
    const bytes = new TextEncoder();
    parser.write(bytes.encode('{"ignored":"'));
    const chunk = bytes.encode('a'.repeat(64 * 1024));
    expect(() => { for (let i = 0; i < 130; i++) parser.write(chunk); }).toThrow('complexity');
});

it('preserves fragment-count and fragment-size checks before discarding running state', () => {
    for (const fragments of [Array.from({ length: 4097 }, () => 'unused'), ['a'.repeat(1024 * 1024 + 1)]]) {
        const save = saveFixture();
        save.itemData.Mass.entities['(ID=10)'].fragmentValues = fragments;
        expect(() => parse(JSON.stringify(save))).toThrow('complexity');
    }
});

it('bounds selected records, unexpected timestamp containers and retained object keys', () => {
    const encode = (text: string) => new TextEncoder().encode(text);
    for (const prefix of ['{"timestamp":[', '{"itemData":{"Mass":{"entities":{"(ID=1)":{"ignored":[']) {
        const parser = createSaveJsonParser(extractionContext);
        parser.write(encode(prefix));
        const chunk = encode(`${JSON.stringify('x'.repeat(64 * 1024))},`);
        expect(() => { for (let i = 0; i < 140; i++) parser.write(chunk); }).toThrow('complexity');
    }
    expect(() => parse(`{"${'k'.repeat(2049)}":0}`)).toThrow('complexity');
    const parser = createSaveJsonParser(extractionContext);
    parser.write(encode('{"ignored":{'));
    expect(() => {
        for (let i = 0; i < 2200; i++) parser.write(encode(`${JSON.stringify(`${i}-${'k'.repeat(2040)}`)}:0,`));
    }).toThrow('complexity');
});
