import { ItemRow } from "./ItemRow";
import { ItemIcon } from "./ItemIcon";
import { CorporationUsageBadge } from "./CorporationUsageBadge";
import { getCategoryDisplayName, getCategoryBadgeClass, type ItemTableData } from "../hooks/useItemsData";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../../state/event-ids';

interface ItemsTableProps {
  itemsTableData: ItemTableData[];
  getCorporationId: (name: string) => string;
  openRecipeModal: (item: ItemTableData['item']) => void;
}

export const ItemsTable = ({ 
  itemsTableData, 
  getCorporationId,
  openRecipeModal 
}: ItemsTableProps) => {
  if (itemsTableData.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-base-content/60">No items found in this category</div>
      </div>
    );
  }

  // Mobile Card Component
  const ItemCard = ({ itemData }: { itemData: ItemTableData }) => {
    const { item, producingBuilding, corporationUsage } = itemData;
    
    return (
      <div className="card bg-base-100 shadow-sm border border-base-300 p-3">
        {/* Item Header */}
        <div className="flex items-center gap-2 mb-2">
          <ItemIcon item={item} />
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{item.name}</h3>
            <div className={`badge badge-xs mt-1 ${getCategoryBadgeClass(item.type)}`}>
              {getCategoryDisplayName(item.type)}
            </div>
          </div>
        </div>

        {/* Production Info */}
        <div className="mb-2 flex flex-row gap-1">
          <div className="text-xs text-base-content/70">Production:</div>
          <div className="text-xs font-medium">{producingBuilding}</div>
        </div>

        {/* Corporations */}
        {corporationUsage.length > 0 && (
          <div className="mb-2 flex flex-row gap-1">
            <div className="text-xs text-base-content/70 mb-1">Corporations:</div>
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
        <div className="flex flex-row gap-3">
          <button 
            className="btn btn-sm btn-outline flex-1"
            onClick={() => openRecipeModal(item)}
          >
            Recipe
          </button>
          <button
            className="btn btn-sm btn-primary flex-1"
            onClick={() => {
              dispatch([EVENT_IDS.OPEN_ITEM_IN_PLANNER, item.id]);
            }}
          >
            Planner
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden lg:block overflow-auto flex-1">
        <table className="table table-zebra table-compact w-full">
          <thead className="sticky top-0 bg-base-100 z-10">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">Category</th>
              <th className="py-2">Production</th>
              <th className="py-2">Actions</th>
              <th className="py-2">Corporations</th>
            </tr>
          </thead>
          <tbody>
            {itemsTableData.map((itemData) => (
              <ItemRow
                key={itemData.item.id}
                item={itemData.item}
                producingBuilding={itemData.producingBuilding}
                corporationUsage={itemData.corporationUsage}
                getCorporationId={getCorporationId}
                openRecipeModal={openRecipeModal}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="lg:hidden overflow-y-auto flex-1">
        <div className="space-y-2">
          {itemsTableData.map((itemData) => (
            <ItemCard key={itemData.item.id} itemData={itemData} />
          ))}
        </div>
      </div>
    </>
  );
};
