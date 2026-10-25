import { useTranslation } from '@/shared/i18n';
import type { CorporationComponent, Item } from '@/app/uklad/model';
import { ItemImage } from '@/shared/ui';

type ComponentIconProps = {
  component: CorporationComponent;
  itemsMap: Record<string, Item>;
};

export const ComponentIcon = ({ component, itemsMap }: ComponentIconProps) => {
  const { t, formatNumber } = useTranslation();
  const item = itemsMap[component.id];

  return (
    <div className="corporation-supply-item">
      <div className="shrink-0 rounded-md bg-base-200 p-1">
        <ItemImage itemId={component.id} item={item} size="small" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-snug break-words">{item?.name || component.id}</p>
        <p className="mt-1 text-xs leading-relaxed text-base-content/75 tabular-nums">
          {t('{points} G per item', { points: component.points })}
        </p>
      </div>
      <div className="corporation-supply-quantity">
        <p className="text-xs leading-snug text-base-content/75">{t('Items needed')}</p>
        <p className="mt-0.5 text-xl font-bold leading-tight tabular-nums">
          {component.cost != null
            ? formatNumber(component.cost)
            : <span className="text-xs font-normal">{t('Quantity unavailable')}</span>}
        </p>
      </div>
    </div>
  );
};
