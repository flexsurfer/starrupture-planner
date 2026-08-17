import {
    createUkladHeadlessScenario,
    type UkladHeadlessScenario,
    type UkladHeadlessView,
    type UkladHeadlessViewQueries,
} from '@ukladjs/core/testing';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { AppVersionedGameData } from '@/app/uklad/model';
import { createAppRuntime } from '@/app/uklad/runtime';
import type { DataVersion } from '@/features/app-shell/data-version';
import { registerHeadlessApplication, type HeadlessApplicationOptions } from './register';

export type AppScenario = UkladHeadlessScenario<AppContracts>;
export type AppEvent = Parameters<AppScenario['dispatch']>[0];

export interface E2ECoverage {
    eventIds: Set<string>;
    subscriptionIds: Set<string>;
}

export interface HeadlessE2EApp {
    readonly scenario: AppScenario;
    dispatch(event: AppEvent): Promise<void>;
    dispatchAll(events: AppEvent[]): Promise<void>;
    mountView<TQueries extends UkladHeadlessViewQueries<AppContracts>>(
        name: string,
        queries: TQueries,
    ): UkladHeadlessView<AppContracts, TQueries>;
    seed(version?: DataVersion, gameData?: AppVersionedGameData): Promise<void>;
    dispose(): Promise<void>;
}

export interface HeadlessE2EAppOptions {
    application?: HeadlessApplicationOptions;
    coverage?: E2ECoverage;
    runtimeId?: string;
}

let runtimeSequence = 0;

export function createHeadlessE2EApp({
    application,
    coverage,
    runtimeId,
}: HeadlessE2EAppOptions = {}) {
    runtimeSequence += 1;
    const runtime = createAppRuntime({
        runtimeId: runtimeId ?? `headless-e2e-${runtimeSequence}`,
    });
    registerHeadlessApplication(runtime, application);
    const scenario = createUkladHeadlessScenario(runtime);

    return {
        scenario,
        async dispatch(event: AppEvent): Promise<void> {
            coverage?.eventIds.add(event[0]);
            scenario.dispatch(event);
            await scenario.settle();
        },
        async dispatchAll(events: AppEvent[]): Promise<void> {
            for (const event of events) {
                coverage?.eventIds.add(event[0]);
                scenario.dispatch(event);
            }
            await scenario.settle();
        },
        mountView<TQueries extends UkladHeadlessViewQueries<AppContracts>>(
            name: string,
            queries: TQueries,
        ) {
            for (const query of Object.values(queries)) {
                coverage?.subscriptionIds.add(query[0]);
            }
            return scenario.mountView(name, queries);
        },
        async seed(
            version: DataVersion = 'playtest',
            gameData: AppVersionedGameData = TEST_GAME_DATA,
        ): Promise<void> {
            coverage?.eventIds.add(appIds.events.APP_SET_DATA_VERSION);
            scenario.dispatch([appIds.events.APP_SET_DATA_VERSION, version, gameData]);
            await scenario.settle();
        },
        dispose: () => scenario.dispose(),
    };
}

/**
 * Small but deliberately feature-complete data graph for deterministic E2E
 * scenarios. Real bundled data is exercised separately for compatibility.
 */
export const TEST_GAME_DATA = {
    items: [
        { id: 'iron-ore', name: 'Iron Ore', type: 'raw' },
        { id: 'copper-ore', name: 'Copper Ore', type: 'raw' },
        { id: 'iron-plate', name: 'Iron Plate', type: 'processed' },
        { id: 'copper-wire', name: 'Copper Wire', type: 'processed' },
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
                { level: 2, heatCapacity: 400 },
            ],
        },
        {
            id: 'ore_excavator',
            name: 'Ore Excavator',
            type: 'production',
            power: 5,
            heat: 2,
            recipes: [
                { output: { id: 'iron-ore', amount_per_minute: 60 }, inputs: [] },
                { output: { id: 'copper-ore', amount_per_minute: 45 }, inputs: [] },
            ],
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
            id: 'wiremill',
            name: 'Wiremill',
            type: 'production',
            power: 8,
            heat: 4,
            recipes: [{
                output: { id: 'copper-wire', amount_per_minute: 90 },
                inputs: [{ id: 'copper-ore', amount_per_minute: 45 }],
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
                inputs: [
                    { id: 'iron-plate', amount_per_minute: 60 },
                    { id: 'copper-wire', amount_per_minute: 30 },
                ],
            }],
        },
        { id: 'package_receiver', name: 'Package Receiver', type: 'storage', power: 1 },
        { id: 'package_dispatcher', name: 'Package Dispatcher', type: 'storage', power: 1 },
        { id: 'drone_merger_3_to_1', name: 'Drone Merger', type: 'storage', power: 2 },
        { id: 'power_generator', name: 'Power Generator', type: 'generator', power: 100, heat: 2 },
        { id: 'base_core_amplifier_v1', name: 'Core Amplifier', type: 'temperature', coreHeatCapacity: 50 },
        { id: 'habitat', name: 'Habitat', type: 'habitat', power: 3, heat: 1 },
        { id: 'turret', name: 'Turret', type: 'defense', power: 4, heat: 3 },
        { id: 'teleporter', name: 'Teleporter', type: 'infrastructure', power: 25, heat: 12 },
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
        Engineers: {
            id: 'engineers',
            description: 'Advanced production specialists',
            levels: [{
                level: 2,
                components: [{ id: 'copper-wire', points: 3 }],
                rewards: [{ name: 'Assembler' }],
            }],
        },
    },
} satisfies AppVersionedGameData;
