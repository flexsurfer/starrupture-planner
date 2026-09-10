import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { getRecipeSelectionKey } from '@/app/uklad/recipe-key';
import { RecipeCard } from '@/features/buildings/ui/RecipeCard';
import type { FlowNode, Item } from '@/features/planner/types';

interface NodeRecipeModalProps {
    item: Item;
    node: Pick<FlowNode, 'buildingId' | 'recipeIndex'>;
    onClose: () => void;
    onSelectRecipe?: (itemId: string, recipeKey: string) => void;
}

/** Recipe comparison and planner selection for a production node. */
export const NodeRecipeModal = ({ item, node, onClose, onSelectRecipe }: NodeRecipeModalProps) => {
    const recipes = useSubscription([appIds.subscriptions.ITEMS_RECIPES_BY_OUTPUT_ITEM_ID, item.id]);

    return (
    <div className="modal modal-open p-1 sm:p-4">
        <div className="modal-box flex max-h-[calc(100dvh-0.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg p-0 sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl">
            <div className="flex items-center justify-between gap-2 border-b border-base-300 px-3 py-2 shrink-0 sm:px-4 sm:py-3">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold leading-tight break-words sm:text-lg">{item.name}</h3>
                    <p className="mt-0.5 text-[11px] text-base-content/60 sm:text-xs">{recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'} · Rates per building</p>
                </div>
                <button type="button" className="btn btn-sm btn-circle btn-ghost size-9 shrink-0" aria-label="Close recipes" onClick={onClose}>✕</button>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain space-y-2 p-2 sm:space-y-3 sm:p-3">
                {recipes.length === 0 && <p className="text-sm text-base-content/60">No production recipes available for this item.</p>}
                {recipes.map(({ recipe, building, recipeIndex, recipeType }) => {
                    const selected = building.id === node.buildingId && recipeIndex === node.recipeIndex;
                    const typeLabel = recipeType === 'alternative' ? 'Alternative' : recipeType === 'upgrade' ? 'V2' : 'Standard';
                    return (
                        <section
                            key={`${building.id}:${recipeIndex}`}
                            aria-label={`${building.name} — ${typeLabel}${selected ? ' — Used in this node' : ''}`}
                            aria-current={selected ? 'true' : undefined}
                        >
                            <RecipeCard
                                recipe={recipe}
                                recipeType={recipeType}
                                building={building}
                                selected={selected}
                                showPlannerButton={false}
                                action={onSelectRecipe ? (
                                    <button
                                        type="button"
                                        className="btn btn-sm btn-primary h-8 min-h-8 shrink-0 px-2 text-xs"
                                        disabled={selected}
                                        aria-label={`${selected ? 'Selected' : 'Select'} ${building.name} ${typeLabel} recipe`}
                                        onClick={() => {
                                            const recipeKey = getRecipeSelectionKey(building.id, recipe, recipeIndex);
                                            onSelectRecipe(item.id, recipeKey);
                                            onClose();
                                        }}
                                    >
                                        {selected ? 'Selected' : 'Use recipe'}
                                    </button>
                                ) : selected ? <span className="shrink-0 text-xs font-medium text-primary">In use</span> : undefined}
                            />
                        </section>
                    );
                })}
            </div>
        </div>
        <div className="modal-backdrop" onClick={onClose} />
    </div>
);
};
