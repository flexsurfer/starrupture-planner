import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { getRecipeSelectionKey } from '@/app/uklad/recipe-key';
import { RecipeCard } from '@/features/buildings/ui/RecipeCard';
import { BuildingImage } from '@/shared/ui';
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
    <div className="modal modal-open">
        <div className="modal-box max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
                <h3 className="text-lg font-bold">Recipes for {item.name}</h3>
                <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" aria-label="Close recipes" onClick={onClose}>✕</button>
            </div>
            {onSelectRecipe && <p className="text-sm text-base-content/60 mb-3 shrink-0">Select a recipe for this item in the current plan. The selection is shared with the plan’s Recipes control.</p>}
            <div className="min-h-0 overflow-y-auto overscroll-contain space-y-3 p-1">
                {recipes.length === 0 && <p className="text-sm text-base-content/60">No production recipes available for this item.</p>}
                {recipes.map(({ recipe, building, recipeIndex, recipeType }) => {
                    const selected = building.id === node.buildingId && recipeIndex === node.recipeIndex;
                    const typeLabel = recipeType === 'alternative' ? 'Alternative' : recipeType === 'upgrade' ? 'V2' : 'Standard';
                    return (
                        <section
                            key={`${building.id}:${recipeIndex}`}
                            aria-label={`${building.name} — ${typeLabel}${selected ? ' — Used in this node' : ''}`}
                            aria-current={selected ? 'true' : undefined}
                            className={`rounded-lg border p-3 space-y-2 ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-base-300'}`}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <BuildingImage buildingId={building.id} building={building} size="small" className="shrink-0" />
                                <span className="text-sm font-semibold">{building.name}</span>
                                <span className="badge badge-sm badge-ghost">{typeLabel}</span>
                                {selected && <span className="badge badge-sm badge-primary">Used in this node</span>}
                            </div>
                            <RecipeCard recipe={recipe} recipeType={recipeType} showPlannerButton={false} />
                            {onSelectRecipe && <div className="flex justify-end">
                                <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={selected}
                                    aria-label={`${selected ? 'Selected' : 'Select'} ${building.name} ${typeLabel} recipe`}
                                    onClick={() => {
                                        const recipeKey = getRecipeSelectionKey(building.id, recipe, recipeIndex);
                                        onSelectRecipe(item.id, recipeKey);
                                        onClose();
                                    }}
                                >
                                    {selected ? 'Selected' : 'Select recipe'}
                                </button>
                            </div>}
                        </section>
                    );
                })}
            </div>
            <div className="modal-action shrink-0">
                <button type="button" className="btn btn-sm" onClick={onClose}>Close</button>
            </div>
        </div>
        <div className="modal-backdrop" onClick={onClose} />
    </div>
);
};
