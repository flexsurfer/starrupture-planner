// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { analyzeSave } from './analyze';
import { decodeSave } from './decode';
import { createSaveJsonParser } from './stream-json';
import { extractionContext, saveEntity, saveFixture, snapshotFixture } from './test-fixture';
import { createSaveWorkspace } from '../workspace';
import { MAX_SAVES_BYTES, saveCollectionStorageBytes, serializeSaveWorkspaces, deserializeSaveWorkspaces } from '../storage-schema';

function encode(text: string): ArrayBuffer {
    const header = Buffer.alloc(4);
    header.writeUInt32LE(Buffer.byteLength(text));
    return Uint8Array.from(Buffer.concat([header, deflateSync(text)])).buffer;
}

it.each([true, false])('imports 150,000 unrelated electricity nodes with an identical snapshot (metadata first: %s)', async metadataFirst => {
    const save = snapshotFixture();
    const expected = analyzeSave(save, extractionContext);
    const mass = save.itemData.Mass;
    mass.electricitySubsystemState.nodeData = {
        ...Object.fromEntries(Array.from({ length: 150_000 }, (_, index) => [`(UId=(ID=${index + 1000000}))`, {
            handle: { iD: index + 1000000 }, subGraph: { subGraphId: index % 100 },
        }])),
        ...mass.electricitySubsystemState.nodeData,
    };
    const { entities, electricitySubsystemState } = mass;
    save.itemData.Mass = metadataFirst ? { electricitySubsystemState, entities } : { entities, electricitySubsystemState };
    expect(analyzeSave(save, extractionContext)).toEqual(expected);
    const json = JSON.stringify(save);
    const parser = createSaveJsonParser(extractionContext);
    parser.write(new TextEncoder().encode(json));
    const projection = parser.end();
    expect(JSON.stringify(projection).length).toBeLessThan(50_000);
    expect(analyzeSave(projection, extractionContext)).toEqual(expected);
    expect(await decodeSave(encode(json), extractionContext)).toEqual(expected);
}, 20_000);

it('imports 400,000 discarded entities without exhausting the old active-key budget', () => {
    const save = saveFixture(), parser = createSaveJsonParser(extractionContext), encoder = new TextEncoder();
    const expected = analyzeSave(save, extractionContext);
    parser.write(encoder.encode('{"itemData":{"Mass":{"entities":{'));
    // Stream batches so the test itself does not retain a second dense world object.
    for (let start = 0; start < 400_000; start += 1000) {
        const entries = Array.from({ length: 1000 }, (_, offset) =>
            `"(ID=${1000000 + start + offset})":{"spawnData":{"entityConfigDataPath":"/World/Unused"}}`);
        parser.write(encoder.encode(`${start ? ',' : ''}${entries.join(',')}`));
    }
    const entities = JSON.stringify(save.itemData.Mass.entities);
    parser.write(encoder.encode(`,${entities.slice(1, -1)}},"electricitySubsystemState":${JSON.stringify(save.itemData.Mass.electricitySubsystemState)}}`));
    const metadata = Object.fromEntries(Object.entries(save.itemData).filter(([key]) => key !== 'Mass'));
    parser.write(encoder.encode(`,${JSON.stringify(metadata).slice(1, -1)}},"timestamp":${JSON.stringify(save.timestamp)}}`));
    const projection = parser.end();
    expect(JSON.stringify(projection).length).toBeLessThan(5000);
    expect(analyzeSave(projection, extractionContext)).toEqual(expected);
}, 20_000);

it('imports 5,000 production buildings with large unused inventories and preserves every snapshot field', async () => {
    const save = saveFixture();
    const slot = '(Item=(ItemDataBase="/Game/Chimera/Items/I_HeliumOre.I_HeliumOre",Count=100))';
    const inventory = `/Script/Chimera.CrInventoryFragment(OutputInventoryContainer=(Items=(${Array(50).fill(slot).join(',')})))`;
    Object.assign(save.itemData.Mass.entities, Object.fromEntries(Array.from({ length: 5000 }, (_, index) => [
        `(ID=${index + 1000})`, saveEntity('Smelter/DA_Smelter.DA_Smelter', index, [inventory]),
    ])));
    const expected = analyzeSave(save, extractionContext);
    const json = JSON.stringify(save);
    expect(json.length).toBeGreaterThan(16 * 1024 * 1024);
    const parser = createSaveJsonParser(extractionContext);
    parser.write(new TextEncoder().encode(json));
    const projection = parser.end();
    expect(JSON.stringify(projection).length).toBeLessThan(2 * 1024 * 1024);
    expect(analyzeSave(projection, extractionContext)).toEqual(expected);
    const snapshot = await decodeSave(encode(json), extractionContext);
    expect(snapshot).toEqual(expected);
    expect(snapshot.cores.reduce((sum, core) => sum + core.buildings.length, 0)).toBe(5002);
    const workspace = createSaveWorkspace('dense', 'Dense factory', snapshot);
    expect(saveCollectionStorageBytes({ dense: workspace })).toBeLessThan(MAX_SAVES_BYTES);
    const stored = JSON.parse(JSON.stringify(serializeSaveWorkspaces({ dense: workspace })));
    expect(deserializeSaveWorkspaces(stored).dense.snapshot).toStrictEqual(workspace.snapshot);
}, 20_000);
