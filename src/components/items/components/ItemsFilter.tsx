import { dispatch } from "@flexsurfer/reflex";
import { EVENT_IDS } from "../../../state/event-ids";
import { getCategoryDisplayName } from "../hooks/useItemsData";

interface ItemsFilterProps {
  categories: string[];
  selectedCategory: string;
}

export const ItemsFilter = ({ categories, selectedCategory }: ItemsFilterProps) => {
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((category) => (
        <button
          key={category}
          className={`btn btn-xs ${
            selectedCategory === category ? 'btn-primary' : 'btn-outline'
          }`}
          onClick={() => dispatch([EVENT_IDS.SET_CATEGORY, category])}
        >
          {getCategoryDisplayName(category)}
        </button>
      ))}
    </div>
  );
};
