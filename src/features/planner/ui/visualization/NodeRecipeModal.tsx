import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { RecipeCard } from '@/features/buildings/ui/RecipeCard';
import { BuildingImage } from '@/shared/ui';
import type { FlowNode, Item } from '@/features/planner/types';

interface NodeRecipeModalProps {
    item: Item;
    node: Pick<FlowNode, 'buildingId' | 'recipeIndex'>;
    onClose: () => void;
}

/** Read-only recipe comparison for a production node, independent of the Items popup. */
export const NodeRecipeModal = ({ item, node, onClose }: NodeRecipeModalProps) => {
    const recipes = useSubscription([appIds.subscriptions.ITEMS_RECIPES_BY_OUTPUT_ITEM_ID, item.id]);

    return (
    <div className="modal modal-open">
        <div className="modal-box max-w-2xl max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
                <h3 className="text-lg font-bold">Recipes for {item.name}</h3>
                <button type="button" className="btn btn-sm btn-circle btn-ghost shrink-0" aria-label="Close recipes" onClick={onClose}>✕</button>
            </div>
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
