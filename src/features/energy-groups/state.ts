import type { EnergyGroup } from '@/state/db';

export interface EnergyGroupsFeatureState {
    energyGroups: EnergyGroup[];
}

/** Creates the persisted energy-grid collection. */
export function createEnergyGroupsFeatureState(): EnergyGroupsFeatureState {
    return { energyGroups: [] };
}
