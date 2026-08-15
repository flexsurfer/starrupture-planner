import type { CreateProductionPlanModalState } from '@/app/uklad/model';

export interface ProductionPlanModalFeatureState {
    productionPlanModalState: CreateProductionPlanModalState;
}

/** Creates the modal's independent form state. */
export function createProductionPlanModalFeatureState(): ProductionPlanModalFeatureState {
    return {
        productionPlanModalState: {
            isOpen: false,
            baseId: null,
            editSectionId: null,
            name: '',
            selectedItemId: '',
            targetAmount: 60,
            selectedCorporationLevel: null,
            selectedInputIds: [],
            recipeSelections: {},
            matchInputs: false,
        },
    };
}
