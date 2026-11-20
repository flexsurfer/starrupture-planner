// @vitest-environment node
import { deflateSync, type ZlibOptions } from 'node:zlib';
import { expect, it, vi } from 'vitest';
import { decodeSave, MAX_DECODED_SAVE_BYTES } from './decode';
import { analyzeSave } from './analyze';
import { extractionContext, saveFixture, storageFixture } from './test-fixture';

function encode(value: unknown, declaredSize?: number, options?: ZlibOptions): ArrayBuffer {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(declaredSize ?? Buffer.byteLength(text));
    return Uint8Array.from(Buffer.concat([header, deflateSync(text, options)])).buffer;
}

it.each(['GVAS', '{"timestamp":"synthetic"}', '<html>not a save</html>'])('rejects a 2,119-byte %s file before interpreting a size or opening its payload', async prefix => {
    const bytes = Buffer.alloc(2119);
    bytes.write(prefix);
    const file = new Blob([bytes]);
    const slice = vi.spyOn(file, 'slice');
    const failure = await decodeSave(file, extractionContext).catch(error => error);
    expect(failure).toMatchObject({ code: 'format', diagnostic: {
        phase: 'header', decodedBytes: 0, decodedLimitBytes: MAX_DECODED_SAVE_BYTES,
    } });
    expect(slice).toHaveBeenCalledExactlyOnceWith(0, 6);
    expect(failure.diagnostic).not.toHaveProperty('declaredBytes');
});

it.each([
    ['compression method', 0x79, 0], ['window size', 0x88, 0], ['preset dictionary', 0x78, 0x20],
] as const)('rejects an unsupported zlib %s even with a correct header checksum', async (_name, cmf, flags) => {
    const bytes = new Uint8Array(encode(saveFixture(), MAX_DECODED_SAVE_BYTES + 1));
    bytes[4] = cmf;
    bytes[5] = flags + (31 - ((cmf << 8) + flags) % 31) % 31;
    await expect(decodeSave(bytes.buffer, extractionContext)).rejects.toMatchObject({ code: 'format' });
});

it('rejects a zlib header checksum error before checking the declared size', async () => {
    const bytes = new Uint8Array(encode(saveFixture(), MAX_DECODED_SAVE_BYTES + 1));
    bytes[5] ^= 1;
    await expect(decodeSave(bytes.buffer, extractionContext)).rejects.toMatchObject({ code: 'format' });
});

it.each([0, 1, 6, 9])('accepts valid zlib headers at compression level %s', async level => {
    expect(await decodeSave(encode(saveFixture(), undefined, { level }), extractionContext))
        .toEqual(analyzeSave(saveFixture(), extractionContext));
});

it.each([[0, 'size-header'], [MAX_DECODED_SAVE_BYTES + 1, 'declared-size']] as const)(
    'reports a declared size of %s without claiming bytes were unpacked', async (declaredBytes, code) => {
        await expect(decodeSave(encode(saveFixture(), declaredBytes), extractionContext)).rejects.toMatchObject({ code, diagnostic: {
            phase: 'header', declaredBytes, decodedBytes: 0, decodedLimitBytes: MAX_DECODED_SAVE_BYTES,
        } });
    });

it('reports the observed length separately when a recognized header disagrees with the payload', async () => {
    const fixture = saveFixture();
    const decodedBytes = Buffer.byteLength(JSON.stringify(fixture));
    await expect(decodeSave(encode(fixture, decodedBytes + 1), extractionContext)).rejects.toMatchObject({ code: 'size-mismatch', diagnostic: {
        phase: 'decompression', declaredBytes: decodedBytes + 1, decodedBytes, decodedLimitBytes: MAX_DECODED_SAVE_BYTES,
    } });
});

