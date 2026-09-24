import { message } from '@/shared/i18n/core';
import { current, type UkladModule, type UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds, stateKeys } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import { createArchive, selectArchiveImports } from './archive';

export const registerDataTransferModule: UkladModule<UkladRegistrar<AppContracts>> = registrar => {
    registrar.regRootSub(appIds.subscriptions.DATA_TRANSFER_PREVIEW, stateKeys.dataTransferPreview);
    registrar.regRootSub(appIds.subscriptions.DATA_TRANSFER_STATUS, stateKeys.dataTransferStatus);
    registrar.regEvent(appIds.events.DATA_TRANSFER_SET_STATUS, ({ draftState }, status) => {
        draftState.dataTransferStatus = status;
    });
    registrar.regEvent(appIds.events.DATA_TRANSFER_EXPORT, ({ draftState }, selection) => {
        draftState.dataTransferStatus = null;
        const archive = createArchive(draftState, selection);
        if (!archive.bases.length && !archive.plans.length) {
            draftState.dataTransferStatus = { kind: 'error', message: message('Select at least one base or planner plan to export.') };
            return;
        }
        return [[appIds.effects.downloadArchive, archive]];
    });
    registrar.regEvent(appIds.events.DATA_TRANSFER_PREVIEW_IMPORT, ({ draftState }, text) => {
        draftState.dataTransferPreview = null;
        draftState.dataTransferStatus = null;
        return [[appIds.effects.readArchive, text]];
    });
    registrar.regEvent(appIds.events.DATA_TRANSFER_IMPORT_READY, ({ draftState }, archive) => {
        draftState.dataTransferPreview = archive;
    });
    registrar.regEvent(appIds.events.DATA_TRANSFER_CANCEL_IMPORT, ({ draftState }) => {
        draftState.dataTransferPreview = null;
    });
    registrar.regEvent(appIds.events.DATA_TRANSFER_CONFIRM_IMPORT, ({ draftState }, selection = { baseIds: null, planIds: null }) => {
        if (!draftState.dataTransferPreview) return;
        const archive = selectArchiveImports(current(draftState.dataTransferPreview), selection);
        if (!archive.bases.length && !archive.plans.length) {
            draftState.dataTransferStatus = { kind: 'error', message: message('Select at least one base or planner plan to import.') };
            return;
        }
        const collision = archive.bases.some(base => draftState.basesList.some(existing => existing.id === base.id))
            || archive.plans.some(plan => draftState.plannerTabs.some(existing => existing.id === plan.id))
            || archive.energyGroups.some(group => draftState.energyGroups.some(existing => existing.id === group.id));
        if (collision) {
            draftState.dataTransferStatus = { kind: 'error', message: message('These copies have already been imported. Choose the file again to create new copies.') };
            draftState.dataTransferPreview = null;
            return;
        }
        draftState.basesList.push(...archive.bases);
        draftState.plannerTabs.push(...archive.plans);
        draftState.energyGroups.push(...archive.energyGroups);
        if (archive.bases.length && draftState.basesMode === null) draftState.basesMode = archive.basesMode ?? 'planning';
        if (!draftState.plannerActiveTabId && archive.plans.length) draftState.plannerActiveTabId = archive.plans[0].id;
        draftState.dataTransferPreview = null;
        draftState.dataTransferStatus = {
            kind: 'success', message: message('Imported copies. Bases: {bases}. Planner plans: {plans}.', { bases: archive.bases.length, plans: archive.plans.length }),
        };
    });
};
