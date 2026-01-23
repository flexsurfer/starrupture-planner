import { ItemIcon } from "./ItemIcon";
import { CorporationUsageBadge } from "./CorporationUsageBadge";
import { getCategoryDisplayName, getCategoryBadgeClass } from "../hooks/useItemsData";
import type { Item, CorporationUsage } from "../types";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../../state/event-ids';

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
      <td className="py-1.5">
        <div className="flex items-center gap-2">
          <ItemIcon item={item} />
          <div className="font-medium text-sm">{item.name}</div>
        </div>
      </td>
      
      {/* Category Column */}
      <td className="py-1.5">
        <div className={`badge badge-sm ${getCategoryBadgeClass(item.type)}`}>
          {getCategoryDisplayName(item.type)}
        </div>
      </td>
      
      {/* Production Column */}
      <td className="py-1.5">
        <div className="text-xs">{producingBuilding}</div>
      </td>
      
      {/* Actions Column */}
      <td className="py-1.5">
        <div className="flex gap-1">
          <button 
            className="btn btn-xs btn-outline"
            onClick={() => openRecipeModal(item)}
          >
            Recipe
          </button>
          <button
            className="btn btn-xs btn-primary"
            onClick={() => {
              dispatch([EVENT_IDS.OPEN_ITEM_IN_PLANNER, item.id]);
            }}
          >
            Planner
          </button>
        </div>
      </td>
      
      {/* Corporations Column */}
      <td className="py-1.5">
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
