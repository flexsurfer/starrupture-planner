import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base, EnergyGroup } from '@/state/db';

function normalizeEnergyGroupName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
}

function findEnergyGroupByName(groups: EnergyGroup[], name: string): EnergyGroup | undefined {
    const normalizedName = normalizeEnergyGroupName(name).toLowerCase();
    if (!normalizedName) return undefined;
    return groups.find((group) => normalizeEnergyGroupName(group.name).toLowerCase() === normalizedName);
}

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
}

function createEnergyGroupId(): string {
    return `eg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const registerEnergyGroupsEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.ENERGY_GROUP_CREATE, ({ draftState }, name, assignBaseId) => {
        const normalizedName = normalizeEnergyGroupName(name);
        if (!normalizedName) return;

        const existingGroup = findEnergyGroupByName(draftState.energyGroups, normalizedName);
        const targetGroup = existingGroup ?? { id: createEnergyGroupId(), name: normalizedName };
        if (!existingGroup) draftState.energyGroups.push(targetGroup);
        if (!assignBaseId) return;

        const base = getBaseById(draftState.basesList, assignBaseId);
        if (base && base.energyGroupId !== targetGroup.id) {
            base.energyGroupId = targetGroup.id;
        }
    });

    registrar.regEvent(appIds.events.ENERGY_GROUP_DELETE, ({ draftState }, groupId) => {
        if (!draftState.energyGroups.some((group) => group.id === groupId)) return;

        draftState.energyGroups = draftState.energyGroups.filter((group) => group.id !== groupId);
        for (const base of draftState.basesList) {
            if (base.energyGroupId === groupId) delete base.energyGroupId;
        }
    });

    registrar.regEvent(appIds.events.ENERGY_GROUP_RENAME, ({ draftState }, groupId, name) => {
        const group = draftState.energyGroups.find((candidate) => candidate.id === groupId);
        if (!group) return;

        const normalizedName = normalizeEnergyGroupName(name);
        if (!normalizedName) return;
        const duplicateByName = draftState.energyGroups.find((candidate) => (
            candidate.id !== groupId
            && normalizeEnergyGroupName(candidate.name).toLowerCase() === normalizedName.toLowerCase()
        ));
        if (!duplicateByName && group.name !== normalizedName) {
            group.name = normalizedName;
        }
    });
};
