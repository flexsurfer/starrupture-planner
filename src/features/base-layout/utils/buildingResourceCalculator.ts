import type { BaseLayoutBuilding, Building } from "@/app/uklad/model";
import type { BuildingProductionState } from "./layoutBalanceCalculator";
import { resolveLayoutBuildingRecipe } from "@/features/base-layout/recipe-resolution";

export interface BuildingResourceTag {
  itemId: string;
  rate: number; // Actual rate (scaled by production factor)
  maxRate: number; // Maximum possible rate
  type: "output" | "input";
  satisfied: boolean; // For inputs, whether they're fully satisfied
  fulfillmentRatio: number; // 0-1, how much of the required input is available
}

/**
 * Calculate resource tags for a specific building in the layout.
 * Shows scaled outputs and inputs based on actual production state.
 *
 * @param building The layout building instance
 * @param buildingDef The building definition with recipes
 * @param productionState The calculated production state for this building (optional)
 * @returns Array of resource tags to display on the building
 */
export function calculateBuildingResourceTags(
  building: BaseLayoutBuilding,
  buildingDef: Building,
  productionState?: BuildingProductionState,
): BuildingResourceTag[] {
  const tags: BuildingResourceTag[] = [];

  const recipe = resolveLayoutBuildingRecipe(building, buildingDef);
  if (!recipe) {
    return tags;
  }

  // If we have production state, use it for accurate scaled values
  if (productionState) {
    // Add output tag with scaled production
    tags.push({
      itemId: recipe.output.id,
      rate: productionState.actualOutputRate,
      maxRate: productionState.maxOutputRate,
      type: "output",
      satisfied: productionState.productionFactor >= 0.99, // Consider 99%+ as satisfied
      fulfillmentRatio: productionState.productionFactor,
    });

    // Add input tags with fulfillment info
    for (const inputReq of productionState.inputRequirements) {
      const fulfillmentRatio =
        inputReq.requiredRate > 0
          ? Math.min(1, inputReq.suppliedRate / inputReq.requiredRate)
          : 1;

      tags.push({
        itemId: inputReq.itemId,
        rate: inputReq.suppliedRate,
        maxRate: inputReq.requiredRate,
        type: "input",
        satisfied: fulfillmentRatio >= 0.99, // Consider 99%+ as satisfied
        fulfillmentRatio,
      });
    }
  } else {
    // Fallback: No production state available, show nominal values
    const buildingCount = building.count || 1; // Default to 1 for backwards compatibility

    tags.push({
      itemId: recipe.output.id,
      rate: recipe.output.amount_per_minute * buildingCount,
      maxRate: recipe.output.amount_per_minute * buildingCount,
      type: "output",
      satisfied: true,
      fulfillmentRatio: 1,
    });

    for (const input of recipe.inputs) {
      tags.push({
        itemId: input.id,
        rate: 0,
        maxRate: input.amount_per_minute * buildingCount,
        type: "input",
        satisfied: false,
        fulfillmentRatio: 0,
      });
    }
  }

  return tags;
}
