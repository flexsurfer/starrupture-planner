import { appIds } from '@/app/uklad/catalog';
import { useState } from "react";
import { BuildingSelector } from './components/BuildingSelector';
import { ItemsFilter } from './components/ItemsFilter';
import { ItemsSearch } from './components/ItemsSearch';
import { ItemsStats } from './components/ItemsStats';
import { ItemsTable } from './components/ItemsTable';
import { useItemsData } from './hooks/useItemsData';
import { RecipeModal } from '@/features/buildings/ui';
import { findItemRecipes } from '@/features/buildings/recipe-utils';
import type { Item } from "@/app/uklad/model";
import type { ItemRecipe } from '@/features/buildings/recipe-utils';
import { useSubscription } from "@/app/uklad/bindings";

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
    recipes: ItemRecipe[];
  }>({
    isOpen: false,
    item: null,
    recipes: [],
  });

  // Get data for modal
  const buildings = useSubscription([appIds.subscriptions.BUILDINGS_LIST]);

  const openRecipeModal = (item: Item) => {
    const recipes = findItemRecipes(item.id, buildings);
    if (recipes.length === 0) return;

    setModalState({
      isOpen: true,
      item,
      recipes,
    });
  };

  const closeRecipeModal = () => {
    setModalState({
      isOpen: false,
      item: null,
      recipes: [],
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
        itemRecipes={modalState.recipes}
      />
    </div>
  );
};

export default ItemsPage;
