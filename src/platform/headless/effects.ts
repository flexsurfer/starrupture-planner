import { message, UiMessageError } from '@/shared/i18n/core';
import { parseArchive, prepareArchiveImport, type PlannerArchive } from '@/features/data-transfer/archive';
import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { gameDataBundleToAppVersioned, loadHeadlessGameDataVersion } from './game-data-loader';

export interface HeadlessEffectOptions {
    onExport?: (archive: PlannerArchive) => void;
    createImportId?: () => string;
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
    onExport,
    createImportId = () => crypto.randomUUID(),
    onThemeChange = () => {},
    onLoadError = (error) => console.error('Failed to load bundled game data:', error),
}: HeadlessEffectOptions = {}): UkladModule<UkladRegistrar<AppContracts>> {
    return (registrar) => {
        registrar.regEffect(appIds.effects.downloadArchive, (archive, runtime) => {
            // Headless exports go to an explicit sink; no browser download is implied.
            if (onExport) onExport(archive);
            else runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, { kind: 'error', message: message('No export destination configured.') }]);
        });
        registrar.regEffect(appIds.effects.readArchive, (text, runtime) => {
            try {
                runtime.dispatch([appIds.events.DATA_TRANSFER_IMPORT_READY,
                    prepareArchiveImport(parseArchive(text), createImportId())]);
            } catch (error) {
                runtime.dispatch([appIds.events.DATA_TRANSFER_SET_STATUS, {
                    kind: 'error', message: error instanceof UiMessageError ? error.uiMessage : message('Could not read this export.'),
                }]);
            }
        });
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
