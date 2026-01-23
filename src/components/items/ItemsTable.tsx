import { ItemRow } from "./ItemRow";
import { ItemIcon } from "./ItemIcon";
import { CorporationUsageBadge } from "./CorporationUsageBadge";
import { getCategoryDisplayName, getCategoryBadgeClass } from "./useItemsData";
import type { Item } from "./types";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';

interface ItemsTableProps {
  filteredItems: Item[];
  findProducingBuilding: (itemId: string) => string;
  findCorporationUsage: (itemId: string) => Array<{corporation: string, level: number}>;
  getCorporationId: (name: string) => string;
  openRecipeModal: (item: Item) => void;
}

export const ItemsTable = ({ 
  filteredItems, 
  findProducingBuilding, 
  findCorporationUsage, 
  getCorporationId,
  openRecipeModal 
}: ItemsTableProps) => {
  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-base-content/60">No items found in this category</div>
      </div>
    );
  }

  // Mobile Card Component
  const ItemCard = ({ item }: { item: Item }) => {
    const producingBuilding = findProducingBuilding(item.id);
    const corporationUsage = findCorporationUsage(item.id);
    
    return (
      <div className="card bg-base-100 shadow-sm border border-base-300 p-4">
        {/* Item Header */}
        <div className="flex items-center gap-3 mb-3">
          <ItemIcon item={item} />
          <div className="flex-1">
            <h3 className="font-semibold text-base">{item.name}</h3>
            <div className={`badge badge-sm mt-1 ${getCategoryBadgeClass(item.type)}`}>
              {getCategoryDisplayName(item.type)}
            </div>
          </div>
        </div>

        {/* Production Info */}
        <div className="mb-3">
          <div className="text-sm text-base-content/70">Production:</div>
          <div className="text-sm font-medium">{producingBuilding}</div>
        </div>

        {/* Corporations */}
        {corporationUsage.length > 0 && (
          <div className="mb-3">
            <div className="text-sm text-base-content/70 mb-2">Used by:</div>
            <div className="flex flex-wrap gap-1">
              {corporationUsage.map((usage, index) => {
                const corporationId = getCorporationId(usage.corporation);
                return (
                  <CorporationUsageBadge
                    key={index}
                    usage={usage}
                    corporationId={corporationId}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          <button 
            className="btn btn-sm btn-outline flex-1"
            onClick={() => openRecipeModal(item)}
          >
            Show Recipe
          </button>
          <button
            className="btn btn-sm btn-primary flex-1"
            onClick={() => {
              dispatch([EVENT_IDS.OPEN_ITEM_IN_PLANNER, item.id]);
            }}
          >
            Open in Planner
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="table table-zebra w-full">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Production</th>
              <th>Actions</th>
              <th>Corporations</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const producingBuilding = findProducingBuilding(item.id);
              const corporationUsage = findCorporationUsage(item.id);
              
              return (
                <ItemRow
                  key={item.id}
                  item={item}
                  producingBuilding={producingBuilding}
                  corporationUsage={corporationUsage}
                  getCorporationId={getCorporationId}
                  openRecipeModal={openRecipeModal}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden space-y-3">
        {filteredItems.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </>
  );
};
