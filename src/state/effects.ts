import { EFFECT_IDS } from './effect-ids';
import type { UkladContracts, UkladRegistrar } from '@ukladjs/core/vanilla';
import { EVENT_IDS } from './event-ids';
import type { DataVersion } from './db';
import { gameDataBundleToAppVersioned, loadGameDataVersion } from './gameDataLoader';

/** Web platform effects. Durable roots are written by @ukladjs/persist. */
export const registerEffects = (registrar: UkladRegistrar<UkladContracts>) => {
    registrar.regEffect(EFFECT_IDS.SET_THEME, (newTheme: 'light' | 'dark') => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', newTheme);
        }
    });

    registrar.regEffect(EFFECT_IDS.LOAD_GAME_DATA, (version: DataVersion, runtime: { dispatch: (event: [string, ...unknown[]]) => void }) => {
        void loadGameDataVersion(version)
            .then((raw) => {
                runtime.dispatch([EVENT_IDS.APP_SET_DATA_VERSION, version, gameDataBundleToAppVersioned(raw)]);
            })
            .catch((error) => {
                console.error('Failed to load game data:', error);
                if (typeof window !== 'undefined') {
                    window.alert('Could not load game data. Check your connection and reload the page.');
                }
                runtime.dispatch([EVENT_IDS.APP_GAME_DATA_LOAD_FAILED]);
            });
    });
};
