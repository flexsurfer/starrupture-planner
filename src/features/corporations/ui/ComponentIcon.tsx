import type { CorporationComponent, Item } from '@/app/uklad/model';
import { ItemImage } from '@/shared/ui';
import { getItemCategoryColor } from '@/utils/itemColors';

type ComponentIconProps = {
  component: CorporationComponent;
  itemsMap: Record<string, Item>;
};

export const ComponentIcon = ({ component, itemsMap }: ComponentIconProps) => {
  const item = itemsMap[component.id];

  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 [&>div]:size-8 [&_img]:size-8 sm:[&>div]:size-10 sm:[&_img]:size-10">
        <ItemImage itemId={component.id} item={item} size="small" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium leading-snug break-words sm:text-sm">{item?.name || component.id}</span>
        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums">
          {component.cost != null && component.cost > 0 && <>
            <span className="font-semibold" style={{ color: getItemCategoryColor(item?.type) }}>{component.cost.toLocaleString()}</span>
            <span className="text-base-content/60">×</span>
          </>}
          <span className="font-semibold text-info">{component.points.toLocaleString()} G</span>
        </span>
      </span>
    </span>
  );
};
