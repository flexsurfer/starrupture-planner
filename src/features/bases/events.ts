import type { UkladModule, UkladRegistrar } from '@ukladjs/core/vanilla';
import { appIds } from '@/app/uklad/catalog';
import type { AppContracts } from '@/app/uklad/contracts';
import type { Base, BaseCardSectionKey } from '@/state/db';
import { getDefaultBaseCardSectionCollapsed } from '@/state/base-card-sections';

function getBaseById(bases: Base[], baseId: string): Base | undefined {
    return bases.find((base) => base.id === baseId);
}

function createBaseId(): string {
    return `base_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function createBaseBuildingId(): string {
    return `building_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const registerBasesEvents: UkladModule<UkladRegistrar<AppContracts>> = (registrar) => {
    registrar.regEvent(appIds.events.BASES_CREATE_BASE, ({ draftState }, name) => {
        const baseId = createBaseId();
        draftState.basesList.push({
            id: baseId,
            name,
            buildings: [],
            productions: [],
        });
        draftState.basesSelectedBaseId = baseId;
        draftState.basesSelectedDetailTab = 'base';
    });

    registrar.regEvent(appIds.events.BASES_UPDATE_BASE_NAME, ({ draftState }, baseId, name) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (base) base.name = name;
    });

    registrar.regEvent(appIds.events.BASES_SET_CORE_LEVEL, ({ draftState }, level) => {
        if (!draftState.basesSelectedBaseId) return;
        const base = getBaseById(draftState.basesList, draftState.basesSelectedBaseId);
        if (base) base.coreLevel = level;
    });

    registrar.regEvent(appIds.events.BASES_DELETE_BASE, ({ draftState }, baseId) => {
        draftState.basesList = draftState.basesList.filter((base) => base.id !== baseId);
        delete draftState.basesCardCollapsedSections[baseId];
        if (draftState.basesSelectedBaseId === baseId) {
            draftState.basesSelectedBaseId = null;
            draftState.basesSelectedDetailTab = 'base';
        }
    });

    registrar.regEvent(appIds.events.BASES_OPEN_BASE, ({ draftState }, baseId, tab = 'base') => {
        draftState.basesSelectedBaseId = baseId;
        draftState.basesSelectedDetailTab = tab;
    });

    registrar.regEvent(appIds.events.BASES_SET_SELECTED_BASE, ({ draftState }, baseId) => {
        draftState.basesSelectedBaseId = baseId;
        draftState.basesSelectedDetailTab = 'base';
    });

    registrar.regEvent(appIds.events.BASES_SET_DETAIL_TAB, ({ draftState }, tab) => {
        draftState.basesSelectedDetailTab = tab;
    });

    registrar.regEvent(appIds.events.BASES_TOGGLE_CARD_SECTION_COLLAPSED, ({ draftState }, baseId, section) => {
        if (!getBaseById(draftState.basesList, baseId)) return;

        const baseSections = draftState.basesCardCollapsedSections[baseId] || {};
        const currentValue = baseSections[section as BaseCardSectionKey]
            ?? getDefaultBaseCardSectionCollapsed(section as BaseCardSectionKey);
        draftState.basesCardCollapsedSections[baseId] = {
            ...baseSections,
            [section]: !currentValue,
        };
    });

    registrar.regEvent(appIds.events.BASES_SET_ENERGY_GROUP, ({ draftState }, baseId, groupId) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        if (!groupId) {
            if (base.energyGroupId) delete base.energyGroupId;
            return;
        }

        const groupExists = draftState.energyGroups.some((group) => group.id === groupId);
        if (groupExists && base.energyGroupId !== groupId) {
            base.energyGroupId = groupId;
        }
    });

    registrar.regEvent(appIds.events.BASES_ADD_BUILDING, ({ draftState }, baseId, buildingTypeId, sectionType, name, description) => {
        const base = getBaseById(draftState.basesList, baseId);
        if (!base) return;

        base.buildings.push({
            id: createBaseBuildingId(),
            buildingTypeId,
            sectionType,
            ...(name ? { name } : {}),
            ...(description ? { description } : {}),
        });
    });
};
