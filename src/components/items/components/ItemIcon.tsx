import { ItemImage } from "../../ui";
import type { Item } from "../types";

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
