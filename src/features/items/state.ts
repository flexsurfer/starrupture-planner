export interface ItemsFeatureState {
    itemsSelectedCategory: string;
    itemsCodexSelectedCategory: string;
    itemsSelectedBuilding: string;
    itemsCodexSelectedBuilding: string;
    itemsSearchTerm: string;
    itemsCodexSearchTerm: string;
}

/** Creates the UI state owned by the items feature. */
export function createItemsFeatureState(): ItemsFeatureState {
    return {
        itemsSelectedCategory: 'all',
        itemsCodexSelectedCategory: 'all',
        itemsSelectedBuilding: 'all',
        itemsCodexSelectedBuilding: 'all',
        itemsSearchTerm: '',
        itemsCodexSearchTerm: '',
    };
}
