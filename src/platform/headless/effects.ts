import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion } from './game-data-loader';

/**
 * Node-safe adapters for automation and MCP inspection. Theme changes deliberately
 * do nothing because a headless runtime has no document to update.
 */
export const registerHeadlessEffects: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEffect(appIds.effects.setTheme, () => {});

    registrar.regEffect(appIds.effects.loadGameData, (version, runtime) => {
        void loadHeadlessGameDataVersion(version)
            .then((raw) => runtime.dispatch([
                appIds.events.APP_SET_DATA_VERSION,
                version,
                gameDataBundleToAppVersioned(raw),
            ]))
            .catch((error: unknown) => {
                console.error('Failed to load bundled game data:', error);
                runtime.dispatch([appIds.events.APP_GAME_DATA_LOAD_FAILED]);
            });
    });
};
