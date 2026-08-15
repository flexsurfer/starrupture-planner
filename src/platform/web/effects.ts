import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { gameDataBundleToAppVersioned, loadGameDataVersion } from '@/state/gameDataLoader';

export const registerWebEffects: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEffect(appIds.effects.setTheme, (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
    });

    registrar.regEffect(appIds.effects.loadGameData, (version, runtime) => {
        void loadGameDataVersion(version)
            .then((raw) => runtime.dispatch([
                appIds.events.APP_SET_DATA_VERSION,
                version,
                gameDataBundleToAppVersioned(raw),
            ]))
            .catch((error: unknown) => {
                console.error('Failed to load game data:', error);
                window.alert('Could not load game data. Check your connection and reload the page.');
                runtime.dispatch([appIds.events.APP_GAME_DATA_LOAD_FAILED]);
            });
    });
};
