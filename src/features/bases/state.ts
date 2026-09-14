import type { Base, BaseCardCollapsedSections, BaseDetailTab } from '@/app/uklad/model';

export type BasesMode = 'planning' | 'advanced';

export interface BasesFeatureState {
    basesMode: BasesMode | null;
    basesList: Base[];
    basesCardCollapsedSections: Record<string, BaseCardCollapsedSections>;
    basesSelectedBaseId: string | null;
    basesSelectedDetailTab: BaseDetailTab;
    basesDetailsExpanded: boolean;
}

/** Creates the persisted base-management state. */
export function createBasesFeatureState(): BasesFeatureState {
    return {
        basesMode: null,
        basesList: [],
        basesCardCollapsedSections: {},
        basesSelectedBaseId: null,
        basesSelectedDetailTab: 'base',
        basesDetailsExpanded: true,
    };
}
