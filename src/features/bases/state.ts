import type { Base, BaseCardCollapsedSections, BaseDetailTab } from '@/app/uklad/model';

export interface BasesFeatureState {
    basesList: Base[];
    basesCardCollapsedSections: Record<string, BaseCardCollapsedSections>;
    basesSelectedBaseId: string | null;
    basesSelectedDetailTab: BaseDetailTab;
}

/** Creates the persisted base-management state. */
export function createBasesFeatureState(): BasesFeatureState {
    return {
        basesList: [],
        basesCardCollapsedSections: {},
        basesSelectedBaseId: null,
        basesSelectedDetailTab: 'base',
    };
}
