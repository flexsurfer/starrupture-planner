import { ItemIcon } from "./ItemIcon";
import { CorporationUsageBadge } from "./CorporationUsageBadge";
import { getCategoryDisplayName, getCategoryBadgeClass } from "../hooks/useItemsData";
import type { Item, CorporationUsage } from "../types";
import { dispatch } from '@flexsurfer/reflex';
import { EVENT_IDS } from '../../../state/event-ids';

interface ItemRowProps {
  item: Item;
  producingBuildings: string[];
  corporationUsage: CorporationUsage[];
  getCorporationId: (name: string) => string;
  openRecipeModal: (item: Item) => void;
}

export const ItemRow = ({ 
  item, 
  producingBuildings, 
  corporationUsage, 
  getCorporationId,
  openRecipeModal 
}: ItemRowProps) => {
  const hasProductions = producingBuildings.length > 0;

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
        {hasProductions ? (
          <div className="flex flex-wrap gap-1">
            {producingBuildings.map((buildingName) => (
              <span key={buildingName} className="badge badge-ghost badge-sm text-xs">
                {buildingName}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-base-content/60">Raw Material</div>
        )}
      </td>
      
      {/* Actions Column */}
      <td className="py-1.5">
        <div className="flex gap-1">
          {hasProductions && (
            <button
              className="btn btn-xs btn-outline"
              onClick={() => openRecipeModal(item)}
            >
              Recipe
            </button>
          )}
          {item.type !== 'raw' && (
            <button
              className="btn btn-xs btn-primary"
              onClick={() => {
                dispatch([EVENT_IDS.PLANNER_OPEN_ITEM, item.id]);
              }}
            >
              Planner
            </button>
          )}
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
