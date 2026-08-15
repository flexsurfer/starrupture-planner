import { DATA_VERSIONS, DEFAULT_DATA_VERSION, type AppState } from '@/state/db';
import { createItemsFeatureState } from '@/features/items/state';
import { createPlannerFeatureState } from '@/features/planner/state';
import { createBasesFeatureState } from '@/features/bases/state';
import { createEnergyGroupsFeatureState } from '@/features/energy-groups/state';
import { createProductionPlanModalFeatureState } from '@/features/production-plan-modal/state';

/** Creates state owned by exactly one Uklad runtime. */
export function createAppState(): AppState {
    return {
        appDataVersion: DEFAULT_DATA_VERSION,
        appDataVersions: DATA_VERSIONS.map((version) => ({ ...version })),
        appVersionedData: {},
        itemsList: [],
        itemsById: {},
        ...createItemsFeatureState(),
        itemsCategories: [],
        buildingsList: [],
        corporationsList: [],
        uiTheme: 'dark',
        uiGameDataLoadPending: false,
        uiActiveTab: 'items',
        uiConfirmationDialog: {
            isOpen: false,
            title: '',
            message: '',
            confirmLabel: 'Confirm',
            cancelLabel: 'Cancel',
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
