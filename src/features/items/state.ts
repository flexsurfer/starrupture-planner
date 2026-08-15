export interface ItemsFeatureState {
    itemsSelectedCategory: string;
    itemsSelectedBuilding: string;
    itemsSearchTerm: string;
}

/** Creates the UI state owned by the items feature. */
export function createItemsFeatureState(): ItemsFeatureState {
    return {
        itemsSelectedCategory: 'all',
        itemsSelectedBuilding: 'all',
        itemsSearchTerm: '',
    };
}
