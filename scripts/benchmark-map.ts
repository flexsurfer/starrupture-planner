// Local browser benchmark. Only included by benchmark-map.config.ts.
// Uses the imported save already in this browser and normal DOM interactions.
const panel = document.createElement('details');
panel.id = 'map-performance';
panel.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:10000;background:#111;color:white;padding:8px;max-height:60vh;overflow:auto;font:12px monospace';
panel.innerHTML = '<summary>Local map benchmark</summary><button type="button">Run map benchmark</button><pre>Ready</pre>';
document.body.append(panel);
const output = panel.querySelector('pre')!;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const frame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));
const paint = async () => { await frame(); await frame(); };
const query = <T extends Element>(selector: string) => {
    const element = document.querySelector<T>(selector);
    if (!element) throw new Error(`Missing ${selector}`);
    return element;
};
const stats = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return { samples: values.length, medianMs: +sorted[Math.floor(sorted.length / 2)].toFixed(1),
        p95Ms: +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))].toFixed(1), maxMs: +sorted.at(-1)!.toFixed(1) };
};
const counts = () => ({ nodes: document.querySelectorAll('.save-map .react-flow__node').length,
    buildings: document.querySelectorAll('.save-map-marker:not(.is-core)').length,
    handles: document.querySelectorAll('.save-map .react-flow__handle').length,
    elements: document.querySelectorAll('.save-map-canvas *').length,
    transform: document.querySelector<HTMLElement>('.save-map .react-flow__viewport')?.style.transform });
const selectCore = (value: string) => {
    const select = query<HTMLSelectElement>('.save-map-focus select');
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
};
const measure = async (action: () => void) => { const start = performance.now(); action(); await paint(); return performance.now() - start; };
panel.querySelector('button')!.onclick = async () => {
    panel.querySelector('button')!.disabled = true;
    const results: Record<string, unknown> = {};
    output.textContent = 'Running';
    const longTasks: { start: number; duration: number }[] = [];
    const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) longTasks.push({ start: entry.startTime, duration: entry.duration });
    });
    observer.observe({ type: 'longtask', buffered: false });
    try {
        selectCore(''); await wait(1000); await paint();
        results.overview = counts();
        const coreName = new URLSearchParams(location.search).get('benchmarkCore') ?? 'Core 1';
        const core = [...query<HTMLSelectElement>('.save-map-focus select').options].find(option => option.textContent === coreName)!.value;
        results.coreName = coreName;
        for (const gesture of ['pan', 'zoom']) {
            const pane = query<HTMLElement>('.save-map .react-flow__pane');
            const rect = pane.getBoundingClientRect();
            const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
            const start = performance.now();
            const intervals: number[] = [];
            let previous = await frame();
            if (gesture === 'pan') pane.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, view: window, button: 0, buttons: 1, clientX: x, clientY: y }));
            for (let i = 0; i < 60; i++) {
                if (gesture === 'pan') window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, view: window, buttons: 1, clientX: x + Math.sin(i / 10) * 80, clientY: y + Math.sin(i / 10) * 40 }));
                else pane.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: i < 30 ? -5 : 5 }));
                const now = await frame(); intervals.push(now - previous); previous = now;
            }
            if (gesture === 'pan') window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, view: window, button: 0 }));
            await wait(300);
            results[gesture] = { ...stats(intervals), framesOver33ms: intervals.filter(ms => ms > 33.4).length,
                longTasks: longTasks.filter(entry => entry.start >= start).map(entry => +entry.duration.toFixed(1)) };
        }
        selectCore(core); await wait(1000); await paint();
        results.core = counts();
        const selectionTimes: number[] = [];
        const ids: string[] = [];
        for (let i = 0; i < 12; i++) {
            const buttons = [...document.querySelectorAll<HTMLButtonElement>('.save-map-marker:not(.is-core)')];
            const button = buttons.find(element => element.getAttribute('aria-pressed') !== 'true');
            if (!button) throw new Error('No building to select');
            ids.push(button.closest<HTMLElement>('.react-flow__node')!.dataset.id!);
            selectionTimes.push(await measure(() => button.click()));
            if (button.getAttribute('aria-pressed') !== 'true') throw new Error('Selection did not commit before the timing sample ended');
            await wait(100);
        }
        results.selection = { ...stats(selectionTimes), ids };
        // The Core fit is below the detail threshold. Zoom normally until level controls appear.
        for (let i = 0; i < 8 && !document.querySelector('.save-map-levels'); i++) {
            query<HTMLButtonElement>('.save-map .react-flow__controls-zoomin').click(); await wait(250);
        }
        const levelTimes: number[] = [];
        for (let i = 0; i < 12; i++) {
            const buttons = [...query<HTMLElement>('.save-map-levels').querySelectorAll('button')];
            const button = buttons[i % 2]!.disabled ? buttons.find(element => !element.disabled)! : buttons[i % 2]!;
            const previousLevel = query<HTMLElement>('.save-map-levels output').textContent;
            levelTimes.push(await measure(() => button.click()));
            if (query<HTMLElement>('.save-map-levels output').textContent === previousLevel) throw new Error('Level did not change');
            await wait(100);
        }
        results.level = stats(levelTimes);
        results.detail = counts();
        selectCore(''); await wait(1000); await paint();
        results.finalOverview = counts();
        results.longTasks = { count: longTasks.length, totalMs: +longTasks.reduce((sum, entry) => sum + entry.duration, 0).toFixed(1) };
        output.textContent = JSON.stringify(results, null, 2);
    } catch (error) { output.textContent = JSON.stringify({ ...results, error: String(error) }, null, 2); }
    finally { observer.disconnect(); panel.querySelector('button')!.disabled = false; }
};
