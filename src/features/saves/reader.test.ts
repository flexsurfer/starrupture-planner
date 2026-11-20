import { expect, it, vi } from 'vitest';
import { MAX_SAVE_BYTES, readSaveFile } from './reader';
import { MAX_DECODED_SAVE_BYTES } from './import-limits';

it.each([['wrong.json', 10, 'extension'], ['SaveData.dat', 2119, 'extension'], ['0.met', 2119, 'extension'],
    ['world.sav', MAX_SAVE_BYTES + 1, 'file-size'], ['world.sav', 2, 'format']])('rejects %s before reading', async (name, size, code) => {
    const arrayBuffer = vi.fn();
    const failure = await readSaveFile({ name: String(name), size: Number(size), arrayBuffer }).catch(error => error);
    expect(failure).toMatchObject({ code });
    if (code === 'format') expect(failure.diagnostic).toEqual({ phase: 'header', decodedBytes: 0, decodedLimitBytes: MAX_DECODED_SAVE_BYTES });
    expect(arrayBuffer).not.toHaveBeenCalled();
});
it('returns bytes without interpreting them and verifies the reported file size', async () => {
    const bytes = new ArrayBuffer(12);
    await expect(readSaveFile({ name: 'WORLD.SAV', size: 12, arrayBuffer: async () => bytes })).resolves.toBe(bytes);
    await expect(readSaveFile({ name: 'world.sav', size: 10, arrayBuffer: async () => bytes })).rejects.toMatchObject({ code: 'read' });
});
it('does not publish a read that finished after cancellation', async () => {
    const controller = new AbortController();
    let finish!: (bytes: ArrayBuffer) => void;
    const pending = readSaveFile({ name: 'world.sav', size: 10, arrayBuffer: () => new Promise(resolve => { finish = resolve; }) }, controller.signal);
    controller.abort();
    finish(new ArrayBuffer(10));
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
});
