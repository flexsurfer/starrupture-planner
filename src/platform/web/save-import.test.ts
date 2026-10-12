import { afterEach, expect, it, vi } from 'vitest';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { saveContext, saveDataContext, saveFixture } from '@/features/saves/decoder/test-fixture';
import { readSaveInWorker } from './save-import';

class TestWorker {
    static instances: TestWorker[] = [];
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    onmessageerror: (() => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();
    constructor() { TestWorker.instances.push(this); }
}
afterEach(() => { TestWorker.instances = []; vi.unstubAllGlobals(); vi.useRealTimers(); });
const request = () => ({ ...saveDataContext, requestId: 1, targetWorkspaceId: null, file: { name: 'sample.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) } });

it('transfers bytes to a worker, returns its report, and releases the worker', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const pending = readSaveInWorker(request(), new AbortController().signal);
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
    const worker = TestWorker.instances[0];
    const [payload, transfer] = worker.postMessage.mock.calls[0];
    expect(payload.context).toEqual(saveDataContext);
    expect(transfer).toEqual([payload.bytes]);
    const report = analyzeSave(saveFixture(), saveContext);
    worker.onmessage?.({ data: { report } } as MessageEvent);
    await expect(pending).resolves.toEqual(report);
    expect(worker.terminate).toHaveBeenCalledOnce();
});

it('terminates a running worker on cancellation', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const controller = new AbortController();
    const pending = readSaveInWorker(request(), controller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'read' });
    await vi.waitFor(() => expect(TestWorker.instances).toHaveLength(1));
    controller.abort();
    await rejected;
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
});

it('bounds slow reads and prevents workers starting after cancellation', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', TestWorker);
    let finishRead!: (bytes: ArrayBuffer) => void;
    const source = request();
    source.file.arrayBuffer = () => new Promise(resolve => { finishRead = resolve; });
    const pending = readSaveInWorker(source, new AbortController().signal);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    finishRead(new ArrayBuffer(10));
    await Promise.resolve();
    expect(TestWorker.instances).toHaveLength(0);
});
