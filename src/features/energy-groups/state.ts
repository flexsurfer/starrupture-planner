import type { EnergyGroup } from '@/app/uklad/model';

export interface EnergyGroupsFeatureState {
    energyGroups: EnergyGroup[];
}

/** Creates the persisted energy-grid collection. */
export function createEnergyGroupsFeatureState(): EnergyGroupsFeatureState {
    return { energyGroups: [] };
}
