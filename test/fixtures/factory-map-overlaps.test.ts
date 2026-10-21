// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { analyzeSave } from '../../src/features/saves/decoder/analyze';
import { decodeSave } from '../../src/features/saves/decoder/decode';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion, loadHeadlessSaveContext } from '../../src/platform/headless/game-data-loader';
import { factoryMapOverlapFixture } from './factory-map-overlaps';

it('imports the downloadable save with the production mappings and matches its documented scenarios', async () => {
    const dataVersion = 'update2_QoL';
    const catalog = gameDataBundleToAppVersioned(await loadHeadlessGameDataVersion(dataVersion));
    const context = await loadHeadlessSaveContext({ dataVersion, buildings: catalog.buildings, items: catalog.items });
    const bytes = Uint8Array.from(await readFile(new URL('./factory-map-overlaps.sav', import.meta.url)));
    const snapshot = await decodeSave(bytes.buffer, context);
    expect(snapshot).toEqual(analyzeSave(factoryMapOverlapFixture(), context));
    expect(snapshot.cores.map(core => core.buildings.length)).toEqual([8, 3, 8, 3, 10, 4, 4, 4]);
    for (const core of snapshot.cores) for (const building of core.buildings) {
        if (building.configuration.kind === 'production') expect(building.configuration.recipeId).toBeTruthy();
    }
    expect(snapshot.cores[0].buildings.every(building => building.configuration.kind === 'production'
        && building.configuration.recipeId === 'fabricator:3')).toBe(true);
});
