// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import { appIds } from '@/app/uklad/catalog';
import type { GameDataBundle } from '@/app/uklad/game-data';
import type { DataVersion } from '@/features/app-shell/data-version';
import {
    createHeadlessE2EApp,
    TEST_GAME_DATA,
    type HeadlessE2EApp,
} from './e2e-support';

interface Deferred<T> {
    promise: Promise<T>;
    resolve(value: T): void;
    reject(error: unknown): void;
}

function createDeferred<T>(): Deferred<T> {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe('headless application shell E2E', () => {
    const apps: HeadlessE2EApp[] = [];
    const createApp = (options?: Parameters<typeof createHeadlessE2EApp>[0]) => {
        const app = createHeadlessE2EApp(options);
        apps.push(app);
        return app;
    };

    afterEach(async () => {
        await Promise.all(apps.splice(0).map((app) => app.dispose()));
    });

    it('emulates defaults, cached data-version views, navigation, theme, and dialogs', async () => {
        const themes: Array<'light' | 'dark'> = [];
        const app = createApp({
            application: { effects: { onThemeChange: (theme) => themes.push(theme) } },
        });
        const shell = app.mountView('shell', {
            version: [appIds.subscriptions.APP_DATA_VERSION],
            versions: [appIds.subscriptions.APP_DATA_VERSIONS],
            theme: [appIds.subscriptions.UI_THEME],
            pending: [appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING],
            activeTab: [appIds.subscriptions.UI_ACTIVE_TAB],
            confirmation: [appIds.subscriptions.UI_CONFIRMATION_DIALOG],
            items: [appIds.subscriptions.ITEMS_LIST],
            buildings: [appIds.subscriptions.BUILDINGS_LIST],
            corporations: [appIds.subscriptions.CORPORATIONS_LIST],
        } as const);

        expect(shell.current()).toMatchObject({
            version: 'update1',
            theme: 'dark',
            pending: false,
            activeTab: 'items',
            items: [],
            buildings: [],
            corporations: [],
        });
        expect(shell.value('versions').map(({ id }) => id)).toEqual([
            'earlyaccess',
            'playtest',
            'update1_PTB',
            'update1',
        ]);

        await app.dispatch([appIds.events.APP_SET_DATA_VERSION, 'playtest']);
        expect(shell.value('version')).toBe('update1');
        expect(shell.value('items')).toEqual([]);

        await app.seed('playtest');
        await app.seed('update1');
        await app.dispatch([appIds.events.APP_SET_DATA_VERSION, 'playtest']);
        expect(shell.value('version')).toBe('playtest');
        expect(shell.value('items')).toHaveLength(TEST_GAME_DATA.items.length);
        expect(shell.value('buildings')).toHaveLength(TEST_GAME_DATA.buildings.length);
        expect(shell.value('corporations').map(({ name }) => name)).toEqual(['Miners', 'Engineers']);

        await app.dispatch([appIds.events.UI_SET_THEME, 'light']);
        await app.dispatch([appIds.events.UI_SET_ACTIVE_TAB, 'mybases']);
        expect(shell.current()).toMatchObject({ theme: 'light', activeTab: 'mybases' });
        expect(themes).toEqual(['light']);

        const defaultConfirm = vi.fn();
        await app.dispatch([
            appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
            'Default dialog',
            'Default actions',
            defaultConfirm,
        ]);
        expect(shell.value('confirmation')).toMatchObject({
            isOpen: true,
            confirmLabel: 'Confirm',
            cancelLabel: 'Cancel',
            confirmButtonClass: 'btn-primary',
        });
        shell.value('confirmation').onConfirm();
        expect(defaultConfirm).toHaveBeenCalledOnce();

        const customConfirm = vi.fn();
        const customCancel = vi.fn();
        await app.dispatch([
            appIds.events.UI_SHOW_CONFIRMATION_DIALOG,
            'Custom dialog',
            'Custom actions',
            customConfirm,
            {
                confirmLabel: 'Remove',
                cancelLabel: 'Keep',
                confirmButtonClass: 'btn-error',
                onCancel: customCancel,
            },
        ]);
        expect(shell.value('confirmation')).toMatchObject({
            title: 'Custom dialog',
            message: 'Custom actions',
            confirmLabel: 'Remove',
            cancelLabel: 'Keep',
            confirmButtonClass: 'btn-error',
        });
        shell.value('confirmation').onConfirm();
        shell.value('confirmation').onCancel?.();
        expect(customConfirm).toHaveBeenCalledOnce();
        expect(customCancel).toHaveBeenCalledOnce();

        await app.dispatch([appIds.events.UI_CLOSE_CONFIRMATION_DIALOG]);
        expect(shell.value('confirmation').isOpen).toBe(false);
    });

    it('emulates successful, duplicate, same-version, and failed asynchronous loads', async () => {
        const pendingLoads = new Map<DataVersion, Deferred<GameDataBundle>>();
        const onLoadError = vi.fn();
        const onThemeChange = vi.fn();
        const loadGameDataVersion = vi.fn((version: DataVersion) => {
            const deferred = createDeferred<GameDataBundle>();
            pendingLoads.set(version, deferred);
            return deferred.promise;
        });
        const app = createApp({
            application: {
                effects: { loadGameDataVersion, onLoadError, onThemeChange },
            },
        });
        const shell = app.mountView('async shell', {
            version: [appIds.subscriptions.APP_DATA_VERSION],
            pending: [appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING],
            items: [appIds.subscriptions.ITEMS_LIST],
        } as const);

        await app.dispatch([appIds.events.APP_INIT]);
        expect(onThemeChange.mock.calls[0]?.[0]).toBe('dark');
        expect(loadGameDataVersion).toHaveBeenCalledWith('update1');
        expect(shell.value('pending')).toBe(false);

        pendingLoads.get('update1')!.resolve(TEST_GAME_DATA);
        await vi.waitFor(async () => {
            await app.scenario.settle();
            expect(shell.value('items')).toHaveLength(TEST_GAME_DATA.items.length);
        });

        await app.dispatch([appIds.events.APP_REQUEST_LOAD_GAME_DATA, 'update1']);
        expect(loadGameDataVersion).toHaveBeenCalledTimes(1);

        await app.dispatch([appIds.events.APP_REQUEST_LOAD_GAME_DATA, 'playtest']);
        expect(shell.value('pending')).toBe(true);
        expect(loadGameDataVersion).toHaveBeenCalledTimes(2);

        await app.dispatch([appIds.events.APP_REQUEST_LOAD_GAME_DATA, 'earlyaccess']);
        expect(loadGameDataVersion).toHaveBeenCalledTimes(2);
        expect(pendingLoads.has('earlyaccess')).toBe(false);

        pendingLoads.get('playtest')!.resolve(TEST_GAME_DATA);
        await vi.waitFor(async () => {
            await app.scenario.settle();
            expect(shell.current()).toMatchObject({ version: 'playtest', pending: false });
        });

        await app.dispatch([appIds.events.APP_REQUEST_LOAD_GAME_DATA, 'earlyaccess']);
        const loadError = new Error('fixture load failed');
        pendingLoads.get('earlyaccess')!.reject(loadError);
        await vi.waitFor(async () => {
            await app.scenario.settle();
            expect(shell.value('pending')).toBe(false);
            expect(onLoadError).toHaveBeenCalledWith(loadError);
        });
        expect(shell.value('version')).toBe('playtest');

        await app.dispatch([appIds.events.APP_GAME_DATA_LOAD_FAILED]);
        expect(shell.value('pending')).toBe(false);
    });

    it('recovers a corrupt cached data version through the production init flow', async () => {
        const loadGameDataVersion = vi.fn(async () => TEST_GAME_DATA);
        const app = createApp({
            application: { effects: { loadGameDataVersion } },
        });
        const shell = app.mountView('recovered shell', {
            version: [appIds.subscriptions.APP_DATA_VERSION],
            items: [appIds.subscriptions.ITEMS_LIST],
        } as const);
        const corruptVersion = 'corrupt-cache-value' as DataVersion;

        await app.dispatch([
            appIds.events.APP_SET_DATA_VERSION,
            corruptVersion,
            TEST_GAME_DATA,
        ]);
        expect(shell.value('version')).toBe(corruptVersion);

        await app.dispatch([appIds.events.APP_INIT]);
        await vi.waitFor(async () => {
            await app.scenario.settle();
            expect(shell.value('version')).toBe('update1');
            expect(shell.value('items')).toHaveLength(TEST_GAME_DATA.items.length);
        });
        expect(loadGameDataVersion).toHaveBeenCalledWith('update1');
    });

    it('reports failed loads through the default headless error adapter', async () => {
        const loadError = new Error('default adapter failure');
        const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
        const app = createApp({
            application: {
                effects: {
                    loadGameDataVersion: async () => Promise.reject(loadError),
                },
            },
        });
        const shell = app.mountView('default error shell', {
            pending: [appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING],
            version: [appIds.subscriptions.APP_DATA_VERSION],
        } as const);

        try {
            await app.dispatch([appIds.events.APP_REQUEST_LOAD_GAME_DATA, 'playtest']);
            await vi.waitFor(async () => {
                await app.scenario.settle();
                expect(shell.value('pending')).toBe(false);
            });
            expect(shell.value('version')).toBe('update1');
            expect(consoleError).toHaveBeenCalledWith('Failed to load bundled game data:', loadError);
        } finally {
            consoleError.mockRestore();
        }
    });
});
