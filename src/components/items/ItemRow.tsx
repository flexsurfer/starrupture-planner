import { ItemIcon } from "./ItemIcon";
import { CorporationUsageBadge } from "./CorporationUsageBadge";
import { getCategoryDisplayName, getCategoryBadgeClass } from "./useItemsData";
import type { Item, CorporationUsage } from "./types";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../state/event-ids';

interface ItemRowProps {
  item: Item;
  producingBuilding: string;
  corporationUsage: CorporationUsage[];
  getCorporationId: (name: string) => string;
  openRecipeModal: (item: Item) => void;
}

export const ItemRow = ({ 
  item, 
  producingBuilding, 
  corporationUsage, 
  getCorporationId,
  openRecipeModal 
}: ItemRowProps) => {
  return (
    <tr className="hover">
      {/* Item Column - Icon + Name */}
      <td>
        <div className="flex items-center gap-3">
          <ItemIcon item={item} />
          <div className="font-medium">{item.name}</div>
        </div>
      </td>
      
      {/* Category Column */}
      <td>
        <div className={`badge ${getCategoryBadgeClass(item.type)}`}>
          {getCategoryDisplayName(item.type)}
        </div>
      </td>
      
      {/* Production Column */}
      <td>
        <div className="text-sm">{producingBuilding}</div>
      </td>
      
      {/* Actions Column */}
      <td>
        <div className="flex gap-2">
          <button 
            className="btn btn-xs btn-outline"
            onClick={() => openRecipeModal(item)}
          >
            Show Recipe
          </button>
          <button 
            className="btn btn-xs btn-primary"
            onClick={() => {
              dispatch([EVENT_IDS.OPEN_ITEM_IN_PLANNER, item.id]);
            }}
          >
            Open in Planner
          </button>
        </div>
      </td>
      
      {/* Corporations Column */}
      <td>
        <div className="flex flex-wrap gap-1">
          {corporationUsage.length > 0 ? (
            corporationUsage.map((usage, index) => {
              const corporationId = getCorporationId(usage.corporation);
              
              return (
                <CorporationUsageBadge
                  key={index}
                  usage={usage}
                  corporationId={corporationId}
                />
              );
            })
          ) : (
            <span className="text-xs text-base-content/50">Not used</span>
          )}
        </div>
      </td>
    </tr>
  );
};
