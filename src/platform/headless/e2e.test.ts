import { createTranslator, translateText } from '@/shared/i18n/core';
// @vitest-environment node

import {
    createUkladHeadlessScenario,
    type UkladHeadlessScenario,
    type UkladHeadlessViewQueries,
} from '@ukladjs/core/testing';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { AppVersionedGameData } from '@/app/uklad/model';
import { createAppRuntime } from '@/app/uklad/runtime';
import { DEFAULT_DATA_VERSION } from '@/features/app-shell/data-version';
import { registerHeadlessApplication, type HeadlessApplicationOptions } from './register';
import { parseArchive, prepareArchiveImport, type PlannerArchive } from '@/features/data-transfer/archive';
import { STANDARD_RECIPE_PRESET_ID, V2_RECIPE_PRESET_ID } from '@/features/planner/recipe-presets';
import { analyzeSave } from '@/features/saves/decoder/analyze';
import { saveGameData, extractionContext, snapshotFixture, transportFixture } from '@/features/saves/decoder/test-fixture';
import { memoryStorageAdapter, persist } from '@ukladjs/persist';
import { PERSIST_KEYS } from '@/platform/web/persistence';

type AppScenario = UkladHeadlessScenario<AppContracts>;
type AppEvent = Parameters<AppScenario['dispatch']>[0];

const TEST_GAME_DATA = {
    items: [
        { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
        { id: 'iron-plate', name: 'Iron Plate', type: 'processed' },
        { id: 'steel-plate', name: 'Steel Plate', type: 'component' },
    ],
    buildings: [
        {
            id: 'base_core',
            name: 'Base Core',
            type: 'infrastructure',
            levels: [
                { level: 0, heatCapacity: 100 },
                { level: 1, heatCapacity: 200 },
            ],
        },
        {
            id: 'ore_excavator',
            name: 'Ore Excavator',
            type: 'production',
            power: 5,
            heat: 2,
            recipes: [{
                output: { id: 'iron-ore', amount_per_minute: 60 },
                inputs: [],
            }],
        },
        {
            id: 'smelter',
            name: 'Smelter',
            type: 'production',
            upgrade: 'smelter_mk2',
            power: 10,
            heat: 5,
            recipes: [{
                output: { id: 'iron-plate', amount_per_minute: 60 },
                inputs: [{ id: 'iron-ore', amount_per_minute: 60 }],
            }],
        },
        {
            id: 'smelter_mk2',
            name: 'Smelter Mk.2',
            type: 'production',
            power: 18,
            heat: 8,
            recipes: [{
                output: { id: 'iron-plate', amount_per_minute: 120 },
                inputs: [{ id: 'iron-ore', amount_per_minute: 120 }],
            }],
        },
        {
            id: 'assembler',
            name: 'Assembler',
            type: 'production',
            power: 15,
            heat: 7,
            recipes: [{
                output: { id: 'steel-plate', amount_per_minute: 30 },
                inputs: [{ id: 'iron-plate', amount_per_minute: 60 }],
            }],
        },
        { id: 'package_receiver', name: 'Package Receiver', type: 'storage', power: 1 },
        { id: 'power_generator', name: 'Power Generator', type: 'generator', power: 100, heat: 2 },
        { id: 'base_core_amplifier_v1', name: 'Core Amplifier', type: 'temperature', coreHeatCapacity: 50 },
        { id: 'turret', name: 'Turret', type: 'defense', power: 4, heat: 3 },
        { id: 'orbital_cargo_launcher', name: 'Orbital Cargo Launcher', type: 'storage', power: 20, heat: 10 },
    ],
    corporations: {
        Miners: {
            id: 'miners',
            levels: [{
                level: 1,
                xp: 100,
                components: [
                    { id: 'iron-plate', points: 2 },
                    { id: 'steel-plate', points: 4 },
                ],
                rewards: [{ name: 'Smelter' }],
            }],
        },
    },
} satisfies AppVersionedGameData;

const scenarios: AppScenario[] = [];
const exercisedEventIds = new Set<string>();
const observedSubscriptionIds = new Set<string>();
let runtimeSequence = 0;

function createScenario(options?: HeadlessApplicationOptions): AppScenario {
    runtimeSequence += 1;
    const runtime = createAppRuntime({ runtimeId: `headless-e2e-${runtimeSequence}` });
    registerHeadlessApplication(runtime, options);
    const scenario = createUkladHeadlessScenario(runtime);
    scenarios.push(scenario);
    return scenario;
}

async function dispatch(scenario: AppScenario, event: AppEvent): Promise<void> {
    exercisedEventIds.add(event[0]);
    scenario.dispatch(event);
    await scenario.settle();
}

async function dispatchAll(scenario: AppScenario, events: AppEvent[]): Promise<void> {
    for (const event of events) {
        exercisedEventIds.add(event[0]);
        scenario.dispatch(event);
    }
    await scenario.settle();
}

function mountView<TQueries extends UkladHeadlessViewQueries<AppContracts>>(
    scenario: AppScenario,
    name: string,
    queries: TQueries,
) {
    for (const query of Object.values(queries)) observedSubscriptionIds.add(query[0]);
    return scenario.mountView(name, queries);
}

async function createSeededScenario(): Promise<AppScenario> {
    const scenario = createScenario();
    await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'playtest', TEST_GAME_DATA]);
    return scenario;
}

afterEach(async () => {
    await Promise.all(scenarios.splice(0).map((scenario) => scenario.dispose()));
});

afterAll(() => {
    expect([...exercisedEventIds].sort()).toEqual(Object.values(appIds.events).sort());
    expect([...observedSubscriptionIds].sort()).toEqual(Object.values(appIds.subscriptions).sort());
});

