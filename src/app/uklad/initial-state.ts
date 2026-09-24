import { message } from '@/shared/i18n/core';
import { DEFAULT_LOCALE, normalizeLocale } from '@/shared/i18n/locales';
import { createDataTransferState } from '@/features/data-transfer/archive';
import type { AppState } from '@/app/uklad/model';
import { DATA_VERSIONS, DEFAULT_DATA_VERSION } from '@/features/app-shell/data-version';
import { createItemsFeatureState } from '@/features/items/state';
import { createPlannerFeatureState } from '@/features/planner/state';
import { createBasesFeatureState } from '@/features/bases/state';
import { createEnergyGroupsFeatureState } from '@/features/energy-groups/state';
import { createProductionPlanModalFeatureState } from '@/features/production-plan-modal/state';

/** Creates state owned by exactly one Uklad runtime. */
export function createAppState(initialLocale: string = DEFAULT_LOCALE): AppState {
    return {
        ...createDataTransferState(),
        appDataVersion: DEFAULT_DATA_VERSION,
        appDataVersions: DATA_VERSIONS.map((version) => ({ ...version })),
        appVersionedData: {},
        itemsList: [],
        itemsById: {},
        ...createItemsFeatureState(),
        itemsCategories: [],
        buildingsList: [],
        corporationsList: [],
        uiLocale: normalizeLocale(initialLocale),
        uiTheme: 'dark',
        uiGameDataLoadPending: false,
        uiActiveTab: 'items',
        uiConfirmationDialog: {
            isOpen: false,
            title: '',
            message: '',
            confirmLabel: message('Confirm'),
            cancelLabel: message('Cancel'),
            confirmButtonClass: 'btn-primary',
            onConfirm: () => {},
            onCancel: undefined,
        },
        ...createPlannerFeatureState(),
        ...createBasesFeatureState(),
        ...createEnergyGroupsFeatureState(),
        ...createProductionPlanModalFeatureState(),
    };
}
