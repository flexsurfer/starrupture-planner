import type { Building, Item } from '@/app/uklad/model';
import {
    getLegacyRecipeSelectionKey,
    getRecipeSelectionKey,
} from '@/app/uklad/recipe-key';
import { getRecipeDisplayType } from '@/features/buildings/recipe-utils';
import type { PlannerRecipeOptionsItem } from '@/features/planner/types';

/** Builds selectable recipe alternatives for the given produced item IDs. */
export function buildRecipeOptionsForOutputItems(
    outputItems: Set<string>,
    buildings: Building[],
    itemsById: Record<string, Item>,
    recipeSelections: Record<string, string>,
): PlannerRecipeOptionsItem[] {
    const optionsByItem = new Map<string, PlannerRecipeOptionsItem>();

    for (const building of buildings) {
        for (let recipeIndex = 0; recipeIndex < (building.recipes || []).length; recipeIndex += 1) {
            const recipe = building.recipes![recipeIndex];
            const itemId = recipe.output.id;
            if (!outputItems.has(itemId)) continue;

            if (!optionsByItem.has(itemId)) {
                optionsByItem.set(itemId, {
                    itemId,
                    itemName: itemsById[itemId]?.name || itemId,
                    options: [],
                    selectedKey: '',
                    defaultKey: '',
                });
            }

            optionsByItem.get(itemId)!.options.push({
                key: getRecipeSelectionKey(building.id, recipe, recipeIndex),
                legacyKey: getLegacyRecipeSelectionKey(building.id, recipeIndex),
                buildingId: building.id,
                buildingName: building.name,
                recipe,
                recipeIndex,
                recipeType: getRecipeDisplayType(recipe, building, buildings),
                outputRate: recipe.output.amount_per_minute,
            });
        }
    }

    const result: PlannerRecipeOptionsItem[] = [];
    optionsByItem.forEach((entry) => {
        if (entry.options.length <= 1) return;
        entry.options.sort((a, b) => (
            Number(a.recipeType === 'alternative') - Number(b.recipeType === 'alternative')
            || a.outputRate - b.outputRate
            || a.buildingName.localeCompare(b.buildingName)
            || a.recipeIndex - b.recipeIndex
        ));
        entry.defaultKey = entry.options[0]!.key;
        const selectedKey = recipeSelections[entry.itemId];
        const selectedOption = selectedKey
            ? entry.options.find((option) => option.key === selectedKey || option.legacyKey === selectedKey)
            : undefined;
        entry.selectedKey = selectedOption?.key ?? entry.defaultKey;
        result.push(entry);
    });

    return result.sort((a, b) => a.itemName.localeCompare(b.itemName));
}
