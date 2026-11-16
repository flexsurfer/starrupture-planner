// @vitest-environment node
import { gzipSync, gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { analyzeSave } from './decoder/analyze';
import { extractionContext, snapshotFixture, storageFixture } from './decoder/test-fixture';
import { createSaveWorkspace } from './workspace';
import { decodeSaveWorkspaces, encodeSaveWorkspaces, isCompressedSaveStorage } from './storage-codec';
import { deserializeSaveWorkspaces, localStorageBytes, saveCollectionStorageBytes, serializeSaveWorkspaces } from './storage-schema';
import { MAX_DECODED_SAVES_BYTES, MAX_SAVES_BYTES, SaveWorkspaceLimitError } from './storage-limits';
import type { SaveBuildingConfiguration } from './snapshot';
import { workspaceWithUnicodeNames } from './storage-test-fixture';

const record = () => ({ one: createSaveWorkspace('one', '工場 🏭 — Łódź', analyzeSave(snapshotFixture(), extractionContext)),
    two: createSaveWorkspace('two', 'Inventory', analyzeSave(storageFixture(), extractionContext)) });

it('stores interoperable gzip with deterministic bytes and measures the complete UTF-16 envelope', () => {
    const workspaces = record();
    const data = serializeSaveWorkspaces(workspaces);
    if (!isCompressedSaveStorage(data)) throw new Error('Expected compressed fixture');
    const bytes = Buffer.from(data.payload, 'base64');
    expect(data).toMatchObject({ encoding: 'gzip-base64', version: 1 });
    expect(bytes.readUInt32LE(4)).toBe(0); // No wall-clock timestamp in the gzip header.
    expect(JSON.parse(gunzipSync(bytes).toString('utf8'))).toStrictEqual(workspaces);
    expect(serializeSaveWorkspaces(workspaces)).toStrictEqual(data);
    expect(saveCollectionStorageBytes(workspaces)).toBe(JSON.stringify({ v: 1, data }).length * 2);
    expect(saveCollectionStorageBytes(workspaces)).toBeLessThan(localStorageBytes({ v: 1, data: workspaces }));
});

it('preserves every configuration, Unicode, nulls, full coordinate precision, and workspace metadata', () => {
    const workspaces = record();
    workspaces.two.isDemo = true;
    const core = workspaces.one.snapshot.cores[0];
    core.name = '核心 🏭\u0000"\\\n';
    core.spawnTimeSeconds = 123456.123456789;
    core.bounds = null;
    const configurations: SaveBuildingConfiguration[] = [
        { kind: 'production', recipeId: 'smelter:recipe' }, { kind: 'production', recipeId: null },
        { kind: 'extractor', itemId: 'helium', nodePurity: 'impure' }, { kind: 'extractor', itemId: null, nodePurity: null },
        { kind: 'dispatcher', itemId: 'helium', receiverId: 1005 }, { kind: 'receiver' },
        { kind: 'dispatcher', itemId: null, receiverId: null },
        { kind: 'launcher', itemId: 'helium' }, { kind: 'launcher', itemId: null },
        { kind: 'storage', items: { helium: 0xffffffff, calcite_sheets: 1 }, complete: true,
            space: { freeByItem: { helium: 0, calcite_sheets: 99 }, flexibleSlots: 2, unrestrictedSlots: 2 } },
        { kind: 'storage', items: {}, complete: false, space: null }, { kind: 'other' },
    ];
    core.buildings = configurations.map((configuration, index) => ({ id: 1000 + index, name: index ? null : 'Łódź 工場 🏭',
        buildingTypeId: 'smelter', powerNetworkId: index ? null : 123,
        position: { x: -123456.123456789, y: 0.0000000001234, z: 1500.25 }, configuration }));
    const stored = JSON.parse(JSON.stringify({ v: 1, data: serializeSaveWorkspaces(workspaces) }));
    const restored = deserializeSaveWorkspaces(stored.data);
    expect(restored).toStrictEqual(workspaces);
    expect(restored.one.snapshot).not.toBe(workspaces.one.snapshot);
    expect(restored.one.snapshot.cores[0].buildings).not.toBe(core.buildings);
});

it('reads existing plain workspace records, including a workspace whose ID is encoding', () => {
    const one = record().one;
    one.id = 'encoding';
    const legacy = { encoding: one };
    expect(deserializeSaveWorkspaces(JSON.parse(JSON.stringify(legacy)))).toStrictEqual(legacy);
});

it('does not cache ordinary mutable inputs to the public serializer', () => {
    const workspaces = record();
    serializeSaveWorkspaces(workspaces);
    workspaces.one.name = 'Changed name';
    workspaces.one.snapshot.cores[0].buildings[0].position.x += 100;
    const stored = serializeSaveWorkspaces(workspaces);
    expect(deserializeSaveWorkspaces(stored)).toStrictEqual(workspaces);
});

it('retains plain JSON when Unicode makes gzip/base64 exceed the storage budget', () => {
    const workspaces = { one: workspaceWithUnicodeNames() };
    const rawBytes = localStorageBytes({ v: 1, data: workspaces });
    const gzipBytes = localStorageBytes({ v: 1, data: encodeSaveWorkspaces(workspaces) });
    expect(rawBytes).toBeLessThan(MAX_SAVES_BYTES);
    expect(gzipBytes).toBeGreaterThan(MAX_SAVES_BYTES);
    expect(deserializeSaveWorkspaces(JSON.parse(JSON.stringify(workspaces)))).toStrictEqual(workspaces);
    expect(serializeSaveWorkspaces(workspaces)).toStrictEqual(workspaces);
    expect(saveCollectionStorageBytes(workspaces)).toBe(rawBytes);
});

it.each([
    { encoding: 'gzip-base64', version: 2, payload: '' },
    { encoding: 'unknown', version: 1, payload: '' },
    { encoding: 'gzip-base64', version: 1, payload: 123 },
    { encoding: 'gzip-base64', version: 1, payload: '!invalid!' },
    { encoding: 'gzip-base64', version: 1, payload: btoa('not gzip') },
])('rejects unsupported or malformed encodings: %j', data => {
    expect(() => deserializeSaveWorkspaces(data)).toThrow();
});

it.each(['truncated', 'checksum', 'size', 'oversized'] as const)('rejects a %s gzip stream', corruption => {
    const data = encodeSaveWorkspaces(record());
    const bytes = Buffer.from(data.payload, 'base64');
    if (corruption === 'checksum') bytes[bytes.length - 8] ^= 1;
    if (corruption === 'size') bytes.writeUInt32LE(bytes.readUInt32LE(bytes.length - 4) + 1, bytes.length - 4);
    if (corruption === 'oversized') bytes.writeUInt32LE(MAX_DECODED_SAVES_BYTES + 1, bytes.length - 4);
    data.payload = (corruption === 'truncated' ? bytes.subarray(0, -5) : bytes).toString('base64');
    expect(() => decodeSaveWorkspaces(data)).toThrow(corruption === 'oversized' ? SaveWorkspaceLimitError : Error);
});

it('rejects data expanding beyond a forged trailer, even when the truncated prefix has a valid checksum', () => {
    const json = JSON.stringify(record());
    const prefix = gzipSync(json);
    const bytes = gzipSync(json + ' '.repeat(1000));
    bytes.set(prefix.subarray(-8), bytes.length - 8);
    expect(() => decodeSaveWorkspaces({ encoding: 'gzip-base64', version: 1, payload: bytes.toString('base64') })).toThrow();
});

it('rejects oversized encoded payloads and still validates the decoded workspace schema', () => {
    expect(() => decodeSaveWorkspaces({ encoding: 'gzip-base64', version: 1, payload: 'A'.repeat(MAX_SAVES_BYTES / 2) }))
        .toThrow(SaveWorkspaceLimitError);
    const payload = gzipSync(JSON.stringify({ one: { schemaVersion: 99 } })).toString('base64');
    expect(() => deserializeSaveWorkspaces({ encoding: 'gzip-base64', version: 1, payload })).toThrow();
});
