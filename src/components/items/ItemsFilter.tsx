import { dispatch } from "@flexsurfer/reflex";
import { EVENT_IDS } from "../../state/event-ids";
import { getCategoryDisplayName } from "./useItemsData";

interface ItemsFilterProps {
  categories: string[];
  selectedCategory: string;
}

export const ItemsFilter = ({ categories, selectedCategory }: ItemsFilterProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((category) => (
        <button
          key={category}
          className={`btn btn-sm ${
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
