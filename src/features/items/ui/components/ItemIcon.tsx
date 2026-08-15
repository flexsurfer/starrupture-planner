import { ItemImage } from '@/shared/ui';
import type { Item } from '@/features/items/types';

interface ItemIconProps {
  item: Item;
}

export const ItemIcon = ({ item }: ItemIconProps) => {
  return (
    <ItemImage
      itemId={item.id}
      item={item}
      size="medium"
    />
  );
};
