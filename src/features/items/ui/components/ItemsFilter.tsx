import { useRuntime } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import { getCategoryDisplayName } from "../hooks/useItemsData";
import { getItemCategoryStyle } from '@/utils/itemColors';

interface ItemsFilterProps {
  categories: string[];
  selectedCategory: string;
}

export const ItemsFilter = ({ categories, selectedCategory }: ItemsFilterProps) => {
  const runtime = useRuntime();

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <button
          key={category}
          className={`btn btn-xs ${
            selectedCategory === category ? 'btn-primary' : 'btn-outline'
          } ${selectedCategory === category && category !== 'all' ? 'ring-1 ring-current' : ''}`}
          style={category === 'all' ? undefined : getItemCategoryStyle(category)}
          aria-pressed={selectedCategory === category}
          onClick={() => runtime.dispatch([appIds.events.ITEMS_SET_SELECTED_CATEGORY, category])}
        >
          {getCategoryDisplayName(category)}
        </button>
      ))}
    </div>
  );
};
