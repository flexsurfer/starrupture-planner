import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion } from './game-data-loader';

export interface HeadlessEffectOptions {
    loadGameDataVersion?: typeof loadHeadlessGameDataVersion;
    onThemeChange?: (theme: 'light' | 'dark') => void;
    onLoadError?: (error: unknown) => void;
}

/**
 * Node-safe adapters for automation and MCP inspection. Theme changes deliberately
 * do nothing because a headless runtime has no document to update.
 */
export function createHeadlessEffects({
    loadGameDataVersion = loadHeadlessGameDataVersion,
    onThemeChange = () => {},
    onLoadError = (error) => console.error('Failed to load bundled game data:', error),
}: HeadlessEffectOptions = {}): UkladModule<UkladRegistrar<AppContracts>> {
    return (registrar) => {
        registrar.regEffect(appIds.effects.setTheme, (theme) => onThemeChange(theme));

        registrar.regEffect(appIds.effects.loadGameData, (version, runtime) => {
            void loadGameDataVersion(version)
                .then((raw) => runtime.dispatch([
                    appIds.events.APP_SET_DATA_VERSION,
                    version,
                    gameDataBundleToAppVersioned(raw),
                ]))
                .catch((error: unknown) => {
                    onLoadError(error);
                    runtime.dispatch([appIds.events.APP_GAME_DATA_LOAD_FAILED]);
                });
        });
    };
}

export const registerHeadlessEffects = createHeadlessEffects();
