import { describe, expect, it } from "vitest";
import {
  createRecipeSelectionKey,
  matchesRecipeSelectionKey,
  resolveLayoutBuildingRecipe,
} from "./recipe-resolution";

describe("recipeSelection", () => {
  it("matches the stable building-plus-output-item selection key", () => {
    const selectionKey = createRecipeSelectionKey("craftertier2", "rotor");

    expect(
      matchesRecipeSelectionKey(selectionKey, "craftertier2", "rotor", 0),
    ).toBe(true);
  });

  it("accepts the legacy building-plus-index selection key as a fallback", () => {
    expect(
      matchesRecipeSelectionKey("craftertier2:0", "craftertier2", "rotor", 0),
    ).toBe(true);
  });

  it("resolves layout recipes by output item before using recipe index", () => {
    const building = {
      id: "furnace",
      name: "Furnace",
      recipes: [
        {
          output: { id: "powder_wolfram", amount_per_minute: 90 },
          inputs: [{ id: "bar_wolfram", amount_per_minute: 30 }],
        },
        {
          output: { id: "powder_calcium", amount_per_minute: 60 },
          inputs: [{ id: "block_calcium", amount_per_minute: 20 }],
        },
      ],
    };

    const legacyLayoutBuilding = {
      itemId: "powder_wolfram",
      recipeIndex: 1,
    };

    const recipe = resolveLayoutBuildingRecipe(legacyLayoutBuilding, building);

    expect(recipe?.output.id).toBe("powder_wolfram");
    expect(recipe?.inputs[0]?.id).toBe("bar_wolfram");
  });

  it("keeps the selected recipe when multiple recipes share the same output", () => {
    const building = {
      id: "craftertier2",
      name: "Fabricator v.2",
      recipes: [
        {
          variant: "alternative" as const,
          output: { id: "tube", amount_per_minute: 480 },
          inputs: [
            { id: "goethiteingot", amount_per_minute: 30 },
            { id: "titanium_sheet", amount_per_minute: 90 },
          ],
        },
        {
          id: "tube_v2",
          output: { id: "tube", amount_per_minute: 300 },
          inputs: [
            { id: "titanium_rod", amount_per_minute: 60 },
            { id: "titanium_sheet", amount_per_minute: 60 },
          ],
        },
      ],
    };

    const alternativeLayoutBuilding = { itemId: "tube", recipeIndex: 0 };
    const v2LayoutBuilding = { itemId: "tube", recipeIndex: 1 };

    expect(
      resolveLayoutBuildingRecipe(alternativeLayoutBuilding, building)?.output
        .amount_per_minute,
    ).toBe(480);
    expect(
      resolveLayoutBuildingRecipe(v2LayoutBuilding, building)?.output
        .amount_per_minute,
    ).toBe(300);
  });

  it("falls back to recipe index when output item lookup fails", () => {
    const building = {
      id: "fabricator",
      name: "Fabricator",
      recipes: [
        {
          output: { id: "titanium_beam", amount_per_minute: 30 },
          inputs: [{ id: "bar_titanium", amount_per_minute: 60 }],
        },
      ],
    };

    const layoutBuilding = {
      itemId: "missing_item",
      recipeIndex: 0,
    };

    const recipe = resolveLayoutBuildingRecipe(layoutBuilding, building);

    expect(recipe?.output.id).toBe("titanium_beam");
  });
});
