import { appIds } from '@/app/uklad/catalog';
import { useSubscription } from '@/app/uklad/bindings';
import { BaseProductionCard } from './components/BaseProductionCard';
import { getCategoryDisplayName } from '@/features/items/ui/hooks/useItemsData';

export const BaseOverviewView: React.FC = () => {
  const selectedBaseId = useSubscription([appIds.subscriptions.BASES_SELECTED_BASE_ID]);
  const table = useSubscription([appIds.subscriptions.BASES_PRODUCTION_TABLE]);

  if (!selectedBaseId) {
    return null;
  }

  return (
    <div>
      {table.groups.length === 0 ? <p className="rounded-lg border border-base-300 bg-base-100 p-4 text-sm text-base-content/60">No production plans yet. Add a plan to see its production chain and requirements.</p> : (
        <div className="overflow-hidden rounded-lg border border-base-300 bg-base-100">
          <table className="w-full table-fixed">
            <caption className="sr-only">Base production cards ordered by target and item category</caption>
            {table.groups.map(group => <tbody key={group.type} className="border-b border-base-300 last:border-b-0">
              <tr><th scope="rowgroup" className="bg-base-200 px-2 py-1.5 text-left text-xs font-medium text-base-content/75 sm:px-3 sm:py-2 sm:text-sm">
                {group.type === 'target' ? 'Targets' : group.type === 'launcher' ? 'Delivery' : getCategoryDisplayName(group.type)}
              </th></tr>
              <tr><td className="p-2 sm:p-3">
                <div className="grid grid-cols-2 items-start gap-x-2 gap-y-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] sm:gap-3">
                  {group.cards.map(card => <BaseProductionCard key={card.id} card={card} baseId={selectedBaseId} target={group.type === 'target'} />)}
                </div>
              </td></tr>
            </tbody>)}
          </table>
        </div>
      )}
    </div>
  );
};
