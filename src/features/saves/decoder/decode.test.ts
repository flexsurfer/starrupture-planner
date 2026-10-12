// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { decodeSave, MAX_DECODED_SAVE_BYTES } from './decode';
import { analyzeSave } from './analyze';
import { extractionContext, saveFixture } from './test-fixture';

function encode(value: unknown, declaredSize?: number): ArrayBuffer {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const header = Buffer.alloc(4);
    header.writeUInt32LE(declaredSize ?? Buffer.byteLength(text));
    return Uint8Array.from(Buffer.concat([header, deflateSync(text)])).buffer;
}
it('decodes the supported container directly into the app snapshot', async () => {
    const snapshot = await decodeSave(encode(saveFixture()), extractionContext);
    expect(snapshot).toEqual(analyzeSave(saveFixture(), extractionContext));
    expect(snapshot.cores.map(core => core.buildings.map(building => building.id))).toEqual([[10], [11]]);
    expect(Object.keys(snapshot).sort()).toEqual(['cores', 'gameData', 'savedAt', 'schemaVersion']);
});
it.each([
    ['invalid JSON', '{bad', undefined, 'structure'],
    ['unrelated JSON', { bases: [] }, undefined, 'structure'],
    ['oversized header', {}, MAX_DECODED_SAVE_BYTES + 1, 'decoded-size'],
    ['understated header', saveFixture(), 1, 'size-mismatch'],
    ['overstated header', {}, 10, 'size-mismatch'],
    ['unsupported format', { ...saveFixture(), version: 1 }, undefined, 'mapping-version'],
])('rejects %s', async (_name, value, size, error) => {
    await expect(decodeSave(encode(value, size), extractionContext)).rejects.toMatchObject({ code: error });
});
it('rejects truncated zlib data and honors cancellation', async () => {
    const bytes = encode(saveFixture());
    await expect(decodeSave(bytes.slice(0, -5), extractionContext)).rejects.toMatchObject({ code: 'compression' });
    await expect(decodeSave(bytes, extractionContext, AbortSignal.abort())).rejects.toMatchObject({ name: 'AbortError' });
});
