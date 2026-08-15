import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';

export const registerAppShellSubscriptions: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regRootSub(appIds.subscriptions.APP_DATA_VERSION, stateKeys.appDataVersion);
    registrar.regRootSub(appIds.subscriptions.APP_DATA_VERSIONS, stateKeys.appDataVersions);
    registrar.regRootSub(appIds.subscriptions.UI_THEME, stateKeys.uiTheme);
    registrar.regRootSub(appIds.subscriptions.UI_GAME_DATA_LOAD_PENDING, stateKeys.uiGameDataLoadPending);
    registrar.regRootSub(appIds.subscriptions.UI_ACTIVE_TAB, stateKeys.uiActiveTab);
    registrar.regRootSub(appIds.subscriptions.UI_CONFIRMATION_DIALOG, stateKeys.uiConfirmationDialog);
};
