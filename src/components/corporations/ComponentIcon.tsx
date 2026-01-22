import type { CorporationComponent, Item } from "../../state/db";
import { ItemImage } from "../ui";

type ComponentIconProps = {
  component: CorporationComponent;
  itemsMap: Record<string, Item>;
};

export const ComponentIcon = ({ component, itemsMap }: ComponentIconProps) => {
  const item = itemsMap[component.id];
  
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Points badge and Quantity label horizontally aligned */}
      <div className="flex items-center gap-2">
        <div className="badge badge-xs text-xs badge-info badge-outline">
          {component.points} G
        </div>
        {component.cost && (
          <div className="text-xs font-medium text-base-content/70">
            x {component.cost}
          </div>
        )}
      </div>
      <div className="relative">
        <ItemImage
          itemId={component.id}
          item={item}
          size="medium"
        />
      </div>
      <div className="text-xs text-center max-w-16 leading-tight">
        {item?.name || component.id}
      </div>
    </div>
  );
};