describe('headless application E2E', () => {
    it('opens independent save workspaces, preserves intent across tabs and a reload, and reports storage failures', async () => {
        const memory = memoryStorageAdapter();
        let failWrites = false;
        const storage = {
            sync: true as const,
            getItem: (key: string) => memory.getItem(key),
            setItem: (key: string, value: string) => { if (failWrites) throw new Error('quota'); memory.setItem(key, value); },
            removeItem: (key: string) => memory.removeItem(key),
        };
        const runtime = createAppRuntime({ runtimeId: 'saves-workspaces-e2e' });
        registerHeadlessApplication(runtime, { effects: { decodeSaveFile: () => new Promise(() => {}) } });
        const persistence = persist(runtime, { storage, keys: PERSIST_KEYS, prefix: 'headless-saves',
            onError: () => runtime.dispatch([appIds.events.SAVES_STORAGE_FAILED, 'write']),
        });
        const scenario = createUkladHeadlessScenario(runtime);
        scenarios.push(scenario);
        persistence.hydrate();
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
        await scenario.settle();
        const saves = mountView(scenario, 'My Saves', {
            metadata: [appIds.subscriptions.SAVES_BUILDING_CATALOG], gameData: [appIds.subscriptions.SAVES_GAME_DATA],
            records: [appIds.subscriptions.SAVES_WORKSPACES], order: [appIds.subscriptions.SAVES_WORKSPACE_ORDER],
            activeId: [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE_ID], selections: [appIds.subscriptions.SAVES_SELECTIONS],
            storage: [appIds.subscriptions.SAVES_STORAGE_ERROR], tabs: [appIds.subscriptions.SAVES_TABS],
            active: [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE], one: [appIds.subscriptions.SAVES_WORKSPACE_BY_ID, 'one'],
            overview: [appIds.subscriptions.SAVES_OVERVIEW, 'one'], core: [appIds.subscriptions.SAVES_CORE_BY_ID, 'one', 1],
            selected: [appIds.subscriptions.SAVES_SELECTED_CORE, 'one'], candidate: [appIds.subscriptions.SAVES_IMPORT],
            selectedView: [appIds.subscriptions.SAVES_SELECTED_VIEW], selectedNodes: [appIds.subscriptions.SAVES_MAP_SELECTED_NODES],
            display: [appIds.subscriptions.SAVES_MAP_DISPLAY], layers: [appIds.subscriptions.SAVES_MAP_LAYERS],
            viewports: [appIds.subscriptions.SAVES_MAP_VIEWPORTS], viewport: [appIds.subscriptions.SAVES_MAP_VIEWPORT, 'one'],
            bases: [appIds.subscriptions.BASES_LIST], planner: [appIds.subscriptions.PLANNER_TABS],
        } as const);
        await dispatch(scenario, [appIds.events.BASES_CREATE_BASE, 'Keep manual work']);
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'keep', 'Keep planner work', 'single']);
        const unrelated = { bases: saves.value('bases'), planner: saves.value('planner') };
        const importCandidate = async (id: string) => {
            await dispatch(scenario, [appIds.events.SAVES_IMPORT_OPEN, id]);
            await dispatch(scenario, [appIds.events.SAVES_IMPORT_READ, { name: 'sample.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }]);
            await dispatch(scenario, [appIds.events.SAVES_IMPORT_READY, saves.value('candidate').requestId, analyzeSave(snapshotFixture(), extractionContext)]);
        };
        await importCandidate('one');
        await dispatchAll(scenario, [
            [appIds.events.SAVES_SELECT_MAP_NODE, 'one', 200],
            [appIds.events.SAVES_SELECT_VIEW, 'overview'],
            [appIds.events.SAVES_SET_MAP_DISPLAY, { buildingSize: 88, showNames: true, showResources: true, showGrid: false, animateCargo: false }],
            [appIds.events.SAVES_SET_MAP_LAYERS, { showLinks: true, showBounds: false, showPowerNetworks: true }],
            [appIds.events.SAVES_SET_MAP_VIEWPORT, 'one', 12, -34, 0.8],
        ]);
        expect(saves.value('selectedNodes')).toEqual({ one: 200 });
        expect(saves.value('selectedView')).toBe('overview');
        expect(saves.value('display')).toMatchObject({ buildingSize: 88, showNames: true, showGrid: false });
        expect(saves.value('layers')).toEqual({ showLinks: true, showBounds: false, showPowerNetworks: true });
        expect(saves.value('viewport')).toEqual({ x: 12, y: -34, zoom: 0.8 });
        expect(saves.value('viewports')).toEqual({ one: saves.value('viewport') });
        await dispatch(scenario, [appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'First world']);
        await dispatch(scenario, [appIds.events.SAVES_SELECT_CORE, 'one', 1]);
        const baseline = saves.value('one')!.snapshot;
        await importCandidate('two');
        await dispatch(scenario, [appIds.events.SAVES_SELECT_WORKSPACE, 'one']);
        expect(saves.value('candidate').phase).toBe('closed');
        await dispatch(scenario, [appIds.events.SAVES_RENAME_WORKSPACE, 'two', 'Second world']);
        await dispatch(scenario, [appIds.events.SAVES_SELECT_CORE, 'two', 2]);
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update1', TEST_GAME_DATA]);
        expect(saves.value('one')!.snapshot).toEqual(baseline);
        expect(saves.value('overview')!.cores).toHaveLength(2);
        expect(saves.value('core')?.buildings.some(building => building.id === 200)).toBe(true);
        expect(saves.value('selected')?.core.id).toBe(1);
        expect({ bases: saves.value('bases'), planner: saves.value('planner') }).toEqual(unrelated);
        failWrites = true;
        await dispatch(scenario, [appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Unsaved world']);
        expect(saves.value('storage')).toBe('write');
        await dispatch(scenario, [appIds.events.SAVES_STORAGE_FAILED, 'write']);
        failWrites = false;
        await dispatch(scenario, [appIds.events.SAVES_RENAME_WORKSPACE, 'one', 'Renamed world']);
        await dispatch(scenario, [appIds.events.SAVES_SELECT_WORKSPACE, 'one']);
        const expected = saves.value('one');
        persistence.dispose();
        saves.unmount();
        await scenario.dispose();

        const restoredRuntime = createAppRuntime({ runtimeId: 'saves-reloaded-e2e' });
        registerHeadlessApplication(restoredRuntime);
        const restoredPersistence = persist(restoredRuntime, { storage, keys: PERSIST_KEYS, prefix: 'headless-saves' });
        const restored = createUkladHeadlessScenario(restoredRuntime);
        scenarios.push(restored);
        const reopened = mountView(restored, 'Reopened save', {
            active: [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE], selected: [appIds.subscriptions.SAVES_SELECTED_CORE, 'one'],
            tabs: [appIds.subscriptions.SAVES_TABS],
        } as const);
        restoredPersistence.hydrate();
        await restored.settle();
        expect(reopened.value('active')).toEqual(expected);
        expect(reopened.value('selected')?.core.id).toBe(1);
        await dispatch(restored, [appIds.events.SAVES_REMOVE_WORKSPACE, 'one']);
        expect(reopened.value('tabs')).toEqual([{ id: 'two', name: 'Second world' }]);
        expect(reopened.value('active')?.id).toBe('two');
        restoredPersistence.dispose();
    });
    it('captures resources from several cores, edits allocations, fits output, and clears comparison after removing a save', async () => {
        const scenario = createScenario({ effects: { decodeSaveFile: () => new Promise(() => {}) } });
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
        const importer = mountView(scenario, 'resource source import', { candidate: [appIds.subscriptions.SAVES_IMPORT] } as const);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_OPEN, 'resource-world']);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READ, { name: 'resources.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }]);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READY, importer.value('candidate').requestId, analyzeSave(snapshotFixture(), extractionContext)]);
        importer.unmount();
        await dispatchAll(scenario, [
            [appIds.events.PLANNER_OPEN_ITEM, 'bar_titanium'],
            [appIds.events.PLANNER_CREATE_TAB, 'resources', 'Titanium resources', 'single'],
        ]);
        const panel = mountView(scenario, 'planner resources panel', {
            rows: [appIds.subscriptions.PLANNER_RESOURCES], summary: [appIds.subscriptions.PLANNER_RESOURCE_SUMMARY],
            items: [appIds.subscriptions.PLANNER_RESOURCE_ITEMS],
            filtered: [appIds.subscriptions.PLANNER_FILTERED_RESOURCE_SUMMARY, 'ore_titanium'],
            allResources: [appIds.subscriptions.PLANNER_FILTERED_RESOURCE_SUMMARY, null],
            otherItem: [appIds.subscriptions.PLANNER_FILTERED_RESOURCE_SUMMARY, 'ore_iron'],
            fit: [appIds.subscriptions.PLANNER_RESOURCE_FIT],
            target: [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
        } as const);
        expect(panel.value('rows')).toEqual([]);
        expect(panel.value('items').map(item => item.id)).toEqual(['ore_titanium']);
        expect(panel.value('fit').reason).toBe('no-resources');
        await dispatch(scenario, [appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'ore_titanium', 100]);
        const manualId = panel.value('rows')[0].id;
        await dispatch(scenario, [appIds.events.PLANNER_SET_RESOURCE_RATE, manualId, 120]);
        expect(panel.value('summary')[0]).toMatchObject({ itemId: 'ore_titanium', availableRate: 120 });
        expect(panel.value('filtered')).toEqual(panel.value('summary'));
        expect(panel.value('allResources')).toEqual(panel.value('summary'));
        expect(panel.value('otherItem')).toEqual([]);
        await dispatch(scenario, [appIds.events.PLANNER_SET_RESOURCE_ENABLED, manualId, false]);
        expect(panel.value('summary')[0]).toMatchObject({ availableRate: 0, usedRate: 0 });
        await dispatch(scenario, [appIds.events.PLANNER_SET_RESOURCE_ENABLED, manualId, true]);
        await dispatch(scenario, [appIds.events.PLANNER_REMOVE_RESOURCE, manualId]);
        expect(panel.value('rows')).toEqual([]);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_MANUAL_RESOURCE, 'ore_titanium', 120]);
        expect(panel.value('rows')).toEqual([expect.objectContaining({ id: manualId, ratePerMinute: 120, enabled: true })]);

        const picker = mountView(scenario, 'core resources picker', {
            options: [appIds.subscriptions.PLANNER_RESOURCE_PICKER, 'resource-world'],
            source: [appIds.subscriptions.PLANNER_RESOURCE_PICKER_SOURCE, 'resource-world'],
        } as const);
        const options = picker.value('options')!;
        expect(options.compatible).toBe(true);
        expect(picker.value('source')?.snapshotKey).toBe(options.snapshotKey);
        const selected = options.cores.flatMap(core => core.buildings.filter(building => building.itemId === 'ore_titanium').slice(0, 1));
        expect(selected).toHaveLength(2);
        await dispatch(scenario, [appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'resource-world', options.snapshotKey,
            selected.map(building => ({ buildingId: building.buildingId }))]);
        expect(panel.value('rows')).toHaveLength(3);
        await dispatch(scenario, [appIds.events.PLANNER_IMPORT_CORE_RESOURCES, 'resource-world', options.snapshotKey,
            selected.map(building => ({ buildingId: building.buildingId }))]);
        expect(panel.value('rows')).toHaveLength(3);
        const fittedTarget = panel.value('fit').targetAmount;
        expect(fittedTarget).toBeGreaterThan(0);
        await dispatch(scenario, [appIds.events.PLANNER_APPLY_RESOURCE_FIT]);
        expect(panel.value('target')).toBe(fittedTarget);
        const statistics = mountView(scenario, 'planner building statistics', {
            selectedCores: [appIds.subscriptions.PLANNER_COMPARISON_CORE_IDS],
            comparison: [appIds.subscriptions.PLANNER_BUILDING_COMPARISON],
            rows: [appIds.subscriptions.PLANNER_STATS_BUILDING_ROWS],
        } as const);
        await dispatch(scenario, [appIds.events.PLANNER_SET_COMPARISON_CORES, 'resource-world', options.snapshotKey, options.cores.map(core => core.coreId)]);
        const comparison = statistics.value('comparison');
        expect(statistics.value('selectedCores')).toEqual(options.cores.map(core => core.coreId));
        expect(comparison.coreNames).toHaveLength(2);
        expect(comparison.rows.some(row => row.existing > 0)).toBe(true);
        for (const row of comparison.rows) expect(statistics.value('rows')).toContainEqual(expect.objectContaining({
            buildingId: row.buildingTypeId, count: row.planned,
            comparison: { existing: row.existing, additional: row.additional },
        }));
        const copiedRows = panel.value('rows');
        const production = panel.value('flow');
        picker.unmount();
        await dispatch(scenario, [appIds.events.SAVES_REMOVE_WORKSPACE, 'resource-world']);
        expect(panel.value('rows')).toEqual(copiedRows);
        expect(panel.value('flow')).toEqual(production);
        expect(statistics.value('comparison')).toEqual({ coreNames: [], rows: [] });
        expect(statistics.value('selectedCores')).toEqual([]);
        await dispatch(scenario, [appIds.events.PLANNER_CLEAR_BUILDING_COMPARISON]);
        expect(statistics.value('comparison')).toEqual({ coreNames: [], rows: [] });
        expect(statistics.value('rows').every(row => row.comparison === null)).toBe(true);
        statistics.unmount();
        panel.unmount();
    });

    it('keeps imported extraction and individual transport links separate from manually tracked bases', async () => {
        const scenario = createScenario({ effects: { decodeSaveFile: () => new Promise(() => {}) } });
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
        await dispatch(scenario, [appIds.events.BASES_CREATE_BASE, 'Manual base']);
        const view = mountView(scenario, 'Saves import candidate', {
            candidate: [appIds.subscriptions.SAVES_IMPORT], active: [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE], bases: [appIds.subscriptions.BASES_LIST],
            selected: [appIds.subscriptions.BASES_SELECTED_BASE_ID], mode: [appIds.subscriptions.BASES_MODE],
        } as const);
        const before = { bases: view.value('bases'), selected: view.value('selected'), mode: view.value('mode') };
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_OPEN]);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READ, { name: 'sample.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }]);
        const requestId = view.value('candidate').requestId;
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READY, requestId, analyzeSave(snapshotFixture(), extractionContext)]);
        expect(view.value('candidate').phase).toBe('closed');
        const report = view.value('active')!.snapshot;
        expect(report.gameData.version).toBe('update2_QoL');
        const buildings = report.cores.flatMap(core => core.buildings);
        expect(buildings.find(building => building.id === 105)?.configuration).toEqual({ kind: 'extractor', itemId: 'ore_titanium', nodePurity: 'pure' });
        expect(buildings.find(building => building.id === 200)?.configuration).toEqual({ kind: 'production', recipeId: 'fabricator:9' });
        expect(buildings.find(building => building.id === 201)?.configuration).toEqual({ kind: 'production', recipeId: 'craftertier2:5' });
        expect(report).not.toHaveProperty('catalog');
        expect({ bases: view.value('bases'), selected: view.value('selected'), mode: view.value('mode') }).toEqual(before);
        view.unmount();
    });

    it('reads and cancels an independent Saves candidate without changing manually tracked work', async () => {
        // Hold IO at the boundary so the scenario controls each completion event.
        const scenario = createScenario({ effects: { decodeSaveFile: () => new Promise(() => {}) } });
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
        await dispatchAll(scenario, [
            [appIds.events.BASES_CREATE_BASE, 'Manual base'],
            [appIds.events.PLANNER_CREATE_TAB, 'keep', 'Keep this plan', 'single'],
        ]);
        const view = mountView(scenario, 'Saves import candidate', {
            review: [appIds.subscriptions.SAVES_IMPORT],
            active: [appIds.subscriptions.SAVES_ACTIVE_WORKSPACE],
            bases: [appIds.subscriptions.BASES_LIST],
            plans: [appIds.subscriptions.PLANNER_TABS],
            grids: [appIds.subscriptions.ENERGY_GROUPS_LIST],
        } as const);
        const before = { bases: view.value('bases'), plans: view.value('plans'), grids: view.value('grids') };
        const file = { name: 'sample.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) };
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_OPEN]);
        expect(view.value('review').phase).toBe('select');
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READ, file]);
        expect(view.value('review').phase).toBe('reading');
        const first = view.value('review').requestId;
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_FAILED, first, 'compression']);
        expect(view.value('review')).toMatchObject({ phase: 'select', error: 'compression' });
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READ, file]);
        const requestId = view.value('review').requestId;
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_CLOSE]);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READY, requestId, analyzeSave(transportFixture(), extractionContext)]);
        expect(view.value('review').phase).toBe('closed');
        expect(view.value('active')).toBeNull();
        expect({ bases: view.value('bases'), plans: view.value('plans'), grids: view.value('grids') }).toEqual(before);
        view.unmount();
    });

    it('recomputes mounted Saves views from selected catalogs without rewriting saved work', async () => {
        const scenario = createScenario({ effects: { decodeSaveFile: () => new Promise(() => {}) } });
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update2_QoL', structuredClone(saveGameData)]);
        const view = mountView(scenario, 'Version-aware Saves', {
            workspace: [appIds.subscriptions.SAVES_WORKSPACE_BY_ID, 'one'],
            overview: [appIds.subscriptions.SAVES_OVERVIEW, 'one'],
            map: [appIds.subscriptions.SAVES_MAP, 'one'],
            candidate: [appIds.subscriptions.SAVES_IMPORT],
        } as const);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_OPEN, 'one']);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READ, { name: 'world.sav', size: 10, arrayBuffer: async () => new ArrayBuffer(10) }]);
        await dispatch(scenario, [appIds.events.SAVES_IMPORT_READY, view.value('candidate').requestId, analyzeSave(snapshotFixture(), extractionContext)]);
        const stored = view.value('workspace');
        const original = view.value('overview')!;
        const originalMap = view.value('map')!;
        expect(originalMap.links).toHaveLength(2);
        expect(originalMap.entities.find(entity => entity.id === 200)?.inputs.length).toBeGreaterThan(0);
        const selected = structuredClone(saveGameData);
        selected.buildings.find(building => building.id === 'smelter')!.name = 'Selected smelter';
        selected.buildings.find(building => building.id === 'smelter')!.heat = 123;
        selected.buildings.find(building => building.id === 'fabricator')!.recipes![9].output.amount_per_minute = 987;
        selected.items.find(item => item.id === 'ore_titanium')!.name = 'Selected titanium';
        for (const key of Object.keys(selected.saveBuildingCatalog.extractionRates)) selected.saveBuildingCatalog.extractionRates[key] = 1;
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update1', selected]);
        const changed = view.value('overview')!;
        expect(changed.cores.flatMap(core => core.buildingDetails).find(detail => detail.instance.id === 10)!.building.name).toBe('Selected smelter');
        expect(changed.cores[0].heat).not.toBe(original.cores[0].heat);
        expect(changed.cores.flatMap(core => core.buildingDetails).find(detail => detail.instance.id === 200)!.resources[0].rate).toBe(987);
        expect(changed.cores[0].incoming.find(resource => resource.itemId === 'ore_titanium')).toMatchObject({ name: 'Selected titanium', rate: 3 });
        expect(view.value('map')!.entities.find(entity => entity.id === 200)?.detail?.resources[0].rate).toBe(987);
        expect(view.value('map')!.entities.map(entity => entity.position)).toEqual(originalMap.entities.map(entity => entity.position));
        expect(view.value('workspace')).toEqual(stored);
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'earlyaccess', { buildings: [], items: [], corporations: {} }]);
        expect(view.value('overview')!.cores[0].heat).toBeNull();
        expect(view.value('overview')!.cores.flatMap(core => core.buildingDetails).find(detail => detail.instance.id === 10)!.building.name).toBe('smelter');
        expect(view.value('map')!.links).toEqual([{ source: 20, target: 30, item: null }, { source: 21, target: 31, item: null }]);
        expect(view.value('workspace')).toEqual(stored);
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'update2_QoL']);
        expect(view.value('overview')).toEqual(original);
        expect(view.value('map')).toEqual(originalMap);
        view.unmount();
    });

    it('converts ingredients to external resources and restores production in planner and base diagrams', async () => {
        const scenario = await createSeededScenario();
        const planner = mountView(scenario, 'Planner input controls', {
            inputs: [appIds.subscriptions.PLANNER_EXTERNAL_INPUTS],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            stats: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
        } as const);
        await dispatchAll(scenario, [
            [appIds.events.PLANNER_CREATE_TAB, 'inputs', 'External resources', 'single'],
            [appIds.events.PLANNER_SET_SELECTED_ITEM, 'steel-plate'],
            [appIds.events.PLANNER_SET_EXTERNAL_INPUT, 'iron-plate', 60],
        ]);
        expect(planner.value('inputs')).toEqual({ 'iron-plate': 60 });
        expect(planner.value('flow').nodes).toHaveLength(2);
        expect(planner.value('stats').totalBuildings).toBe(1);
        await dispatch(scenario, [appIds.events.PLANNER_REMOVE_EXTERNAL_INPUT, 'iron-plate']);
        expect(planner.value('flow').nodes).toHaveLength(3);
        expect(planner.value('inputs')).toEqual({});
        planner.unmount();

        const bases = mountView(scenario, 'Base plans', { base: [appIds.subscriptions.BASES_SELECTED_BASE] } as const);
        await dispatchAll(scenario, [
            [appIds.events.BASES_SET_MODE, 'planning'],
            [appIds.events.BASES_CREATE_BASE, 'External resource base'],
            [appIds.events.PRODUCTION_PLAN_MODAL_OPEN],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Steel'],
            [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'steel-plate'],
            [appIds.events.PRODUCTION_PLAN_MODAL_CLOSE],
        ]);
        const baseId = bases.value('base')!.id;
        const planId = bases.value('base')!.productions[0].id;
        const diagram = mountView(scenario, 'Saved plan diagram', {
            flow: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, planId],
        } as const);
        const original = diagram.value('flow');
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_ADD_INPUT, baseId, planId, 'iron-plate', 60, 'package_receiver']);
        expect(diagram.value('flow')?.nodes).toHaveLength(2);
        expect(diagram.value('flow')?.rawMaterialDeficits).toEqual([]);
        const input = bases.value('base')!.productions[0].inputs![0];
        expect(input.planningOwnerPlanId).toBe(planId);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_REMOVE_INPUT, baseId, planId, input.id]);
        expect(bases.value('base')!.buildings.some(building => building.id === input.id)).toBe(false);
        expect(diagram.value('flow')).toEqual(original);
        await dispatch(scenario, [appIds.events.BASES_ADD_BUILDINGS, baseId, 'package_receiver', 'outputs', 1,
            'Iron supply', undefined, 'iron-plate', 60]);
        const targets = mountView(scenario, 'Card input targets', {
            outputs: [appIds.subscriptions.PRODUCTION_PLAN_LINKABLE_OUTPUTS, baseId, planId, 'iron-plate'],
        } as const);
        expect(targets.value('outputs')).toHaveLength(1);
        const output = targets.value('outputs')[0];
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_LINK_OUTPUT_INPUT, baseId, planId, output.baseId, output.baseBuildingId]);
        expect(targets.value('outputs')).toHaveLength(1);
        expect(targets.value('outputs')[0].connections).toHaveLength(1);
        expect(diagram.value('flow')?.nodes).toHaveLength(2);
        const linkedInput = bases.value('base')!.productions[0].inputs![0];
        expect(linkedInput.linkedOutput).toMatchObject({ baseId, buildingId: output.baseBuildingId });
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_REMOVE_INPUT, baseId, planId, linkedInput.id]);
        expect(targets.value('outputs')).toHaveLength(1);
        expect(targets.value('outputs')[0].connections).toEqual([]);
        expect(diagram.value('flow')).toEqual(original);
        targets.unmount();
        diagram.unmount();
        bases.unmount();
    });

    it('exports selected work, previews imports, and adds new copies through the settings flow', async () => {
        const exported: PlannerArchive[] = [];
        const scenario = createScenario({ effects: {
            onExport: archive => exported.push(archive),
            createImportId: () => 'import-preview',
        } });
        const view = mountView(scenario, 'Global settings', {
            bases: [appIds.subscriptions.BASES_LIST],
            plans: [appIds.subscriptions.PLANNER_TABS],
            preview: [appIds.subscriptions.DATA_TRANSFER_PREVIEW],
            status: [appIds.subscriptions.DATA_TRANSFER_STATUS],
        } as const);
        await dispatch(scenario, [appIds.events.BASES_CREATE_BASE, 'Export base']);
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'original', 'Export plan', 'single']);
        await dispatch(scenario, [appIds.events.PLANNER_RENAME_TAB, 'original', '  Renamed plan  ']);
        expect(view.value('plans')[0].name).toBe('Renamed plan');
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_EXPORT, { baseIds: null, planIds: null }]);
        expect(exported).toHaveLength(1);
        expect(exported[0].bases[0].name).toBe('Export base');
        expect(exported[0].plans[0].name).toBe('Renamed plan');
        const text = JSON.stringify(exported[0]);
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, text]);
        expect(view.value('preview')?.bases).toHaveLength(1);
        expect(view.value('bases')).toHaveLength(1);
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_CANCEL_IMPORT]);
        expect(view.value('preview')).toBeNull();
        // A second file selection delivers a fresh, validated platform result.
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_IMPORT_READY, prepareArchiveImport(parseArchive(text), 'second-import')]);
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_CONFIRM_IMPORT]);
        expect(view.value('bases')).toHaveLength(2);
        expect(view.value('plans').map(plan => plan.name)).toEqual(['Renamed plan', 'Renamed plan (2)']);
        expect(view.value('plans')[1].id).not.toBe('original');
        expect(view.value('status')?.kind).toBe('success');
        expect(view.value('preview')).toBeNull();
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, text]);
        const planId = view.value('preview')!.plans[0].id;
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_CONFIRM_IMPORT, { baseIds: [], planIds: [planId] }]);
        expect(view.value('bases')).toHaveLength(2);
        expect(view.value('plans')).toHaveLength(3);
        expect(view.value('plans')[2].name).toBe('Renamed plan (3)');
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_SET_STATUS, null]);
        expect(view.value('status')).toBeNull();
        await dispatch(scenario, [appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, '{broken']);
        expect(view.value('status')?.kind).toBe('error');
        expect(view.value('bases')).toHaveLength(2);
        view.unmount();
    });

    it('creates named tabs, isolates their settings, and deletes only the chosen tab', async () => {
        const scenario = await createSeededScenario();
        const view = mountView(scenario, 'planner documents', {
            tabs: [appIds.subscriptions.PLANNER_TABS],
            active: [appIds.subscriptions.PLANNER_ACTIVE_TAB],
            activeId: [appIds.subscriptions.PLANNER_ACTIVE_TAB_ID],
            creation: [appIds.subscriptions.PLANNER_TAB_CREATION],
            activeView: [appIds.subscriptions.PLANNER_ACTIVE_VIEW],
            graph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
            pinned: [appIds.subscriptions.PLANNER_PINNED_NODES], activePinned: [appIds.subscriptions.PLANNER_ACTIVE_PINNED_NODE],
            viewports: [appIds.subscriptions.PLANNER_VIEWPORTS], activeViewport: [appIds.subscriptions.PLANNER_ACTIVE_VIEWPORT],
        } as const);
        expect(view.value('tabs')).toEqual([]);
        expect(view.value('active')).toBeNull();
        await dispatch(scenario, [appIds.events.PLANNER_REQUEST_TAB_CREATION]);
        expect(view.value('creation')).toEqual({});
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'single', '   ', 'single']);
        expect(view.value('tabs')).toEqual([]);
        await dispatch(scenario, [appIds.events.PLANNER_CANCEL_TAB_CREATION]);
        expect(view.value('creation')).toBeNull();
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'single', '  Iron plan  ', 'single']);
        await dispatch(scenario, [appIds.events.PLANNER_SET_SELECTED_ITEM, 'iron-plate']);
        await dispatch(scenario, [appIds.events.PLANNER_SET_TARGET_AMOUNT, 150]);
        await dispatch(scenario, [appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', 'smelter_mk2:0']);
        await dispatch(scenario, [appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL, { corporationId: 'miners', level: 1 }]);
        await dispatch(scenario, [appIds.events.PLANNER_SET_ACTIVE_VIEW, 'table']);
        await dispatch(scenario, [appIds.events.PLANNER_SET_FLOW_DIRECTION, 'BT']);
        await dispatch(scenario, [appIds.events.PLANNER_SET_GROUP_BY_STAGE, true]);
        const pinnedNodeId = view.value('graph').nodes[0].id;
        await dispatchAll(scenario, [
            [appIds.events.PLANNER_SET_PINNED_NODE, 'single', pinnedNodeId],
            [appIds.events.PLANNER_SET_VIEWPORT, 'single', 25, -10, 1.2],
        ]);
        expect(view.value('pinned')).toEqual({ single: pinnedNodeId });
        expect(view.value('activePinned')).toBe(pinnedNodeId);
        expect(view.value('viewports')).toEqual({ single: { x: 25, y: -10, zoom: 1.2 } });
        expect(view.value('activeViewport')).toEqual({ x: 25, y: -10, zoom: 1.2 });
        const single = view.value('active');
        expect(single).toMatchObject({ name: 'Iron plan', mode: 'single', targetAmount: 150, activeView: 'table' });
        // Duplicate IDs and events belonging to the other mode cannot overwrite the tab.
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'single', 'Replacement', 'multi']);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'copper-wire']);
        expect(view.value('active')).toEqual(single);

        await dispatchAll(scenario, [
            [appIds.events.PLANNER_DUPLICATE_TAB, 'missing', 'copy'],
            [appIds.events.PLANNER_DUPLICATE_TAB, 'single', '   '],
            [appIds.events.PLANNER_DUPLICATE_TAB, 'single', 'single'],
        ]);
        expect(view.value('tabs')).toEqual([single]);
        await dispatch(scenario, [appIds.events.PLANNER_DUPLICATE_TAB, 'single', 'copy']);
        expect(view.value('active')).toEqual({ ...single, id: 'copy', name: 'Iron plan (2)' });
        expect(view.value('activePinned')).toBeNull();
        expect(view.value('activeViewport')).toBeNull();
        await dispatch(scenario, [appIds.events.PLANNER_SET_TARGET_AMOUNT, 300]);
        expect(view.value('active')?.targetAmount).toBe(300);
        expect(view.value('tabs')[0]).toEqual(single);
        await dispatch(scenario, [appIds.events.PLANNER_CLOSE_TAB, 'copy']);
        expect(view.value('active')).toEqual(single);

        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'multi', 'Shared production', 'multi']);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'iron-plate']);
        await dispatch(scenario, [appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', 90]);
        await dispatch(scenario, [appIds.events.PLANNER_SET_SELECTED_ITEM, 'steel-plate']);
        await dispatch(scenario, [appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL, { corporationId: 'miners', level: 1 }]);
        expect(view.value('active')).toMatchObject({ mode: 'multi', selectedItemId: null, selectedCorporationLevel: null });
        expect(view.value('activeView')).toBe('graph');
        const multi = view.value('active');
        await dispatch(scenario, [appIds.events.PLANNER_SELECT_TAB, 'single']);
        expect(view.value('active')).toEqual(single);
        await dispatch(scenario, [appIds.events.PLANNER_SELECT_TAB, 'missing']);
        expect(view.value('activeId')).toBe('single');
        await dispatch(scenario, [appIds.events.PLANNER_OPEN_ITEM, 'steel-plate']);
        expect(view.value('creation')).toEqual({ itemId: 'steel-plate' });
        expect(view.value('active')).toEqual(single);
        await dispatch(scenario, [appIds.events.PLANNER_CANCEL_TAB_CREATION]);
        await dispatch(scenario, [appIds.events.PLANNER_CLOSE_TAB, 'single']);
        expect(view.value('active')).toEqual(multi);
        expect(view.value('pinned')).toEqual({});
        expect(view.value('viewports')).toEqual({});
        expect(view.value('activeId')).toBe('multi');
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'third', 'Third plan', 'single']);
        await dispatch(scenario, [appIds.events.PLANNER_CLOSE_TAB, 'multi']);
        expect(view.value('activeId')).toBe('third');
        await dispatch(scenario, [appIds.events.PLANNER_CLOSE_TAB, 'third']);
        expect(view.value('tabs')).toEqual([]);
        expect(view.value('activeId')).toBeNull();
        expect(view.value('active')).toBeNull();
    });

    it('switches planner tabs, fulfills overlapping targets, and removes target demand', async () => {
        const scenario = await createSeededScenario();
        const view = mountView(scenario, 'global multi-target planner', {
            groupByStage: [appIds.subscriptions.PLANNER_GROUP_BY_STAGE],
            direction: [appIds.subscriptions.PLANNER_FLOW_DIRECTION],
            graph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
            mode: [appIds.subscriptions.PLANNER_MODE],
            targets: [appIds.subscriptions.PLANNER_MULTI_TARGETS],
            warning: [appIds.subscriptions.PLANNER_TARGET_WARNING],
            activeIds: [appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS],
            singleRecipes: [appIds.subscriptions.PLANNER_SINGLE_RECIPE_SELECTIONS],
            multiRecipes: [appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
        } as const);
        await dispatch(scenario, [appIds.events.PLANNER_OPEN_ITEM, 'steel-plate']);
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'single', 'Single plan', 'single']);
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'multi', 'Multi plan', 'multi']);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'iron-plate']);
        expect(view.value('activeIds')).toEqual(['iron-plate']);
        const originalFlow = view.value('flow');
        expect(originalFlow.nodes.some(node => node.nodeType === 'target')).toBe(false);
        expect(view.value('groupByStage')).toBe(false);
        await dispatch(scenario, [appIds.events.PLANNER_SET_GROUP_BY_STAGE, false]);
        expect(view.value('groupByStage')).toBe(false);
        expect(view.value('flow')).toEqual(originalFlow);
        await dispatch(scenario, [appIds.events.PLANNER_SET_GROUP_BY_STAGE, true]);
        expect(view.value('groupByStage')).toBe(true);
        await dispatch(scenario, [appIds.events.PLANNER_SET_FLOW_DIRECTION, 'TB']);
        expect(view.value('direction')).toBe('TB');
        expect(view.value('graph').nodes.every(node => node.sourcePosition === 'bottom')).toBe(true);
        expect(view.value('flow')).toEqual(originalFlow);

        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'steel-plate']);
        expect(view.value('targets')).toHaveLength(2);
        expect(view.value('warning')).toBeNull();
        expect(view.value('flow').nodes.filter(node => node.nodeType === 'target')).toEqual([
            { nodeType: 'target', outputItem: 'iron-plate', amount: 60 },
        ]);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'steel-plate']);
        expect(translateText(createTranslator('en'), view.value('warning') ?? '')).toContain('already a target');
        await dispatch(scenario, [appIds.events.PLANNER_DISMISS_TARGET_WARNING]);
        expect(view.value('warning')).toBeNull();

        await dispatch(scenario, [appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'iron-plate', 120]);
        expect(view.value('targets')).toEqual([{ itemId: 'iron-plate', amount: 120 }, { itemId: 'steel-plate', amount: 30 }]);
        expect(view.value('flow').nodes.find(node => node.nodeType === 'production' && node.outputItem === 'iron-plate'))
            .toMatchObject({ buildingCount: 3 });
        await dispatch(scenario, [appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', 'smelter_mk2:0']);
        expect(view.value('multiRecipes')).toEqual({ 'iron-plate': 'smelter_mk2:0' });
        expect(view.value('singleRecipes')).toEqual({});
        expect(view.value('flow').nodes.find(node => node.nodeType === 'production' && node.outputItem === 'iron-plate'))
            .toMatchObject({ buildingCount: 1.5 });
        await dispatch(scenario, [appIds.events.PLANNER_SELECT_TAB, 'single']);
        expect(view.value('mode')).toBe('single');
        expect(view.value('activeIds')).toEqual(['steel-plate']);
        await dispatch(scenario, [appIds.events.PLANNER_SELECT_TAB, 'multi']);
        await dispatch(scenario, [appIds.events.PLANNER_REMOVE_TARGET, 'iron-plate']);
        expect(view.value('flow').nodes.find(node => node.nodeType === 'production' && node.outputItem === 'iron-plate'))
            .toMatchObject({ buildingCount: 0.5 });
        expect(view.value('flow').nodes.filter(node => node.nodeType === 'target'))
            .toEqual([]);
        await dispatch(scenario, [appIds.events.PLANNER_REMOVE_TARGET, 'steel-plate']);
        expect(view.value('flow').nodes).toEqual([]);
        expect(view.value('warning')).toBeNull();
    });

    it.each(['earlyaccess', 'playtest'] as const)(
        'recalculates overlapping targets when recipe fallback introduces a dependency in %s',
        async (nextVersion) => {
            const scenario = createScenario();
            const independentData: AppVersionedGameData = structuredClone(TEST_GAME_DATA);
            independentData.buildings.find(building => building.id === 'assembler')!.recipes!.push({
                id: 'steel-direct',
                variant: 'alternative',
                output: { id: 'steel-plate', amount_per_minute: 30 },
                inputs: [{ id: 'iron-ore', amount_per_minute: 30 }],
            });
            // The selected recipe disappears; its replacement remains available for repair.
            const updatedData = structuredClone(independentData);
            updatedData.buildings.find(building => building.id === 'assembler')!.recipes![1].id = 'steel-replacement';
            const view = mountView(scenario, 'multi-target data validation', {
                mode: [appIds.subscriptions.PLANNER_MODE],
                targets: [appIds.subscriptions.PLANNER_MULTI_TARGETS],
                warning: [appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING],
                recipes: [appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS],
                options: [appIds.subscriptions.PLANNER_RECIPE_OPTIONS],
                flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
                graph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
                stats: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
            } as const);
            await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'playtest', independentData]);
            await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'multi', 'Multi plan', 'multi']);
            await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'steel-plate']);
            await dispatch(scenario, [appIds.events.PLANNER_SET_RECIPE_SELECTION, 'steel-plate', 'assembler:steel-direct']);
            await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'iron-plate']);
            await dispatch(scenario, [appIds.events.PLANNER_SET_MULTI_TARGET_AMOUNT, 'steel-plate', 60]);
            const targets = view.value('targets');
            const flow = view.value('flow');
            expect(view.value('warning')).toBeNull();
            expect(flow.nodes.length).toBeGreaterThan(0);
            expect(flow.nodes.some(node => node.nodeType === 'target')).toBe(false);

            // Covers both a version switch and a refresh under the same version ID.
            await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, nextVersion, updatedData]);
            expect(view.value('warning')).toBeNull();
            expect(view.value('targets')).toEqual(targets);
            expect(view.value('recipes')).toEqual({ 'steel-plate': 'assembler:steel-direct' });
            expect(view.value('flow').nodes.find(node => node.nodeType === 'production' && node.outputItem === 'iron-plate'))
                .toMatchObject({ outputAmount: 60, buildingCount: 3 });
            expect(view.value('graph').nodes.filter(node => node.flowNode.nodeType === 'target')).toHaveLength(1);
            expect(view.value('stats')).toEqual({ totalBuildings: 8, totalEnergy: 75, totalHotness: 35 });
            expect(view.value('options').find(option => option.itemId === 'steel-plate')?.options)
                .toEqual(expect.arrayContaining([expect.objectContaining({ key: 'assembler:steel-replacement' })]));
            await dispatch(scenario, [appIds.events.PLANNER_DISMISS_TARGET_WARNING]);
            expect(view.value('warning')).toBeNull();
            await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'single', 'Single plan', 'single']);
            await dispatch(scenario, [appIds.events.PLANNER_SELECT_TAB, 'multi']);
            expect(view.value('mode')).toBe('multi');
            expect(view.value('targets')).toEqual(targets);
            expect(view.value('flow').nodes.length).toBeGreaterThan(0);

            await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'playtest', independentData]);
            expect(view.value('warning')).toBeNull();
            expect(view.value('flow')).toEqual(flow);
            await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, nextVersion, updatedData]);
            await dispatch(scenario, [appIds.events.PLANNER_SET_RECIPE_SELECTION, 'steel-plate', 'assembler:steel-replacement']);
            expect(view.value('warning')).toBeNull();
            expect(view.value('targets')).toEqual(targets);
            expect(view.value('flow')).toEqual(flow);
        },
    );

    it('rejects cyclic recipe selections and pauses cycles introduced by data updates until repaired', async () => {
        const scenario = createScenario();
        const data: AppVersionedGameData = structuredClone(TEST_GAME_DATA);
        data.buildings.find(building => building.id === 'smelter')!.recipes!.push({
            id: 'loop', variant: 'alternative', output: { id: 'iron-plate', amount_per_minute: 60 },
            inputs: [{ id: 'steel-plate', amount_per_minute: 30 }],
        });
        const view = mountView(scenario, 'cyclic production recipes', {
            warning: [appIds.subscriptions.PLANNER_TARGET_WARNING],
            dataWarning: [appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING],
            recipes: [appIds.subscriptions.PLANNER_MULTI_RECIPE_SELECTIONS],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            stats: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
        } as const);
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'playtest', data]);
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'multi', 'Multi plan', 'multi']);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'steel-plate']);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'iron-plate']);
        const validFlow = view.value('flow');
        await dispatch(scenario, [appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', 'smelter:loop']);
        expect(translateText(createTranslator('en'), view.value('warning') ?? '')).toContain('circular production dependency');
        expect(view.value('recipes')).toEqual({});
        expect(view.value('flow')).toEqual(validFlow);
        await dispatch(scenario, [appIds.events.PLANNER_SET_RECIPE_SELECTIONS, { 'iron-plate': 'smelter:loop' }]);
        expect(view.value('recipes')).toEqual({});

        const updated = structuredClone(data);
        updated.buildings.find(building => building.id === 'smelter')!.recipes![0].inputs = [{ id: 'steel-plate', amount_per_minute: 30 }];
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'playtest', updated]);
        expect(translateText(createTranslator('en'), view.value('dataWarning') ?? '')).toContain('circular production dependency');
        expect(view.value('flow').nodes).toEqual([]);
        expect(view.value('stats')).toEqual({ totalBuildings: 0, totalEnergy: 0, totalHotness: 0 });
        await dispatch(scenario, [appIds.events.PLANNER_SET_RECIPE_SELECTION, 'iron-plate', 'smelter_mk2:0']);
        expect(view.value('dataWarning')).toBeNull();
        expect(view.value('warning')).toBeNull();
        expect(view.value('flow').nodes.filter(node => node.nodeType === 'target')).toHaveLength(1);
    });

    it('pauses an unavailable target after a recipe update and allows its removal', async () => {
        const scenario = await createSeededScenario();
        const view = mountView(scenario, 'unavailable production target', {
            targets: [appIds.subscriptions.PLANNER_MULTI_TARGETS],
            warning: [appIds.subscriptions.PLANNER_MULTI_TARGET_WARNING],
            flow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
        } as const);
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'multi', 'Multi plan', 'multi']);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'steel-plate']);
        const updatedData: AppVersionedGameData = structuredClone(TEST_GAME_DATA);
        updatedData.buildings = updatedData.buildings.filter(building => building.id !== 'assembler');
        await dispatch(scenario, [appIds.events.APP_SET_DATA_VERSION, 'playtest', updatedData]);
        expect(translateText(createTranslator('en'), view.value('warning') ?? '')).toContain('Steel Plate has no usable production recipe');
        expect(view.value('targets')).toEqual([{ itemId: 'steel-plate', amount: 30 }]);
        expect(view.value('flow').nodes).toEqual([]);
        await dispatch(scenario, [appIds.events.PLANNER_REMOVE_TARGET, 'steel-plate']);
        expect(view.value('warning')).toBeNull();
        expect(view.value('targets')).toEqual([]);
        await dispatch(scenario, [appIds.events.PLANNER_ADD_TARGET, 'iron-plate']);
        expect(view.value('flow').nodes.length).toBeGreaterThan(0);
    });

    it('boots the Node adapter, changes data versions, and drives shell controls', async () => {
        const scenario = createScenario();
        const shell = mountView(scenario, 'application shell', {
            version: [appIds.subscriptions.APP_DATA_VERSION],
            versions: [appIds.subscriptions.APP_DATA_VERSIONS],
            theme: [appIds.subscriptions.UI_THEME],
            locale: [appIds.subscriptions.UI_LOCALE],
            pending: [appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING],
            activeTab: [appIds.subscriptions.UI_ACTIVE_TAB],
            confirmation: [appIds.subscriptions.UI_CONFIRMATION_DIALOG],
            items: [appIds.subscriptions.ITEMS_LIST],
        } as const);

        await dispatch(scenario, [appIds.events.APP_INIT]);
        await vi.waitFor(async () => {
            await scenario.settle();
            expect(shell.value('items').length).toBeGreaterThan(0);
        });

        expect(shell.value('version')).toBe(DEFAULT_DATA_VERSION);
        expect(shell.value('versions')).toHaveLength(5);

        await dispatch(scenario, [appIds.events.UI_SET_LOCALE, 'unknown-locale']);
        expect(shell.value('locale')).toBe('en');
        await dispatch(scenario, [appIds.events.UI_SET_THEME, 'light']);
        await dispatch(scenario, [appIds.events.UI_SET_ACTIVE_TAB, 'corporations']);
        expect(shell.current()).toMatchObject({ theme: 'light', activeTab: 'corporations' });

        const onConfirm = vi.fn();
        const onCancel = vi.fn();
        await dispatch(scenario, [
            appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
            'Delete plan?',
            'This cannot be undone.',
            onConfirm,
            { confirmLabel: 'Delete', cancelLabel: 'Keep', onCancel },
        ]);
        expect(shell.value('confirmation')).toMatchObject({
            isOpen: true,
            title: 'Delete plan?',
            confirmLabel: 'Delete',
            cancelLabel: 'Keep',
        });
        shell.value('confirmation').onConfirm();
        shell.value('confirmation').onCancel?.();
        expect(onConfirm).toHaveBeenCalledOnce();
        expect(onCancel).toHaveBeenCalledOnce();

        await dispatch(scenario, [appIds.events.UI_CLOSE_CONFIRMATION_DIALOG]);
        expect(shell.value('confirmation').isOpen).toBe(false);

        await dispatch(scenario, [appIds.events.APP_REQUEST_LOAD_GAME_DATA, 'playtest']);
        await vi.waitFor(async () => {
            await scenario.settle();
            expect(shell.value('version')).toBe('playtest');
            expect(shell.value('pending')).toBe(false);
        });

        await dispatch(scenario, [appIds.events.APP_GAME_DATA_LOAD_FAILED]);
        expect(shell.value('pending')).toBe(false);
    });

    it('browses Codex independently of the open catalog and planner', async () => {
        const scenario = await createSeededScenario();
        const workspace = mountView(scenario, 'workspace beneath Codex', {
            tab: [appIds.subscriptions.UI_ACTIVE_TAB],
            plans: [appIds.subscriptions.PLANNER_TABS],
            items: [appIds.subscriptions.ITEMS_FILTERED_LIST],
        } as const);
        await dispatchAll(scenario, [
            [appIds.events.PLANNER_CREATE_TAB, 'existing', 'Existing plan', 'single'],
            [appIds.events.PLANNER_SET_SELECTED_ITEM, 'steel-plate'],
            [appIds.events.PLANNER_SET_TARGET_AMOUNT, 90],
            [appIds.events.UI_SET_ACTIVE_TAB, 'items'],
            [appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'raw'],
        ]);
        const before = workspace.current();
        const codex = mountView(scenario, 'Codex items', {
            category: [appIds.subscriptions.ITEMS_CODEX_SELECTED_CATEGORY],
            building: [appIds.subscriptions.ITEMS_CODEX_SELECTED_BUILDING],
            search: [appIds.subscriptions.ITEMS_CODEX_SEARCH_TERM],
            items: [appIds.subscriptions.ITEMS_CODEX_FILTERED_LIST],
            rows: [appIds.subscriptions.ITEMS_CODEX_TABLE_ROWS],
        } as const);
        await dispatchAll(scenario, [
            [appIds.events.ITEMS_CODEX_SET_SELECTED_CATEGORY, 'processed'],
            [appIds.events.ITEMS_CODEX_SET_SELECTED_BUILDING, 'Smelter'],
            [appIds.events.ITEMS_CODEX_SET_SEARCH_TERM, 'plate'],
        ]);
        expect(codex.current()).toMatchObject({ category: 'processed', building: 'Smelter', search: 'plate' });
        expect(codex.value('items').map(item => item.id)).toEqual(['iron-plate']);
        expect(codex.value('rows')).toMatchObject([{ item: { id: 'iron-plate' }, producingBuildings: ['Smelter', 'Smelter Mk.2'] }]);
        expect(workspace.current()).toEqual(before);
        codex.unmount();
        expect(workspace.current()).toEqual(before);
    });

    it('filters the catalog and runs the complete planner workflow', async () => {
        const scenario = await createSeededScenario();
        const catalog = mountView(scenario, 'catalog and planner', {
            items: [appIds.subscriptions.ITEMS_LIST],
            itemsById: [appIds.subscriptions.ITEMS_BY_ID_MAP],
            filteredItems: [appIds.subscriptions.ITEMS_FILTERED_LIST],
            selectedCategory: [appIds.subscriptions.ITEMS_SELECTED_CATEGORY],
            selectedBuilding: [appIds.subscriptions.ITEMS_SELECTED_BUILDING],
            availableItems: [appIds.subscriptions.ITEMS_AVAILABLE_ITEMS_BY_BUILDING_ID, 'smelter'],
            productionBuildings: [appIds.subscriptions.ITEMS_AVAILABLE_PRODUCTION_BUILDINGS],
            searchTerm: [appIds.subscriptions.ITEMS_SEARCH_TERM],
            categories: [appIds.subscriptions.ITEMS_CATEGORIES],
            tableRows: [appIds.subscriptions.ITEMS_TABLE_ROWS],
            helperLookups: [appIds.subscriptions.ITEMS_HELPER_LOOKUPS],
            recipesUsingIron: [appIds.subscriptions.ITEMS_RECIPES_BY_INPUT_ITEM_ID, 'iron-ore'],
            recipesForIronPlate: [appIds.subscriptions.ITEMS_RECIPES_BY_OUTPUT_ITEM_ID, 'iron-plate'],
            buildings: [appIds.subscriptions.BUILDINGS_LIST],
            buildingsById: [appIds.subscriptions.BUILDINGS_BY_ID_MAP],
            sortedProductionBuildings: [appIds.subscriptions.BUILDINGS_SORTED_PRODUCTION_LIST],
            corporations: [appIds.subscriptions.CORPORATIONS_LIST],
            corporationsWithStats: [appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS],
            corporationSummary: [appIds.subscriptions.CORPORATIONS_STATS_SUMMARY],
            selectedItemId: [appIds.subscriptions.PLANNER_SELECTED_ITEM_ID],
            selectedCorporationLevel: [appIds.subscriptions.PLANNER_SELECTED_CORPORATION_LEVEL],
            recipeSelections: [appIds.subscriptions.PLANNER_RECIPE_SELECTIONS],
            pinnedRecipeSelections: [appIds.subscriptions.PINNED_RECIPE_SELECTIONS],
            recipePresets: [appIds.subscriptions.RECIPE_ALTERNATIVE_PRESETS],
            recipePresetState: [appIds.subscriptions.PLANNER_RECIPE_PRESET_STATE],
            recipeOptions: [appIds.subscriptions.PLANNER_RECIPE_OPTIONS],
            corporationLevels: [appIds.subscriptions.PLANNER_AVAILABLE_CORPORATION_LEVELS],
            targetAmount: [appIds.subscriptions.PLANNER_TARGET_AMOUNT],
            productionFlow: [appIds.subscriptions.PLANNER_PRODUCTION_FLOW],
            flowGraph: [appIds.subscriptions.PLANNER_FLOW_GRAPH],
            statsSummary: [appIds.subscriptions.PLANNER_STATS_SUMMARY],
            statsDetailed: [appIds.subscriptions.PLANNER_STATS_DETAILED],
            selectableItems: [appIds.subscriptions.PLANNER_SELECTABLE_ITEMS],
        } as const);

        await dispatchAll(scenario, [
            [appIds.events.ITEMS_SET_SELECTED_CATEGORY, 'processed'],
            [appIds.events.ITEMS_SET_SELECTED_BUILDING, 'Smelter'],
            [appIds.events.ITEMS_SET_SEARCH_TERM, 'plate'],
        ]);

        expect(catalog.value('filteredItems')).toEqual([
            { id: 'iron-plate', name: 'Iron Plate', type: 'processed' },
        ]);
        expect(catalog.value('availableItems').map((item) => item.id)).toEqual(['iron-plate']);
        expect(catalog.value('productionBuildings')).toContain('Smelter');
        expect(catalog.value('tableRows')[0]).toMatchObject({
            item: { id: 'iron-plate' },
            producingBuildings: ['Smelter', 'Smelter Mk.2'],
        });
        expect(catalog.value('helperLookups').corporationNameToId.get('Miners')).toBe('miners');
        expect(catalog.value('recipesUsingIron').map(({ building }) => building.id)).toEqual([
            'smelter',
            'smelter_mk2',
        ]);
        expect(catalog.value('recipesForIronPlate').map(({ building }) => building.id)).toEqual([
            'smelter',
            'smelter_mk2',
        ]);
        expect(catalog.value('buildingsById').assembler.name).toBe('Assembler');
        expect(catalog.value('corporationsWithStats')[0]).toMatchObject({
            name: 'Miners',
            stats: { totalLevels: 1, totalComponents: 2, totalCost: 100 },
        });
        expect(catalog.value('corporationSummary')).toEqual({
            totalCorporations: 1,
            totalLevels: 1,
            totalCost: 100,
        });

        await dispatch(scenario, [appIds.events.RECIPE_ALTERNATIVES_INITIALIZE_PRESETS]);
        await dispatch(scenario, [
            appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULTS,
            { 'iron-plate': 'smelter:0' },
        ]);
        await dispatch(scenario, [appIds.events.PLANNER_OPEN_ITEM, 'iron-plate']);
        await dispatch(scenario, [appIds.events.PLANNER_CREATE_TAB, 'single', 'Single plan', 'single']);
        await dispatch(scenario, [
            appIds.events.PLANNER_SET_SELECTED_CORPORATION_LEVEL,
            { corporationId: 'miners', level: 1 },
        ]);
        await dispatch(scenario, [
            appIds.events.PLANNER_SET_RECIPE_SELECTION,
            'iron-plate',
            'smelter_mk2:0',
        ]);
        await dispatch(scenario, [
            appIds.events.PLANNER_SET_RECIPE_SELECTIONS,
            { 'iron-plate': 'smelter:0' },
        ]);
        await dispatch(scenario, [appIds.events.PLANNER_SET_TARGET_AMOUNT, 120]);

        expect(catalog.value('selectedItemId')).toBe('iron-plate');
        expect(catalog.value('selectedCorporationLevel')).toEqual({ corporationId: 'miners', level: 1 });
        expect(catalog.value('targetAmount')).toBe(120);
        expect(catalog.value('corporationLevels')).toMatchObject([{ corporationId: 'miners', level: 1 }]);
        expect(catalog.value('productionFlow').nodes.length).toBeGreaterThan(0);
        expect(catalog.value('recipeOptions')).toMatchObject([{
            itemId: 'iron-plate',
            options: [{ buildingId: 'smelter' }, { buildingId: 'smelter_mk2' }],
        }]);
        expect(catalog.value('flowGraph').nodes.length).toBeGreaterThan(0);
        expect(catalog.value('statsSummary').totalBuildings).toBeGreaterThan(0);
        expect(catalog.value('statsDetailed').buildingStats.length).toBeGreaterThan(0);
        expect(catalog.value('selectableItems').map((item) => item.id)).toEqual(['iron-plate', 'steel-plate']);

        await dispatch(scenario, [
            appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET,
            '  Fast   iron  ',
            { 'iron-plate': 'smelter_mk2:0' },
        ]);
        const preset = catalog.value('recipePresets').find(entry => entry.name === 'Fast iron');
        expect(preset).toMatchObject({
            name: 'Fast iron',
            selections: { 'iron-plate': 'smelter_mk2:0' },
        });
        await dispatch(scenario, [appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULT_PRESET, preset!.id]);
        expect(catalog.value('recipePresetState').defaultPreset?.name).toBe('Fast iron');
        expect(catalog.value('pinnedRecipeSelections')).toEqual({ 'iron-plate': 'smelter_mk2:0' });
        expect(catalog.value('recipeSelections')).toEqual({ 'iron-plate': 'smelter:0' });
        await dispatch(scenario, [appIds.events.RECIPE_ALTERNATIVES_SET_DEFAULT_PRESET, STANDARD_RECIPE_PRESET_ID]);
        expect(catalog.value('recipePresetState').defaultPreset?.id).toBe(STANDARD_RECIPE_PRESET_ID);
        await dispatch(scenario, [appIds.events.RECIPE_ALTERNATIVES_SAVE_PRESET, 'Fast iron', { 'iron-plate': 'smelter_mk2:0' }, true]);
        expect(catalog.value('recipePresetState').defaultPreset?.id).toBe(preset!.id);
        await dispatch(scenario, [appIds.events.RECIPE_ALTERNATIVES_RENAME_PRESET, preset!.id, 'Upgraded iron']);
        expect(catalog.value('recipePresetState').defaultPreset?.name).toBe('Upgraded iron');
        await dispatch(scenario, [appIds.events.RECIPE_ALTERNATIVES_DELETE_PRESET, preset!.id]);
        expect(catalog.value('recipePresetState').defaultPreset?.id).toBe(STANDARD_RECIPE_PRESET_ID);
        expect(catalog.value('recipePresets').map(entry => entry.id)).toEqual([STANDARD_RECIPE_PRESET_ID, V2_RECIPE_PRESET_ID, 'rap_recovered_default']);
        expect(catalog.value('pinnedRecipeSelections')).toEqual({});

        await dispatch(scenario, [appIds.events.PLANNER_SET_SELECTED_ITEM, 'steel-plate']);
        expect(catalog.value('selectedItemId')).toBe('steel-plate');
        expect(catalog.value('selectedCorporationLevel')).toBeNull();
        expect(catalog.value('targetAmount')).toBe(30);
    });

    it('manages bases, buildings, logistics, and energy groups', async () => {
        const scenario = await createSeededScenario();
        const bases = mountView(scenario, 'bases root', {
            mode: [appIds.subscriptions.BASES_MODE],
            list: [appIds.subscriptions.BASES_LIST],
            selectedId: [appIds.subscriptions.BASES_SELECTED_BASE_ID],
            selectedTab: [appIds.subscriptions.BASES_SELECTED_DETAIL_TAB],
            energyGroups: [appIds.subscriptions.ENERGY_GROUPS_LIST],
            energyGroupsById: [appIds.subscriptions.ENERGY_GROUPS_BY_ID_MAP],
        } as const);

        await dispatch(scenario, [appIds.events.BASES_CREATE_BASE, 'Alpha']);
        const baseId = bases.value('selectedId')!;
        const baseDetails = mountView(scenario, 'selected base details', {
            detailsExpanded: [appIds.subscriptions.BASES_DETAILS_EXPANDED],
            collapsedSections: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS],
            collapsedForBase: [appIds.subscriptions.BASES_CARD_COLLAPSED_SECTIONS_BY_BASE_ID, baseId],
            basesById: [appIds.subscriptions.BASES_BY_ID_MAP],
            baseById: [appIds.subscriptions.BASES_BASE_BY_ID, baseId],
            selectedBase: [appIds.subscriptions.BASES_SELECTED_BASE],
            selectedStats: [appIds.subscriptions.BASES_SELECTED_BASE_DETAIL_STATS],
            detailStats: [appIds.subscriptions.BASES_DETAIL_STATS_BY_BASE_ID, baseId],
            inputItems: [appIds.subscriptions.BASES_INPUT_ITEMS_BY_BASE_ID, baseId],
            outputItems: [appIds.subscriptions.BASES_OUTPUT_ITEMS_BY_BASE_ID, baseId],
            defenseBuildings: [appIds.subscriptions.BASES_DEFENSE_BUILDINGS_BY_BASE_ID, baseId],
            sectionBuildings: [appIds.subscriptions.BASES_BUILDING_SECTION_BUILDINGS, baseId, 'production'],
            sectionStats: [appIds.subscriptions.BASES_BUILDING_SECTION_STATS, baseId, 'production'],
            availableBuildings: [appIds.subscriptions.BASES_AVAILABLE_BUILDINGS_FOR_SECTION, 'production'],
            coreLevels: [appIds.subscriptions.BASES_CORE_LEVELS],
            summary: [appIds.subscriptions.BASES_STATS_SUMMARY],
            logistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODEL_BY_BASE_ID, baseId],
            allLogistics: [appIds.subscriptions.BASES_LOGISTICS_VIEW_MODELS],
            allDetailStats: [appIds.subscriptions.BASES_ALL_DETAIL_STATS],
            planRows: [appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS],
            materialRows: [appIds.subscriptions.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS],
            coverageRows: [appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
            productionTable: [appIds.subscriptions.BASES_PRODUCTION_TABLE],
        } as const);

        await dispatch(scenario, [appIds.events.BASES_UPDATE_BASE_NAME, baseId, 'Main Outpost']);
        await dispatch(scenario, [appIds.events.BASES_OPEN_BASE, baseId, 'plans']);
        expect(bases.value('selectedTab')).toBe('plans');
        await dispatch(scenario, [appIds.events.BASES_SET_SELECTED_BASE, baseId]);
        await dispatch(scenario, [appIds.events.BASES_SET_DETAIL_TAB, 'buildings']);
        expect(baseDetails.value('detailsExpanded')).toBe(true);
        await dispatch(scenario, [appIds.events.BASES_SET_DETAILS_EXPANDED, false]);
        expect(baseDetails.value('detailsExpanded')).toBe(false);
        expect(bases.value('mode')).toBeNull();
        const baseBeforeModeChange = baseDetails.value('selectedBase');
        await dispatch(scenario, [appIds.events.BASES_SET_MODE, 'planning']);
        expect(bases.value('mode')).toBe('planning');
        expect(baseDetails.value('selectedBase')).toEqual(baseBeforeModeChange);
        expect(bases.value('selectedTab')).toBe('buildings');
        await dispatch(scenario, [appIds.events.BASES_SET_MODE, 'advanced']);
        expect(bases.value('mode')).toBe('advanced');
        await dispatch(scenario, [appIds.events.BASES_SET_CORE_LEVEL, 1]);

        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDING,
            baseId,
            'package_receiver',
            'outputs',
            'Iron export',
        ]);
        let output = baseDetails.value('selectedBase')!.buildings.find((building) => building.sectionType === 'outputs')!;
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            baseId,
            output.id,
            'iron-plate',
            60,
        ]);

        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDING,
            baseId,
            'package_receiver',
            'inputs',
            'Iron intake',
        ]);
        const input = baseDetails.value('selectedBase')!.buildings.find((building) => building.sectionType === 'inputs')!;
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION,
            baseId,
            input.id,
            'iron-plate',
            60,
        ]);
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT,
            baseId,
            input.id,
            baseId,
            output.id,
        ]);

        const connections = mountView(scenario, 'connection choices', {
            sources: [appIds.subscriptions.BASES_CONNECTION_OUTPUTS, baseId, input.buildingTypeId],
            targets: [appIds.subscriptions.BASES_CONNECTION_INPUTS, baseId, output.id, output.buildingTypeId],
            inputSummary: [appIds.subscriptions.BASES_CONNECTION_BUILDING, baseId, input.id],
            outputSummary: [appIds.subscriptions.BASES_CONNECTION_BUILDING, baseId, output.id],
            noSelection: [appIds.subscriptions.BASES_CONNECTION_BUILDING, baseId, null],
        } as const);
        expect(connections.value('sources')[0].connections).toMatchObject([{ baseId, buildingId: input.id, buildingName: 'Iron intake' }]);
        expect(connections.value('targets')[0].connections).toMatchObject([{ baseId, buildingId: output.id, buildingName: 'Iron export' }]);
        expect(connections.value('inputSummary')).toMatchObject({
            baseId, buildingId: input.id, baseName: 'Main Outpost', buildingName: 'Iron intake',
            building: { id: input.buildingTypeId }, item: { id: 'iron-plate', name: 'Iron Plate' }, ratePerMinute: 60,
        });
        expect(connections.value('outputSummary')).toMatchObject({
            baseId, buildingId: output.id, baseName: 'Main Outpost', buildingName: 'Iron export',
            building: { id: output.buildingTypeId }, item: { id: 'iron-plate', name: 'Iron Plate' }, ratePerMinute: 60,
        });
        expect(connections.value('noSelection')).toBeNull();
        await dispatch(scenario, [appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, baseId, output.id, 'iron-plate', 90]);
        expect(connections.value('inputSummary')?.ratePerMinute).toBe(90);
        expect(connections.value('outputSummary')?.ratePerMinute).toBe(90);
        await dispatch(scenario, [appIds.events.BASES_UPDATE_BUILDING_ITEM_SELECTION, baseId, output.id, 'iron-plate', 60]);

        await dispatch(scenario, [appIds.events.BASES_DUPLICATE_BUILDING, baseId, input.id, 'intake-copy']);
        expect(baseDetails.value('inputItems')).toHaveLength(2);
        expect(baseDetails.value('inputItems').find(entry => entry.baseBuildingId === 'intake-copy')).toMatchObject({
            name: 'Iron intake (2)', ratePerMinute: 60, item: { id: 'iron-plate' },
        });
        expect(baseDetails.value('selectedBase')!.buildings.find(building => building.id === 'intake-copy')?.linkedOutput).toBeUndefined();
        expect(baseDetails.value('inputItems').find(entry => entry.baseBuildingId === input.id)?.linkedOutput).toMatchObject({ buildingId: output.id });
        await dispatch(scenario, [appIds.events.BASES_REMOVE_BUILDING, 'intake-copy']);

        await dispatch(scenario, [appIds.events.BASES_DISCONNECT_CONNECTIONS, [
            { source: { baseId, buildingId: output.id }, target: { baseId, buildingId: input.id } },
        ]]);
        expect(connections.value('sources')[0].connections).toEqual([]);
        expect(connections.value('targets')[0].connections).toEqual([]);
        expect(baseDetails.value('inputItems')).toEqual([]);
        expect(connections.value('targets')[0].item).toBeUndefined();
        expect(connections.value('targets')[0].ratePerMinute).toBeUndefined();
        expect(connections.value('inputSummary')).toMatchObject({ buildingName: 'Iron intake', item: undefined, ratePerMinute: undefined });
        expect(connections.value('outputSummary')).toMatchObject({ item: { id: 'iron-plate' }, ratePerMinute: 60 });
        await dispatch(scenario, [appIds.events.BASES_UPDATE_BUILDING_LINKED_OUTPUT, baseId, input.id, baseId, output.id]);
        expect(connections.value('inputSummary')).toMatchObject({ item: { id: 'iron-plate' }, ratePerMinute: 60 });

        const originalOutput = baseDetails.value('outputItems')[0];
        const originalInput = baseDetails.value('inputItems')[0];
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_DETAILS,
            baseId,
            output.id,
            '  South dock  ',
            '  Iron shipments\nReserve for plates  ',
        ]);
        expect(baseDetails.value('outputItems')).toEqual([{
            ...originalOutput,
            name: 'South dock',
            description: 'Iron shipments\nReserve for plates',
        }]);
        expect(connections.value('outputSummary')?.buildingName).toBe('South dock');
        expect(baseDetails.value('inputItems')).toEqual([{
            ...originalInput,
            linkedOutput: { ...originalInput.linkedOutput, outputName: 'South dock' },
        }]);

        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_BUILDING_DETAILS,
            baseId,
            output.id,
            '   ',
            '   ',
        ]);
        expect(baseDetails.value('outputItems')).toEqual([{
            ...originalOutput,
            name: 'Package Receiver',
            description: '',
        }]);
        expect(connections.value('outputSummary')?.buildingName).toBe('Package Receiver');
        expect(baseDetails.value('inputItems')).toEqual([{
            ...originalInput,
            linkedOutput: { ...originalInput.linkedOutput, outputName: 'Package Receiver' },
        }]);

        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'smelter',
            'production',
            2,
            'Iron line',
            'Primary smelting',
        ]);
        await dispatch(scenario, [
            appIds.events.BASES_SET_BUILDING_SECTION_TYPE_COUNT,
            baseId,
            'smelter',
            'production',
            3,
        ]);
        await dispatch(scenario, [appIds.events.BASES_ADD_BUILDING, baseId, 'power_generator', 'energy']);
        await dispatch(scenario, [appIds.events.BASES_ADD_BUILDING, baseId, 'turret', 'infrastructure']);
        await dispatch(scenario, [
            appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED,
            baseId,
            'productionPlans',
        ]);

        await dispatch(scenario, [appIds.events.ENERGY_GROUP_CREATE, '  Main   Grid  ', baseId]);
        const [group] = bases.value('energyGroups');
        await dispatch(scenario, [appIds.events.ENERGY_GROUP_RENAME, group!.id, 'Primary Grid']);
        await dispatch(scenario, [appIds.events.BASES_SET_ENERGY_GROUP, baseId, null]);
        await dispatch(scenario, [appIds.events.BASES_SET_ENERGY_GROUP, baseId, group!.id]);

        expect(baseDetails.value('baseById')).toMatchObject({
            name: 'Main Outpost',
            coreLevel: 1,
            energyGroupId: group!.id,
        });
        expect(baseDetails.value('collapsedForBase').productionPlans).toBe(true);
        expect(baseDetails.value('sectionBuildings')).toMatchObject([{
            buildingTypeId: 'smelter',
            count: 3,
            isGrouped: true,
        }]);
        expect(baseDetails.value('sectionStats').buildingCount).toBe(3);
        expect(baseDetails.value('inputItems')[0]).toMatchObject({
            item: { id: 'iron-plate' },
            linkedOutput: { status: 'ok' },
        });
        expect(baseDetails.value('outputItems')[0]).toMatchObject({ item: { id: 'iron-plate' } });
        expect(baseDetails.value('defenseBuildings')).toMatchObject([{ building: { id: 'turret' }, count: 1 }]);
        expect(baseDetails.value('availableBuildings').map((building) => building.id)).toContain('smelter');
        expect(baseDetails.value('coreLevels')).toEqual([
            { level: 0, heatCapacity: 100 },
            { level: 1, heatCapacity: 200 },
        ]);
        expect(baseDetails.value('summary')).toMatchObject({ totalBases: 1, totalBuildings: 7 });
        expect(baseDetails.value('selectedStats')).toMatchObject({ baseName: 'Main Outpost', energyGroupName: 'Primary Grid' });
        expect(baseDetails.value('detailStats')).toMatchObject({ baseName: 'Main Outpost' });
        expect(baseDetails.value('logistics')).toMatchObject({ baseId });
        expect(baseDetails.value('allLogistics')).toHaveLength(1);
        expect(baseDetails.value('allDetailStats')[baseId]).toBeDefined();
        expect(baseDetails.value('planRows')).toEqual([]);
        expect(baseDetails.value('materialRows')).toMatchObject([{
            itemId: 'iron-plate',
            available: 60,
        }]);
        expect(baseDetails.value('coverageRows')).toEqual([]);

        const productionBuilding = baseDetails.value('selectedBase')!.buildings.find((building) => (
            building.sectionType === 'production'
        ))!;
        await dispatch(scenario, [appIds.events.BASES_REMOVE_BUILDING, productionBuilding.id]);
        expect(baseDetails.value('sectionStats').buildingCount).toBe(2);

        await dispatch(scenario, [appIds.events.ENERGY_GROUP_DELETE, group!.id]);
        expect(bases.value('energyGroups')).toEqual([]);
        expect(bases.value('energyGroupsById')).toEqual({});
        expect(baseDetails.value('selectedBase')!.energyGroupId).toBeUndefined();

        output = baseDetails.value('selectedBase')!.buildings.find((building) => building.id === output.id)!;
        expect(output.linkedOutput).toBeUndefined();

        await dispatch(scenario, [appIds.events.BASES_DELETE_BASE, baseId]);
        expect(bases.value('list')).toEqual([]);
        expect(bases.value('selectedId')).toBeNull();
    });

    it('creates, edits, runs, provisions, links, and deletes a production plan', async () => {
        const scenario = await createSeededScenario();
        const bases = mountView(scenario, 'production base', {
            list: [appIds.subscriptions.BASES_LIST],
            selectedBase: [appIds.subscriptions.BASES_SELECTED_BASE],
            planRows: [appIds.subscriptions.BASES_OVERVIEW_PLAN_ROWS],
            materialRows: [appIds.subscriptions.BASES_OVERVIEW_MATERIAL_BALANCE_ROWS],
            coverageRows: [appIds.subscriptions.BASES_OVERVIEW_BUILDING_COVERAGE_ROWS],
        } as const);

        await dispatch(scenario, [appIds.events.BASES_CREATE_BASE, 'Factory']);
        const baseId = bases.value('selectedBase')!.id;
        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_receiver',
            'inputs',
            1,
            'Ore intake',
            undefined,
            'iron-ore',
            60,
        ]);
        await dispatch(scenario, [
            appIds.events.BASES_ADD_BUILDINGS,
            baseId,
            'package_receiver',
            'outputs',
            1,
            'Ore export',
            undefined,
            'iron-ore',
            30,
        ]);

        const inputId = bases.value('selectedBase')!.buildings.find((building) => building.sectionType === 'inputs')!.id;
        const outputId = bases.value('selectedBase')!.buildings.find((building) => building.sectionType === 'outputs')!.id;
        const modal = mountView(scenario, 'production plan modal', {
            state: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_STATE],
            openState: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_OPEN_STATE],
            header: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_HEADER_DATA],
            formValues: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALUES],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FLOW],
            recipeOptions: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_OPTIONS],
            recipePresetState: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RECIPE_PRESET_STATE],
            corporationLevels: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_AVAILABLE_CORPORATION_LEVELS],
            inputSelector: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_INPUT_SELECTOR_DATA],
            linkableOutputs: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_LINKABLE_OUTPUTS],
            selectedItemId: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_SELECTED_ITEM_ID],
            deficits: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_RAW_MATERIAL_DEFICITS],
            valid: [appIds.subscriptions.PRODUCTION_PLAN_MODAL_FORM_VALIDITY],
        } as const);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_OPEN]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, ' Iron plates ']);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_ITEM, 'iron-plate']);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL,
            { corporationId: 'miners', level: 1 },
        ]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_SELECTED_CORPORATION_LEVEL,
            null,
        ]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTION,
            'iron-plate',
            'smelter_mk2:0',
        ]);
        expect(modal.value('recipePresetState')).toMatchObject({
            selections: { 'iron-plate': 'smelter_mk2:0' }, matchingPresets: [{ id: V2_RECIPE_PRESET_ID }], hasDefault: true,
        });
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_SET_RECIPE_SELECTIONS,
            { 'iron-plate': 'smelter:0' },
        ]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_TOGGLE_INPUT, inputId]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_MODAL_LINK_OUTPUT_INPUT,
            baseId,
            outputId,
            'package_receiver',
            'Linked ore',
        ]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, true]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_MATCH_INPUTS, false]);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_TARGET_AMOUNT, 120]);

        expect(modal.value('openState')).toEqual({ isOpen: true });
        expect(modal.value('header')).toEqual({ isEditMode: true });
        expect(modal.value('formValues')).toMatchObject({
            defaultName: ' Iron plates ',
            currentSelectedItemId: 'iron-plate',
            currentTargetAmount: 120,
        });
        expect(modal.value('selectedItemId')).toBe('iron-plate');
        expect(modal.value('flow').nodes.length).toBeGreaterThan(0);
        expect(modal.value('recipeOptions')).toHaveLength(1);
        expect(modal.value('corporationLevels')).toMatchObject([{ corporationId: 'miners', level: 1 }]);
        expect(modal.value('inputSelector').selectedInputIds).toHaveLength(2);
        expect(modal.value('linkableOutputs')).toMatchObject([{ baseId, baseBuildingId: outputId }]);
        expect(modal.value('deficits')).toMatchObject([{ itemId: 'iron-ore', itemName: 'Iron Ore' }]);
        expect(modal.value('valid')).toBe(true);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        const plan = bases.value('selectedBase')!.productions[0]!;
        expect(plan).toMatchObject({
            name: 'Iron plates',
            selectedItemId: 'iron-plate',
            targetAmount: 120,
            status: 'inactive',
        });
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);

        const planDetails = mountView(scenario, 'production plan section', {
            ids: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_IDS],
            entity: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ENTITY_BY_ID, baseId, plan.id],
            itemName: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_ITEM_NAME_BY_ITEM_ID, 'iron-plate'],
            flow: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_FLOW_BY_ID, baseId, plan.id],
            stats: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_STATS_BY_ID, baseId, plan.id],
            viewModel: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_VIEW_MODEL_BY_ID, baseId, plan.id],
            requirements: [appIds.subscriptions.PRODUCTION_PLAN_SECTION_REQUIREMENTS_STATUS_BY_ID, baseId, plan.id],
        } as const);

        expect(planDetails.value('ids')).toEqual([plan.id]);
        expect(planDetails.value('entity')).toMatchObject({ name: 'Iron plates' });
        expect(planDetails.value('itemName')).toBe('Iron Plate');
        expect(planDetails.value('flow').nodes.length).toBeGreaterThan(0);
        expect(planDetails.value('stats').buildingCount).toBeGreaterThan(0);
        expect(planDetails.value('viewModel')).toMatchObject({
            itemName: 'Iron Plate',
            planStatus: 'inactive',
        });
        expect(planDetails.value('requirements')).toMatchObject({
            itemName: 'Iron Plate',
            planStatus: 'inactive',
        });
        expect(bases.value('planRows')).toMatchObject([{ id: plan.id, name: 'Iron plates' }]);
        expect(bases.value('materialRows')).toHaveLength(1);
        expect(bases.value('coverageRows')).toMatchObject([{ buildingId: 'smelter', missing: 2 }]);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_ACTIVATE_SECTION, baseId, plan.id]);
        expect(planDetails.value('entity')).toMatchObject({ active: true, status: 'active' });
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            plan.id,
            'all',
        ]);
        await dispatch(scenario, [
            appIds.events.PRODUCTION_PLAN_ADD_BUILDINGS_TO_BASE,
            baseId,
            plan.id,
            'missing',
        ]);
        expect(bases.value('selectedBase')!.buildings.filter((building) => (
            building.buildingTypeId === 'smelter'
        ))).toHaveLength(2);

        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            outputId,
            {
                sourceProductionId: plan.id,
                allocationMode: 'fixed',
                requestedRatePerMinute: 30,
                capacityPerMinute: 60,
                priority: 1,
            },
        ]);
        expect(bases.value('selectedBase')!.buildings.find((building) => building.id === outputId)).toMatchObject({
            selectedItemId: 'iron-plate',
            sourceProductionId: plan.id,
            allocationMode: 'fixed',
            requestedRatePerMinute: 30,
            capacityPerMinute: 60,
            priority: 1,
        });
        await dispatch(scenario, [
            appIds.events.BASES_UPDATE_OUTPUT_PLAN_LINK,
            baseId,
            outputId,
            { sourceProductionId: null },
        ]);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_DEACTIVATE_SECTION, baseId, plan.id]);
        expect(planDetails.value('entity')).toMatchObject({ active: false, status: 'inactive' });

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_OPEN, plan.id]);
        expect(modal.value('header')).toEqual({ isEditMode: true });
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SET_NAME, 'Updated iron plates']);
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_SUBMIT]);
        expect(planDetails.value('entity')).toMatchObject({ name: 'Updated iron plates' });
        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_MODAL_CLOSE]);

        await dispatch(scenario, [appIds.events.PRODUCTION_PLAN_DELETE_SECTION, baseId, plan.id]);
        expect(planDetails.value('entity')).toBeNull();
        expect(planDetails.value('ids')).toEqual([]);
    });
});
