import type {
  BaseLayoutBuilding,
  BaseLayoutConnection,
  BuildingsByIdMap,
} from "@/app/uklad/model";
import { getRailCapacity } from "./layoutBalanceCalculator";
import { resolveLayoutBuildingRecipe } from "@/features/base-layout/recipe-resolution";

export interface ConnectionValidation {
  isValid: boolean;
  error?: string;
  warning?: string;
}

/**
 * Validates a connection between two layout buildings
 *
 * @param fromBuilding Source building
 * @param toBuilding Destination building
 * @param itemId Item being transported
 * @param railTier Rail tier (1, 2, or 3)
 * @param buildingsById Building definitions
 * @param existingConnections Existing connections (to check for duplicates)
 * @returns Validation result with error/warning messages
 */
export function validateConnection(
  fromBuilding: BaseLayoutBuilding,
  toBuilding: BaseLayoutBuilding,
  itemId: string,
  railTier: number,
  buildingsById: BuildingsByIdMap,
  existingConnections?: BaseLayoutConnection[],
): ConnectionValidation {
  // Check if buildings exist
  const fromBuildingDef = buildingsById[fromBuilding.buildingId];
  const toBuildingDef = buildingsById[toBuilding.buildingId];

  if (!fromBuildingDef) {
    return { isValid: false, error: "Source building not found" };
  }

  if (!toBuildingDef) {
    return { isValid: false, error: "Destination building not found" };
  }

  // Handle package receivers as source (they don't have recipes)
  let fromRecipe = null;
  let productionRate = 0;

  if (fromBuilding.buildingType === "receiver") {
    // Package receiver - check if it produces the correct item
    if (fromBuilding.itemId !== itemId) {
      return {
        isValid: false,
        error: `Source receiver does not produce ${itemId}`,
      };
    }
    productionRate = fromBuilding.receiverOutputRate || 100;
  } else {
    // Production building - check if source building has recipes
    if (!fromBuildingDef.recipes || fromBuildingDef.recipes.length === 0) {
      return { isValid: false, error: "Source building has no recipes" };
    }

    fromRecipe = resolveLayoutBuildingRecipe(fromBuilding, fromBuildingDef);
    if (!fromRecipe) {
      return { isValid: false, error: "Source building recipe not found" };
    }

    // Check if source produces the item
    if (fromRecipe.output.id !== itemId) {
      return {
        isValid: false,
        error: `Source building does not produce ${itemId}`,
      };
    }
    productionRate = fromRecipe.output.amount_per_minute;
  }

  // Handle package dispatchers as destination (they don't have recipes)
  const isDispatcherTarget =
    toBuilding.buildingType === "dispatcher" ||
    toBuilding.buildingId === "package_dispatcher";

  if (isDispatcherTarget) {
    if (toBuilding.itemId !== itemId) {
      return {
        isValid: false,
        error: `Dispatcher does not consume ${itemId}`,
      };
    }

    // Check for duplicate connections
    if (existingConnections) {
      const duplicate = existingConnections.find(
        (conn) =>
          conn.fromBuildingId === fromBuilding.id &&
          conn.toBuildingId === toBuilding.id &&
          conn.itemId === itemId,
      );
      if (duplicate) {
        return {
          isValid: false,
          error:
            "Connection already exists between these buildings for this item",
        };
      }
    }

    const demandRate = toBuilding.dispatcherInputRate || 100;
    const railCapacity = getRailCapacity(railTier);
    const requiredCapacity = Math.min(productionRate, demandRate);
    if (railCapacity < requiredCapacity) {
      return {
        isValid: true,
        warning: `Rail capacity (${railCapacity}/min) is below required flow rate (${requiredCapacity}/min)`,
      };
    }
    return { isValid: true };
  }

  // Check if destination building has recipes
  if (!toBuildingDef.recipes || toBuildingDef.recipes.length === 0) {
    return { isValid: false, error: "Destination building has no recipes" };
  }

  const toRecipe = resolveLayoutBuildingRecipe(toBuilding, toBuildingDef);
  if (!toRecipe) {
    return { isValid: false, error: "Destination building recipe not found" };
  }

  // Check if destination consumes the item
  const toInput = toRecipe.inputs.find((inp) => inp.id === itemId);
  if (!toInput) {
    return {
      isValid: false,
      error: `Destination building does not consume ${itemId}`,
    };
  }

  // Check for duplicate connections
  if (existingConnections) {
    const duplicate = existingConnections.find(
      (conn) =>
        conn.fromBuildingId === fromBuilding.id &&
        conn.toBuildingId === toBuilding.id &&
        conn.itemId === itemId,
    );

    if (duplicate) {
      return {
        isValid: false,
        error:
          "Connection already exists between these buildings for this item",
      };
    }
  }

  // Check capacity warnings
  const demandRate = toInput.amount_per_minute;
  const railCapacity = getRailCapacity(railTier);

  const requiredCapacity = Math.min(productionRate, demandRate);

  if (railCapacity < requiredCapacity) {
    return {
      isValid: true,
      warning: `Rail capacity (${railCapacity}/min) is below required flow rate (${requiredCapacity}/min)`,
    };
  }

  return { isValid: true };
}

/**
 * Checks if a connection exceeds its rail capacity
 */
export function isConnectionOverCapacity(
  connection: BaseLayoutConnection,
  fromBuilding: BaseLayoutBuilding,
  toBuilding: BaseLayoutBuilding,
  buildingsById: BuildingsByIdMap,
): boolean {
  const fromBuildingDef = buildingsById[fromBuilding.buildingId];
  const toBuildingDef = buildingsById[toBuilding.buildingId];

  const isDispatcherTarget =
    toBuilding.buildingType === "dispatcher" ||
    toBuilding.buildingId === "package_dispatcher";

  if (!fromBuildingDef || (!isDispatcherTarget && !toBuildingDef?.recipes)) {
    return false;
  }

  let productionRate = 0;

  // Handle package receivers
  if (fromBuilding.buildingType === "receiver") {
    productionRate = fromBuilding.receiverOutputRate || 100;
  } else {
    if (!fromBuildingDef.recipes) {
      return false;
    }
    const fromRecipe = resolveLayoutBuildingRecipe(
      fromBuilding,
      fromBuildingDef,
    );
    if (!fromRecipe) {
      return false;
    }
    productionRate = fromRecipe.output.amount_per_minute;
  }

  if (isDispatcherTarget) {
    const demandRate = toBuilding.dispatcherInputRate || 100;
    const railCapacity = getRailCapacity(connection.railTier);
    const requiredCapacity = Math.min(productionRate, demandRate);
    return railCapacity < requiredCapacity;
  }

  const toRecipe = resolveLayoutBuildingRecipe(toBuilding, toBuildingDef);
  if (!toRecipe) {
    return false;
  }

  const toInput = toRecipe.inputs.find((inp) => inp.id === connection.itemId);
  if (!toInput) {
    return false;
  }

  const demandRate = toInput.amount_per_minute;
  const railCapacity = getRailCapacity(connection.railTier);

  const requiredCapacity = Math.min(productionRate, demandRate);

  return railCapacity < requiredCapacity;
}
