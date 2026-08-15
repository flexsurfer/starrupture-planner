import { useAppRuntime } from "@/state/runtime";
import { appIds } from "@/app/uklad/catalog";
import { getCategoryDisplayName } from "../hooks/useItemsData";

interface ItemsFilterProps {
  categories: string[];
  selectedCategory: string;
}

export const ItemsFilter = ({ categories, selectedCategory }: ItemsFilterProps) => {
  const runtime = useAppRuntime();

  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <button
          key={category}
          className={`btn btn-xs ${
            selectedCategory === category ? 'btn-primary' : 'btn-outline'
          }`}
          onClick={() => runtime.dispatch([appIds.events.ITEMS_SET_SELECTED_CATEGORY, category])}
        >
          {getCategoryDisplayName(category)}
        </button>
      ))}
    </div>
  );
};
