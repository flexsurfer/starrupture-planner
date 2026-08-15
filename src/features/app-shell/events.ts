import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { buildItemsMap, extractCategories, parseCorporations } from '@/state/data-utils';
import { DEFAULT_DATA_VERSION, isValidDataVersion } from '@/state/gameDataVersion';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerAppShellEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.UI_SET_THEME, ({ draftState }, theme) => {
        draftState.uiTheme = theme;
        return [[appIds.effects.setTheme, theme]];
    });

    registrar.regEvent(appIds.events.UI_SET_ACTIVE_TAB, ({ draftState }, tab) => {
        draftState.uiActiveTab = tab;
    });

    registrar.regEvent(appIds.events.UI_SHOW_CONFIRMATION_DIALOG, ({ draftState }, title, message, onConfirm, options) => {
        draftState.uiConfirmationDialog = {
            isOpen: true,
            title,
            message,
            confirmLabel: options?.confirmLabel || 'Confirm',
            cancelLabel: options?.cancelLabel || 'Cancel',
            confirmButtonClass: options?.confirmButtonClass || 'btn-primary',
            onConfirm,
            onCancel: options?.onCancel,
        };
    });

    registrar.regEvent(appIds.events.UI_CLOSE_CONFIRMATION_DIALOG, ({ draftState }) => {
        draftState.uiConfirmationDialog.isOpen = false;
    });

    registrar.regEvent(appIds.events.APP_INIT, ({ draftState }) => {
        const version = isValidDataVersion(draftState.appDataVersion)
            ? draftState.appDataVersion
            : DEFAULT_DATA_VERSION;
        draftState.appDataVersion = version;
        return [
            [appIds.effects.setTheme, draftState.uiTheme],
            [appIds.effects.loadGameData, version],
        ];
    });

    registrar.regEvent(appIds.events.APP_REQUEST_LOAD_GAME_DATA, ({ draftState }, version) => {
        if (version === draftState.appDataVersion || draftState.uiGameDataLoadPending) return;
        draftState.uiGameDataLoadPending = true;
        return [[appIds.effects.loadGameData, version]];
    });

    registrar.regEvent(appIds.events.APP_GAME_DATA_LOAD_FAILED, ({ draftState }) => {
        draftState.uiGameDataLoadPending = false;
    });

    registrar.regEvent(appIds.events.APP_SET_DATA_VERSION, ({ draftState }, version, bundle) => {
        if (bundle) {
            draftState.appVersionedData[version] = bundle;
        }

        const data = draftState.appVersionedData[version];
        if (!data) return;

        draftState.appDataVersion = version;
        draftState.itemsList = data.items;
        draftState.itemsById = buildItemsMap(data.items);
        draftState.buildingsList = data.buildings;
        draftState.corporationsList = parseCorporations(data.corporations);
        draftState.itemsCategories = extractCategories(data.items);
        if (bundle !== undefined) {
            draftState.uiGameDataLoadPending = false;
        }
    });
};
