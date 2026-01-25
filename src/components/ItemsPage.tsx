import { useState } from "react";
import { 
  useItemsData, 
  ItemsFilter, 
  BuildingSelector, 
  ItemsSearch, 
  ItemsStats, 
  ItemsTable,
  findItemRecipe 
} from "./items";
import { RecipeModal } from "./ui";
import type { Item, Recipe, Building } from "../state/db";
import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../state/sub-ids";

const ItemsPage = () => {
  const {
    itemsTableData,
    selectedCategory,
    categories,
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
    <div className="h-full p-2 lg:p-3 flex flex-col">
      {/* Sticky Header section */}
      <div className="sticky top-0 z-10 bg-base-100 pb-2 mb-2 border-b border-base-300">
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
          {/* Left: Filter and Search */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1">
            <ItemsFilter
              categories={categories}
              selectedCategory={selectedCategory}
            />
            <BuildingSelector className="w-full sm:max-w-40" />
            <ItemsSearch className="w-full sm:max-w-40" />
          </div>
          {/* Right: Stats - hidden on mobile */}
          <div className="hidden md:block">
            <ItemsStats totalItems={itemsTableData.length} />
          </div>
        </div>
      </div>

      {/* Items Table */}
      <ItemsTable
        itemsTableData={itemsTableData}
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
      />
    </div>
  );
};

export default ItemsPage;