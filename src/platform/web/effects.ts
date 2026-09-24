import { getLocaleMessages, normalizeLocale } from '@/shared/i18n/locales';
import { createTranslator, message, UiMessageError } from '@/shared/i18n/core';
import { parseArchive, prepareArchiveImport } from '@/features/data-transfer/archive';
import { downloadArchive } from './archive-transfer';
import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { gameDataBundleToAppVersioned, loadGameDataVersion } from '@/platform/web/game-data-loader';

export const registerWebEffects: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEffect(appIds.effects.downloadArchive, (archive, runtime) => {
        try {
            downloadArchive(archive);
            runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, { kind: 'success', message: message('Export downloaded.') }]);
        } catch {
            runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, { kind: 'error', message: message('Could not download the export. Please try again.') }]);
        }
    });
    registrar.regEffect(appIds.effects.readArchive, (text, runtime) => {
        try {
            const archive = prepareArchiveImport(parseArchive(text), crypto.randomUUID());
            runtime.dispatch([appIds.events.DATA_TRANSFER_IMPORT_READY, archive]);
        } catch (error) {
            runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, {
                kind: 'error', message: error instanceof UiMessageError ? error.uiMessage : message('Could not read this export.'),
            }]);
        }
    });
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
                const locale = normalizeLocale(document.documentElement.lang);
                window.alert(createTranslator(locale, getLocaleMessages(locale))('Could not load game data. Check your connection and reload the page.'));
                runtime.dispatch([appIds.events.APP_GAME_DATA_LOAD_FAILED]);
            });
    });
};