it('distinguishes parsing failures from decompression failures in diagnostics', async () => {
    await expect(decodeSave(encode('{bad'), extractionContext)).rejects.toMatchObject({ code: 'structure', diagnostic: {
        phase: 'parse', declaredBytes: 4, decodedBytes: 4, decodedLimitBytes: MAX_DECODED_SAVE_BYTES,
    } });
    await expect(decodeSave(encode(saveFixture()).slice(0, -5), extractionContext)).rejects.toMatchObject({ code: 'compression', diagnostic: {
        phase: 'decompression', declaredBytes: Buffer.byteLength(JSON.stringify(saveFixture())), decodedLimitBytes: MAX_DECODED_SAVE_BYTES,
    } });
});
it('decodes the supported container directly into the app snapshot', async () => {
    const snapshot = await decodeSave(encode(saveFixture()), extractionContext);
    expect(snapshot).toEqual(analyzeSave(saveFixture(), extractionContext));
    expect(snapshot.cores.map(core => core.buildings.map(building => building.id))).toEqual([[10], [11]]);
    expect(Object.keys(snapshot).sort()).toEqual(['cores', 'gameData', 'savedAt', 'schemaVersion']);
});
it('preserves the analyzer diagnostic through decompression and distinguishes long names from timestamps', async () => {
    for (const field of ['name', 'timestamp'] as const) {
        const save = saveFixture();
        if (field === 'name') save.itemData.CrBuildingCustomNameSubsystem.customNames['(ID=1)'] = 'x'.repeat(513);
        else save.timestamp = 'x'.repeat(513);
        await expect(decodeSave(encode(save), extractionContext)).rejects.toMatchObject({ code: 'complexity', diagnostic: {
            subcode: field === 'name' ? 'building-name-chars' : 'timestamp-chars', actual: 513, limit: 512,
        } });
    }
});
it('retains only the physical stock in the main inventory of each storage building', async () => {
    const snapshot = await decodeSave(encode(storageFixture()), extractionContext);
    const byId = new Map(snapshot.cores.flatMap(core => core.buildings.map(b => [b.id, b.configuration] as const)));
    expect(byId.get(50)).toEqual({ kind: 'storage', items: { helium: 37 }, complete: true, space: { freeByItem: { helium: 163, calcite_sheets: 100 }, flexibleSlots: 0, unrestrictedSlots: 0 } });
    expect(byId.get(51)).toEqual({ kind: 'storage', items: { helium: 5, calcite_sheets: 11 }, complete: true, space: { freeByItem: { helium: 95, calcite_sheets: 89 }, flexibleSlots: 0, unrestrictedSlots: 0 } });
    expect(byId.get(52)).toEqual({ kind: 'storage', items: { calcite_sheets: 7, helium: 100 }, complete: true, space: { freeByItem: { calcite_sheets: 93, helium: 0 }, flexibleSlots: 0, unrestrictedSlots: 0 } });
    expect(byId.get(53)).toEqual({ kind: 'storage', items: {}, complete: true, space: { freeByItem: {}, flexibleSlots: 0, unrestrictedSlots: 0 } });
    expect(byId.get(55)).toEqual({ kind: 'production', recipeId: null });
});
it.each([
    ['invalid JSON', '{bad', undefined, 'structure'],
    ['unrelated JSON', { bases: [] }, undefined, 'structure'],
    ['oversized header', {}, MAX_DECODED_SAVE_BYTES + 1, 'declared-size'],
    ['understated header', saveFixture(), 1, 'size-mismatch'],
    ['overstated header', {}, 10, 'size-mismatch'],
    ['unsupported format', { ...saveFixture(), version: 1 }, undefined, 'mapping-version'],
])('rejects %s', async (_name, value, size, error) => {
    await expect(decodeSave(encode(value, size), extractionContext)).rejects.toMatchObject({ code: error });
});
it('accepts a declared 1 GiB at the size gate and still verifies its actual length', async () => {
    expect(MAX_DECODED_SAVE_BYTES).toBe(1024 * 1024 * 1024);
    await expect(decodeSave(encode(saveFixture(), 1024 * 1024 * 1024), extractionContext))
        .rejects.toMatchObject({ code: 'size-mismatch' });
});
it('rejects truncated zlib data and honors cancellation', async () => {
    const bytes = encode(saveFixture());
    await expect(decodeSave(bytes.slice(0, -5), extractionContext)).rejects.toMatchObject({ code: 'compression' });
    await expect(decodeSave(bytes, extractionContext, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
});

it('streams a Blob without reading the whole file into an ArrayBuffer', async () => {
    const file = new Blob([encode(saveFixture())]);
    const read = vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('Whole file must not be read'));
    expect(await decodeSave(file, extractionContext)).toEqual(analyzeSave(saveFixture(), extractionContext));
    expect(read).not.toHaveBeenCalled();
});

it('rejects malformed UTF-8 instead of silently replacing bytes', async () => {
    const text = Buffer.from(JSON.stringify({ ...saveFixture(), ignored: 'X' }));
    text[text.lastIndexOf('X')] = 0xff;
    const header = Buffer.alloc(4);
    header.writeUInt32LE(text.byteLength);
    const bytes = Uint8Array.from(Buffer.concat([header, deflateSync(text)])).buffer;
    await expect(decodeSave(bytes, extractionContext)).rejects.toMatchObject({ code: 'compression' });
});
