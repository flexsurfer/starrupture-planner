import { useState } from "react";
import { useItemsData } from "./items/useItemsData";
import { ItemsFilter } from "./items/ItemsFilter";
import { ItemsSearch } from "./items/ItemsSearch";
import { ItemsStats } from "./items/ItemsStats";
import { ItemsTable } from "./items/ItemsTable";
import { RecipeModal } from "./ui";
import { findItemRecipe } from "./items/recipeUtils";
import type { Item, Recipe, Building } from "../state/db";
import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../state/sub-ids";

const ItemsPage = () => {
  const {
    filteredItems,
    selectedCategory,
    categories,
    findProducingBuilding,
    findCorporationUsage,
    getCorporationId,
  } = useItemsData();

  // Modal state for recipe popup
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    item: Item | null;
    recipe: Recipe | null;
    building: Building | null;
  }>({
    isOpen: false,
    item: null,
    recipe: null,
    building: null,
  });

  // Get data for modal
  const buildings = useSubscription<Building[]>([SUB_IDS.BUILDINGS]);
  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_MAP]);

  const openRecipeModal = (item: Item) => {
    const recipeData = findItemRecipe(item.id, buildings);

    if (recipeData) {
      setModalState({
        isOpen: true,
        item,
        recipe: recipeData.recipe,
        building: recipeData.building,
      });
    } else {
      // Handle case where no recipe exists (raw materials)
      console.log('No recipe found for:', item.name);
    }
  };

  const closeRecipeModal = () => {
    setModalState({
      isOpen: false,
      item: null,
      recipe: null,
      building: null,
    });
  };

  return (
    <div className="p-4 lg:p-6">
      {/* Sticky Header section */}
      <div className="sticky top-0 z-10 bg-base-100 pb-4 mb-4 border-b border-base-300">
        <div className="flex flex-col gap-4">
          {/* Top row: Category Filter and Stats */}
          <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              {/* Category Filter */}
              <ItemsFilter
                categories={categories}
                selectedCategory={selectedCategory}
              />
              {/* Search Input */}
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <ItemsSearch className="w-full sm:max-w-md" />
              </div>
            </div>
            {/* Stats - hidden on mobile */}
            <div className="hidden md:block">
              <ItemsStats totalItems={filteredItems.length} />
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <ItemsTable
        filteredItems={filteredItems}
        findProducingBuilding={findProducingBuilding}
        findCorporationUsage={findCorporationUsage}
        getCorporationId={getCorporationId}
        openRecipeModal={openRecipeModal}
      />

      {/* Recipe Modal */}
      <RecipeModal
        isOpen={modalState.isOpen}
        onClose={closeRecipeModal}
        item={modalState.item}
        recipe={modalState.recipe}
        building={modalState.building}
        itemsMap={itemsMap}
      />
    </div>
  );
};

export default ItemsPage;