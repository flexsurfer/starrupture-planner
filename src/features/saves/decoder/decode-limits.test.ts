// @vitest-environment node
import { deflateSync } from 'node:zlib';
import { expect, it, vi } from 'vitest';
import { decodeSave, MAX_DECODED_SAVE_BYTES } from './decode';
import { analyzeSave } from './analyze';
import { extractionContext, saveFixture } from './test-fixture';

// Exercise real streamed decompression at the boundary without expanding a GiB
// during every unit-test run. The production threshold is checked in decode.test.
vi.mock('../import-limits', async importOriginal => ({
    ...await importOriginal<typeof import('../import-limits')>(),
    MAX_DECODED_SAVE_BYTES: 64 * 1024,
}));

function paddedSave(actualBytes: number, declaredBytes = actualBytes): ArrayBuffer {
    const json = Buffer.from(JSON.stringify(saveFixture()));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(declaredBytes);
    const bytes = Buffer.concat([json, Buffer.alloc(actualBytes - json.byteLength, 32)]);
    return Uint8Array.from(Buffer.concat([header, deflateSync(bytes)])).buffer;
}

it('accepts actual decompressed bytes exactly at the limit', async () => {
    expect(await decodeSave(paddedSave(MAX_DECODED_SAVE_BYTES), extractionContext))
        .toEqual(analyzeSave(saveFixture(), extractionContext));
});

it('rejects actual output over the limit even when its declared length is allowed', async () => {
    await expect(decodeSave(paddedSave(MAX_DECODED_SAVE_BYTES + 1, MAX_DECODED_SAVE_BYTES), extractionContext))
        .rejects.toMatchObject({ code: 'decoded-size', diagnostic: {
            phase: 'decompression', declaredBytes: MAX_DECODED_SAVE_BYTES,
            decodedBytes: MAX_DECODED_SAVE_BYTES + 1, decodedLimitBytes: MAX_DECODED_SAVE_BYTES,
        } });
});
