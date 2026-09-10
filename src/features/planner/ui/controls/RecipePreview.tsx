import type { Item, Recipe } from '@/app/uklad/model';
import type { PlannerRecipeOption } from '@/features/planner/types';
import { ItemImage } from '@/shared/ui';
import { getItemCategoryStyle } from '@/utils/itemColors';

interface RecipeIngredientProps {
    itemId: string;
    amount: number;
    item?: Item;
}

const formatRate = (rate: number): string => (
    Number.isInteger(rate) ? String(rate) : rate.toFixed(1)
);

const RecipeIngredient = ({ itemId, amount, item }: RecipeIngredientProps) => (
    <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
        <span className="badge badge-xs text-[9px]" style={getItemCategoryStyle(item?.type)}>
            {formatRate(amount)}/min
        </span>
        <ItemImage
            itemId={itemId}
            item={item}
            size="small"
            className="!h-8 !w-8"
        />
        <span className="w-full text-center text-[9px] leading-tight text-base-content/80" title={item?.name || itemId}>
            {item?.name || itemId}
        </span>
    </div>
);

interface RecipePreviewProps {
    option: PlannerRecipeOption;
    itemsById: Record<string, Item>;
}

/** Inline inputs and output for the selected alternative. */
export const RecipePreview = ({ option, itemsById }: RecipePreviewProps) => {
    const recipe: Recipe = option.recipe;

    return (
        <div
            aria-label="Selected recipe"
            className="min-w-0"
        >
            <div className="flex items-end gap-1.5">
                <RecipeIngredient
                    itemId={recipe.output.id}
                    amount={recipe.output.amount_per_minute}
                    item={itemsById[recipe.output.id]}
                />
                <span className="shrink-0 self-center text-base-content/50" aria-hidden="true">←</span>
                <div className="flex min-w-0 flex-wrap items-end gap-1">
                    {recipe.inputs.length > 0 ? (
                        recipe.inputs.map((input, index) => (
                            <RecipeIngredient
                                key={`${input.id}-${index}`}
                                itemId={input.id}
                                amount={input.amount_per_minute}
                                item={itemsById[input.id]}
                            />
                        ))
                    ) : (
                        <span className="py-3 text-[10px] italic text-base-content/60">No inputs</span>
                    )}
                </div>
            </div>
        </div>
    );
};
