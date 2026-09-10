import { useCallback } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { getCategoryDisplayName } from '@/features/items/ui/hooks/useItemsData';
import { getItemColor } from '@/utils/itemColors';
import { NodeCard } from './NodeCard';

export const PlannerProductionTable = () => {
    const runtime = useRuntime();
    const onSelectRecipe = useCallback((itemId: string, recipeKey: string) => {
        runtime.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, itemId, recipeKey]);
    }, [runtime]);
    const stats = useSubscription([appIds.subscriptions.PLANNER_STATS_DETAILED]);
    const items = useSubscription([appIds.subscriptions.ITEMS_LIST]);

    if (!stats.productionGroups.length) return (
        <div className="h-full flex items-center justify-center p-4 text-base-content/70">
            Select an item to view its production table.
        </div>
    );

    return (
        <div className="h-full overflow-auto p-2 sm:p-3">
            <table className="w-full table-fixed border border-base-300">
                <caption className="sr-only">Production cards ordered by target and item category</caption>
                {stats.productionGroups.map(group => (
                    <tbody key={group.type} className="border-b border-base-300 last:border-b-0">
                        <tr>
                            <th scope="rowgroup" className="px-2 py-1 text-left text-xs font-semibold bg-base-200 sm:px-4 sm:py-2 sm:text-sm">
                                {group.type === 'target' ? 'Targets' : group.type === 'launcher' ? 'Delivery' : getCategoryDisplayName(group.type)}
                            </th>
                        </tr>
                        <tr>
                            <td className="p-2 sm:p-4">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-4">
                                    {group.nodes.map(node => (
                                        <div
                                            key={`${node.nodeType}:${node.buildingId}:${node.recipeIndex}:${node.outputItem}:${node.baseBuildingId ?? ''}`}
                                            className={`relative flex h-full min-w-0 flex-col rounded-md border bg-base-200 ${group.type === 'target' ? 'border-primary' : 'border-base-300'}`}
                                        >
                                            <NodeCard compactOnMobile onSelectRecipe={onSelectRecipe} node={node} items={items} outputColor={getItemColor(node.outputItem, items)} />
                                        </div>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                ))}
            </table>
        </div>
    );
};
