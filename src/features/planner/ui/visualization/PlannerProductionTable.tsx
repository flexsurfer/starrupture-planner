import { useTranslation } from '@/shared/i18n';
import { useCallback } from 'react';
import { appIds } from '@/app/uklad/catalog';
import { useRuntime, useSubscription } from '@/app/uklad/bindings';
import { getCategoryDisplayName } from '@/features/items/ui/hooks/useItemsData';
import { getItemColor } from '@/utils/itemColors';
import { NodeCard } from './NodeCard';
import { getFlowNodeId } from '@/features/planner/flow-node';
import { usePlannerInputActions } from './usePlannerInputActions';

export const PlannerProductionTable = () => {
    const { t } = useTranslation();
    const runtime = useRuntime();
    const inputActions = usePlannerInputActions();
    const targetIds = useSubscription([appIds.subscriptions.PLANNER_ACTIVE_TARGET_IDS]);
    const onSelectRecipe = useCallback((itemId: string, recipeKey: string) => {
        runtime.dispatch([appIds.events.PLANNER_SET_RECIPE_SELECTION, itemId, recipeKey]);
    }, [runtime]);
    const stats = useSubscription([appIds.subscriptions.PLANNER_STATS_DETAILED]);
    const items = useSubscription([appIds.subscriptions.ITEMS_LIST]);

    if (!stats.productionGroups.length) return (
        <div className="h-full flex items-center justify-center p-4 text-base-content/70">{t("Select an item to view its production table.")}</div>
    );

    return (
        <div className="h-full overflow-auto p-2 sm:p-3">
            <table className="w-full table-fixed border border-base-300">
                <caption className="sr-only">{t("Production cards ordered by target and item category")}</caption>
                {stats.productionGroups.map(group => (
                    <tbody key={group.type} className="border-b border-base-300 last:border-b-0">
                        <tr>
                            <th scope="rowgroup" className="px-2 py-1 text-left text-xs font-semibold bg-base-200 sm:px-4 sm:py-2 sm:text-sm">
                                {group.type === 'target' ? t("Targets") : group.type === 'launcher' ? t("Delivery") : getCategoryDisplayName(group.type)}
                            </th>
                        </tr>
                        <tr>
                            <td className="p-2 sm:p-4">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-4">
                                    {group.nodes.map(node => (
                                        <div
                                            key={getFlowNodeId(node)}
                                            className={`relative flex h-full min-w-0 flex-col rounded-md border bg-base-200 ${group.type === 'target' ? 'border-primary' : 'border-base-300'}`}
                                        >
                                            <NodeCard compactOnMobile onSelectRecipe={onSelectRecipe} node={node} items={items} outputColor={getItemColor(node.outputItem, items)}
                                                {...inputActions} inputDisabledReason={targetIds.includes(node.outputItem) ? t("The final output must be produced by this plan") : undefined} />
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
