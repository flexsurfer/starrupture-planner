import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import { useState, useRef, useCallback } from "react";
import { resolveLayoutBuildingRecipe } from "@/features/base-layout/recipe-resolution";
import { ItemImage } from "@/shared/ui";

interface BaseLayoutBalanceSummaryProps {
  baseId: string;
  className?: string;
  expandedView?: boolean;
}

const BaseLayoutBalanceSummary = ({
  baseId,
  className,
  expandedView = false,
}: BaseLayoutBalanceSummaryProps) => {
  const runtime = useRuntime();
  const balance = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_BALANCE_BY_BASE_ID,
    baseId,
  ]);
  const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const layoutBuildings = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_BUILDINGS_BY_BASE_ID,
    baseId,
  ]);
  const buildingsById = useSubscription([
    appIds.subscriptions.BUILDINGS_BY_ID_MAP,
  ]);
  const connections = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_CONNECTIONS_BY_BASE_ID,
    baseId,
  ]);
  // Brief flash on the clicked row — independent of global selection state to
  // avoid feedback loops (a selected building can produce/consume many items).
  const [flashedItemId, setFlashedItemId] = useState<string | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter to only show items with imbalance
  const imbalancedItems = balance.filter((b) => b.surplus > 0 || b.deficit > 0);
  //sort by lowest balance first
  imbalancedItems.sort((a, b) => {
    const balanceA = a.surplus - a.deficit;
    const balanceB = b.surplus - b.deficit;
    return balanceA - balanceB;
  });

  // Aggregate receiver (input) and dispatcher (output) rates
  const receiverRates = new Map<string, number>();
  const dispatcherRates = new Map<string, number>();

  for (const b of layoutBuildings ?? []) {
    const isReceiver =
      b.buildingType === "receiver" || b.buildingId === "package_receiver";
    const isDispatcher =
      b.buildingType === "dispatcher" || b.buildingId === "package_dispatcher";
    if (isReceiver) {
      receiverRates.set(
        b.itemId,
        (receiverRates.get(b.itemId) ?? 0) + (b.receiverOutputRate ?? 100),
      );
    }
    if (isDispatcher) {
      dispatcherRates.set(
        b.itemId,
        (dispatcherRates.get(b.itemId) ?? 0) + (b.dispatcherInputRate ?? 100),
      );
    }
  }

  const handleRowClick = useCallback(
    (itemId: string) => {
      const buildingIds: string[] = [];
      for (const lb of layoutBuildings ?? []) {
        const isReceiver =
          lb.buildingType === "receiver" ||
          lb.buildingId === "package_receiver";
        const isDispatcher =
          lb.buildingType === "dispatcher" ||
          lb.buildingId === "package_dispatcher";
        if (isReceiver || isDispatcher) {
          if (lb.itemId === itemId) buildingIds.push(lb.id);
          continue;
        }
        const building = buildingsById?.[lb.buildingId];
        const recipe = resolveLayoutBuildingRecipe(lb, building);
        if (!recipe) continue;
        if (
          recipe.output.id === itemId ||
          recipe.inputs.some((i) => i.id === itemId)
        ) {
          buildingIds.push(lb.id);
        }
      }

      const connectionIds = (connections ?? [])
        .filter((c) => c.itemId === itemId)
        .map((c) => c.id);

      runtime.dispatch([
        appIds.events.BASE_LAYOUT_SET_SELECTION,
        buildingIds,
        connectionIds,
      ]);

      // Flash the clicked row briefly, then clear — no tie to global selection state to
      // avoid feedback loops.
      if (flashTimerRef.current !== null) clearTimeout(flashTimerRef.current);
      setFlashedItemId(itemId);
      flashTimerRef.current = setTimeout(() => {
        setFlashedItemId(null);
        flashTimerRef.current = null;
      }, 600);
    },
    [layoutBuildings, buildingsById, connections, runtime],
  );

  if (imbalancedItems.length === 0 && !expandedView) {
    return (
      <div className={`alert alert-success ${className}`}>
        <span>✅ All production balanced! No surpluses or deficits.</span>
      </div>
    );
  }

  if (expandedView) {
    // 3-column layout for BaseDetailView
    return (
      <div className={`grid grid-cols-3 gap-4 ${className ?? ""}`}>
        {/* Column 1: Inputs (Receivers) */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Input</h4>
          {receiverRates.size > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...receiverRates.entries()].map(([itemId, rate]) => {
                    const item = itemsById[itemId];
                    return (
                      <tr key={itemId}>
                        <td>
                          <div className="flex items-center gap-2">
                            <ItemImage itemId={itemId} size="small" />
                            <span className="text-sm">
                              {item?.name || itemId}
                            </span>
                          </div>
                        </td>
                        <td className="text-right text-sm">{rate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <span className="text-xs text-base-content/30">—</span>
          )}
        </div>

        {/* Column 2: Base Balance */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Base Balance</h4>
          {imbalancedItems.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th
                      className="text-right"
                      title="Production/Demand/Balance"
                    >
                      P/D/B
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {imbalancedItems.map((item) => {
                    const itemData = itemsById[item.itemId];
                    const balanceValue = item.surplus - item.deficit;
                    const balanceClass =
                      balanceValue > 0
                        ? "text-success"
                        : balanceValue < 0
                          ? "text-error"
                          : "";
                    const isFlashing = flashedItemId === item.itemId;

                    return (
                      <tr
                        key={item.itemId}
                        onClick={() => handleRowClick(item.itemId)}
                        className={`cursor-pointer transition-colors duration-300 ${
                          isFlashing ? "bg-primary/25" : "hover:bg-base-300"
                        }`}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <ItemImage itemId={item.itemId} size="small" />
                            <span className="text-sm">
                              {itemData?.name || item.itemId}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex flex-col items-end leading-tight">
                            <span className="text-sm">
                              {item.totalProduction.toFixed(1)}/
                              {item.totalDemand.toFixed(1)}
                            </span>
                            <span
                              className={`font-bold text-sm ${balanceClass}`}
                            >
                              {balanceValue > 0 && "+"}
                              {balanceValue.toFixed(1)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="alert alert-success alert-sm">
              <span>✅ Balanced</span>
            </div>
          )}
        </div>

        {/* Column 3: Outputs (Dispatchers) */}
        <div>
          <h4 className="font-semibold text-sm mb-3">Output</h4>
          {dispatcherRates.size > 0 ? (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dispatcherRates.entries()].map(([itemId, rate]) => {
                    const item = itemsById[itemId];
                    return (
                      <tr key={itemId}>
                        <td>
                          <div className="flex items-center gap-2">
                            <ItemImage itemId={itemId} size="small" />
                            <span className="text-sm">
                              {item?.name || itemId}
                            </span>
                          </div>
                        </td>
                        <td className="text-right text-sm">{rate}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <span className="text-xs text-base-content/30">—</span>
          )}
        </div>
      </div>
    );
  }

  // Standard single-column layout for layout balance palette
  if (imbalancedItems.length === 0) {
    return (
      <div className={`alert alert-success ${className}`}>
        <span>✅ All production balanced! No surpluses or deficits.</span>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right" title="Production/Demand/Balance">
                P/D/B
              </th>
            </tr>
          </thead>
          <tbody>
            {imbalancedItems.map((item) => {
              const itemData = itemsById[item.itemId];
              const balanceValue = item.surplus - item.deficit;
              const balanceClass =
                balanceValue > 0
                  ? "text-success"
                  : balanceValue < 0
                    ? "text-error"
                    : "";
              const isFlashing = flashedItemId === item.itemId;

              return (
                <tr
                  key={item.itemId}
                  onClick={() => handleRowClick(item.itemId)}
                  className={`cursor-pointer transition-colors duration-300 ${
                    isFlashing ? "bg-primary/25" : "hover:bg-base-300"
                  }`}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <ItemImage itemId={item.itemId} size="small" />
                      <span className="font-semibold">
                        {itemData?.name || item.itemId}
                      </span>
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex flex-col items-end leading-tight">
                      <span>
                        {item.totalProduction.toFixed(1)}/
                        {item.totalDemand.toFixed(1)}
                      </span>
                      <span className={`font-bold ${balanceClass}`}>
                        {balanceValue > 0 && "+"}
                        {balanceValue.toFixed(1)}/min
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BaseLayoutBalanceSummary;
