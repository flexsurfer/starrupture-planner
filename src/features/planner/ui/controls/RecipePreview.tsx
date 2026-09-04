import type { Item, Recipe } from '@/app/uklad/model';
import type { PlannerRecipeOption } from '@/features/planner/types';
import { BuildingImage, ItemImage, RecipeTypeIcon } from '@/shared/ui';

interface RecipeIngredientProps {
    itemId: string;
    amount: number;
    item?: Item;
    isOutput?: boolean;
}

const formatRate = (rate: number): string => (
    Number.isInteger(rate) ? String(rate) : rate.toFixed(1)
);

const RecipeIngredient = ({ itemId, amount, item, isOutput = false }: RecipeIngredientProps) => (
    <div className="flex w-12 shrink-0 flex-col items-center gap-0.5">
        <span className={`badge badge-xs text-[9px] ${isOutput ? 'badge-success' : 'badge-primary'}`}>
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
    id?: string;
}

/** Compact recipe details shown while hovering or focusing an alternative. */
export const RecipePreview = ({ option, itemsById, id }: RecipePreviewProps) => {
    const recipe: Recipe = option.recipe;

    return (
        <div
            id={id}
            role="tooltip"
            className="w-64 rounded-md border border-base-300 bg-base-100 p-2 shadow-2xl"
        >
            <div className="mb-2 flex items-center gap-1.5 border-b border-base-300 pb-1.5">
                <BuildingImage buildingId={option.buildingId} size="xsmall" />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[11px] font-semibold" title={option.buildingName}>
                        {option.buildingName}
                    </div>
                    <div className="text-[10px] text-base-content/60">
                        {formatRate(recipe.output.amount_per_minute)}/min output
                    </div>
                </div>
                <RecipeTypeIcon recipeType={option.recipeType} />
            </div>

            <div className="flex items-center gap-1.5">
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-center gap-1">
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

                <span className="shrink-0 text-base-content/50" aria-hidden="true">→</span>

                <RecipeIngredient
                    itemId={recipe.output.id}
                    amount={recipe.output.amount_per_minute}
                    item={itemsById[recipe.output.id]}
                    isOutput
                />
            </div>
        </div>
    );
};
