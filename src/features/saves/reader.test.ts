import { expect, it, vi } from 'vitest';
import { MAX_SAVE_BYTES, readSaveFile } from './reader';

it.each([['wrong.json', 10, 'extension'], ['world.sav', MAX_SAVE_BYTES + 1, 'file-size'], ['world.sav', 2, 'compression']])('rejects %s before reading', async (name, size, code) => {
    const arrayBuffer = vi.fn();
    await expect(readSaveFile({ name: String(name), size: Number(size), arrayBuffer })).rejects.toMatchObject({ code });
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
