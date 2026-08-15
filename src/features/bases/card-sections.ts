import type { BaseCardCollapsedSections, BaseCardSectionKey } from '@/app/uklad/model';

export const DEFAULT_BASE_CARD_COLLAPSED_SECTIONS: Record<BaseCardSectionKey, boolean> = {
    productionPlans: false,
    outputs: true,
    inputs: true,
    defense: true,
};

export function getDefaultBaseCardSectionCollapsed(sectionKey: BaseCardSectionKey): boolean {
    return DEFAULT_BASE_CARD_COLLAPSED_SECTIONS[sectionKey];
}

export function resolveBaseCardCollapsedSections(
    storedSections: BaseCardCollapsedSections | undefined,
): Record<BaseCardSectionKey, boolean> {
    return {
        productionPlans: storedSections?.productionPlans ?? DEFAULT_BASE_CARD_COLLAPSED_SECTIONS.productionPlans,
        outputs: storedSections?.outputs ?? DEFAULT_BASE_CARD_COLLAPSED_SECTIONS.outputs,
        inputs: storedSections?.inputs ?? DEFAULT_BASE_CARD_COLLAPSED_SECTIONS.inputs,
        defense: storedSections?.defense ?? DEFAULT_BASE_CARD_COLLAPSED_SECTIONS.defense,
    };
}
