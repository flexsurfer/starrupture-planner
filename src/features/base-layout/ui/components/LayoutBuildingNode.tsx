import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import { memo, useState } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type {
  BaseLayoutBuilding,
  RailTier,
  TransferMode,
} from "@/app/uklad/model";
import { resolveLayoutBuildingRecipe } from "@/features/base-layout/recipe-resolution";
import { BuildingImage, ItemImage } from "@/shared/ui";
import { calculateBuildingResourceTags } from "@/features/base-layout/utils/buildingResourceCalculator";
import type { BuildingProductionState } from "@/features/base-layout/utils/layoutBalanceCalculator";

interface LayoutBuildingNodeData {
  building: BaseLayoutBuilding;
  baseId: string;
  connectorMode?: RailTier | null;
  transferMode?: TransferMode;
  isConnectionSource?: boolean;
  isConnectionTarget?: boolean;
  selected?: boolean;
}

const OUTPUT_HANDLE_CLASS =
  "!h-6 !w-6 !rounded-full !border-4 !border-base-100 !bg-primary shadow-lg";

const INPUT_HANDLE_CLASS =
  "!h-4 !w-4 !rounded-full !border-2 !border-base-100 !bg-base-content/70 shadow-md";

const LayoutBuildingNode = memo((props: NodeProps) => {
  const runtime = useRuntime();
  const data = props.data as unknown as LayoutBuildingNodeData;
  const {
    building,
    baseId,
    connectorMode,
    transferMode,
    isConnectionSource,
    isConnectionTarget,
    selected,
  } = data;
  const isVirtual = transferMode === "virtual";

  const buildingsById = useSubscription([
    appIds.subscriptions.BUILDINGS_BY_ID_MAP,
  ]);
  const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const buildingStates = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_BUILDING_STATES_BY_BASE_ID,
    baseId,
  ]);

  const isEnabled = building.enabled !== false; // undefined = enabled

  const handleToggleMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    runtime.dispatch([
      appIds.events.BASE_LAYOUT_TOGGLE_BUILDING_MODE,
      baseId,
      building.id,
    ]);
  };

  const handleToggleEnabled = (e: React.MouseEvent) => {
    e.stopPropagation();
    runtime.dispatch([
      appIds.events.BASE_LAYOUT_TOGGLE_BUILDING_ENABLED,
      baseId,
      building.id,
    ]);
  };

  const renderModeToggleButton = (
    onClick: (e: React.MouseEvent) => void,
    isEditMode: boolean,
  ) => (
    <button
      onClick={onClick}
      className="btn btn-xs btn-circle flex-shrink-0"
      title={isEditMode ? "Save and switch to summary" : "Switch to edit"}
    >
      {isEditMode ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      )}
    </button>
  );

  const enabledToggleButton = (
    <button
      onClick={handleToggleEnabled}
      className={`btn btn-xs btn-circle flex-shrink-0 border transition-colors ${
        isEnabled
          ? "bg-success/20 border-success/50 text-success hover:bg-error/20 hover:border-error/50 hover:text-error"
          : "bg-base-300 border-base-content/20 text-base-content/40 hover:bg-success/20 hover:border-success/50 hover:text-success"
      }`}
      title={
        isEnabled
          ? "Building is ON — click to turn off"
          : "Building is OFF — click to turn on"
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-3.5 h-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
        <line x1="12" y1="2" x2="12" y2="12" />
      </svg>
    </button>
  );

  const currentMode = building.mode || "edit";
  const isSummaryMode = currentMode === "summary";

  const formatRate = (rate: number): string => rate.toFixed(0);

  const renderCurrentMaxRate = (current: number, max: number) => {
    const currentText = formatRate(current);
    const maxText = formatRate(max);
    if (currentText === maxText) {
      return <>{currentText}</>;
    }

    return (
      <>
        {currentText}
        <span className="text-base-content/40">/</span>
        <span className="text-base-content/50">{maxText}</span>
      </>
    );
  };

  const renderOutputRate = (
    fallbackRate: number,
    productionState?: BuildingProductionState,
  ) => {
    const actual = productionState?.actualOutputRate ?? fallbackRate;
    const max = productionState?.maxOutputRate ?? fallbackRate;

    return <>{renderCurrentMaxRate(actual, max)}</>;
  };

  const hasSurplusOutput = (
    productionState?: BuildingProductionState,
  ): boolean => {
    if (!productionState) {
      return false;
    }

    return (
      productionState.actualOutputRate > productionState.consumedOutputRate
    );
  };

  const getStateVisualClasses = (
    hasDeficit: boolean,
    hasSurplus: boolean,
  ): {
    borderClass: string;
    backgroundClass: string;
    summaryBackgroundClass: string;
  } => {
    if (hasSurplus) {
      return {
        borderClass: "border-success",
        backgroundClass: "bg-success/12",
        summaryBackgroundClass: "bg-success/18",
      };
    }

    if (hasDeficit) {
      return {
        borderClass: "border-error",
        backgroundClass: "bg-error/12",
        summaryBackgroundClass: "bg-error/18",
      };
    }

    return {
      borderClass: "border-base-content/30",
      backgroundClass: "bg-base-300",
      summaryBackgroundClass: "bg-base-300/80",
    };
  };

  const buildingCount = building.count || 1;
  const receiverOutputRate = building.receiverOutputRate || 100;
  const dispatcherInputRate = building.dispatcherInputRate || 100;
  const [localBuildingCount, setLocalBuildingCount] = useState(() =>
    String(buildingCount),
  );
  const [prevBuildingCount, setPrevBuildingCount] = useState(buildingCount);
  if (prevBuildingCount !== buildingCount) {
    setPrevBuildingCount(buildingCount);
    setLocalBuildingCount(String(buildingCount));
  }

  const [localReceiverOutputRate, setLocalReceiverOutputRate] = useState(() =>
    String(receiverOutputRate),
  );
  const [prevReceiverOutputRate, setPrevReceiverOutputRate] =
    useState(receiverOutputRate);
  if (prevReceiverOutputRate !== receiverOutputRate) {
    setPrevReceiverOutputRate(receiverOutputRate);
    setLocalReceiverOutputRate(String(receiverOutputRate));
  }

  const [localDispatcherInputRate, setLocalDispatcherInputRate] = useState(() =>
    String(dispatcherInputRate),
  );
  const [prevDispatcherInputRate, setPrevDispatcherInputRate] =
    useState(dispatcherInputRate);
  if (prevDispatcherInputRate !== dispatcherInputRate) {
    setPrevDispatcherInputRate(dispatcherInputRate);
    setLocalDispatcherInputRate(String(dispatcherInputRate));
  }

  const commitBuildingCount = () => {
    const parsed = parseInt(localBuildingCount, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.round(parsed));
      setLocalBuildingCount(String(clamped));
      if (clamped !== buildingCount) {
        runtime.dispatch([
          appIds.events.BASE_LAYOUT_UPDATE_BUILDING_COUNT,
          baseId,
          building.id,
          clamped,
        ]);
      }
      return;
    }

    setLocalBuildingCount(String(buildingCount));
  };

  const handleModeButtonClick = (e: React.MouseEvent) => {
    if (!isSummaryMode) {
      commitBuildingCount();
    }
    handleToggleMode(e);
  };

  const commitDispatcherInputRate = () => {
    const parsed = parseInt(localDispatcherInputRate, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.round(parsed));
      setLocalDispatcherInputRate(String(clamped));
      if (clamped !== dispatcherInputRate) {
        runtime.dispatch([
          appIds.events.BASE_LAYOUT_UPDATE_DISPATCHER_INPUT_RATE,
          baseId,
          building.id,
          clamped,
        ]);
      }
      return;
    }

    setLocalDispatcherInputRate(String(dispatcherInputRate));
  };

  const commitReceiverOutputRate = () => {
    const parsed = parseInt(localReceiverOutputRate, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.round(parsed));
      setLocalReceiverOutputRate(String(clamped));
      if (clamped !== receiverOutputRate) {
        runtime.dispatch([
          appIds.events.BASE_LAYOUT_UPDATE_RECEIVER_OUTPUT_RATE,
          baseId,
          building.id,
          clamped,
        ]);
      }
      return;
    }

    setLocalReceiverOutputRate(String(receiverOutputRate));
  };

  if (building.buildingType === "receiver") {
    const item = itemsById[building.itemId];
    const productionState = buildingStates?.[building.id];
    const outputRate = receiverOutputRate;
    const surplusAmount = productionState
      ? Math.max(
          0,
          Math.round(
            productionState.actualOutputRate -
              productionState.consumedOutputRate,
          ),
        )
      : 0;

    if (!item) {
      return (
        <div className="bg-error text-error-content p-2 rounded">
          Invalid receiver item
        </div>
      );
    }

    const receiverVisualClasses = getStateVisualClasses(
      false,
      hasSurplusOutput(productionState),
    );

    const borderClass = isConnectionSource
      ? "border-primary !border-4 shadow-2xl"
      : selected
        ? "border-info !border-4 shadow-2xl"
        : isConnectionTarget
          ? "border-success !border-4 shadow-2xl"
          : connectorMode
            ? "border-primary border-dashed"
            : receiverVisualClasses.borderClass;

    const containerClass = `backdrop-blur-md ${receiverVisualClasses.summaryBackgroundClass} rounded-lg border-2 ${borderClass} shadow-xl p-3 min-w-[180px] transition-all`;

    const handleReceiverModeButtonClick = (e: React.MouseEvent) => {
      if (!isSummaryMode) {
        commitReceiverOutputRate();
      }
      handleToggleMode(e);
    };

    return (
      <>
        <Handle
          type="source"
          position={Position.Right}
          className={OUTPUT_HANDLE_CLASS}
          isConnectable={!isVirtual}
        />
        <div
          className={`${containerClass} ${
            connectorMode
              ? "cursor-pointer hover:ring-4 hover:ring-primary/50 hover:shadow-2xl"
              : ""
          } ${isConnectionSource ? "ring-4 ring-primary animate-pulse" : ""} ${
            isConnectionTarget ? "ring-4 ring-success/40" : ""
          } ${selected ? "ring-4 ring-info/40" : ""} ${!isEnabled ? "opacity-50" : ""}`}
          style={{ pointerEvents: "all" }}
        >
          {isConnectionSource && (
            <div className="absolute -top-2 -right-2 bg-primary text-primary-content text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
              SOURCE
            </div>
          )}

          <div className="flex items-center justify-between mb-2 gap-1">
            <div
              className="font-bold text-sm flex-1 min-w-0 truncate"
              title="Package Receiver"
            >
              Package Receiver
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isSummaryMode && (
                <input
                  type="number"
                  min={1}
                  value={localReceiverOutputRate}
                  onChange={(e) => setLocalReceiverOutputRate(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag input input-xs w-14 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  title="Receiver output rate"
                />
              )}
              {renderModeToggleButton(
                handleReceiverModeButtonClick,
                !isSummaryMode,
              )}
              {enabledToggleButton}
            </div>
          </div>

          <div className="mb-2">
            <div className="grid grid-cols-3 items-center">
              <div aria-hidden="true" />
              <div className="flex justify-center">
                <BuildingImage buildingId="package_receiver" size="medium" />
              </div>
              <div className="flex justify-center">
                {surplusAmount > 0 ? (
                  <span className="text-base font-bold text-success whitespace-nowrap">
                    +{surplusAmount}
                  </span>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
            </div>
          </div>

          <div className="rounded p-2 bg-base-300">
            <div className="flex items-center gap-2">
              <ItemImage itemId={item.id} size="small" />
              <div className="flex-1">
                <div className="text-xs font-semibold truncate">
                  {item.name}
                </div>
                <div className="text-xs text-base-content/70">
                  {renderOutputRate(outputRate, productionState)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex gap-2 text-xs text-base-content/70">
            <div>⚡ 40</div>
            <div>🔥 40</div>
          </div>
        </div>
      </>
    );
  }

  if (building.buildingType === "dispatcher") {
    const item = itemsById[building.itemId];
    const productionState = buildingStates?.[building.id];
    const inputReq = productionState?.inputRequirements[0];
    const suppliedRate = inputReq?.suppliedRate ?? dispatcherInputRate;
    const requiredRate = inputReq?.requiredRate ?? dispatcherInputRate;
    const deficitAmount = Math.max(0, Math.round(requiredRate - suppliedRate));
    const hasDeficit = deficitAmount > 0;

    if (!item) {
      return (
        <div className="bg-error text-error-content p-2 rounded">
          Invalid dispatcher item
        </div>
      );
    }

    const dispatcherVisualClasses = getStateVisualClasses(hasDeficit, false);

    const borderClass = isConnectionTarget
      ? "border-success !border-4 shadow-2xl"
      : selected
        ? "border-info !border-4 shadow-2xl"
        : isConnectionSource
          ? "border-primary !border-4 shadow-2xl"
          : connectorMode
            ? "border-primary border-dashed"
            : dispatcherVisualClasses.borderClass;

    const containerClass = `backdrop-blur-md ${dispatcherVisualClasses.summaryBackgroundClass} rounded-lg border-2 ${borderClass} shadow-xl p-3 min-w-[180px] transition-all`;

    const handleDispatcherModeButtonClick = (e: React.MouseEvent) => {
      if (!isSummaryMode) {
        commitDispatcherInputRate();
      }
      handleToggleMode(e);
    };

    return (
      <>
        <Handle
          type="target"
          position={Position.Left}
          className={INPUT_HANDLE_CLASS}
          isConnectable={!isVirtual}
        />
        <div
          className={`${containerClass} ${
            connectorMode
              ? "cursor-pointer hover:ring-4 hover:ring-primary/50 hover:shadow-2xl"
              : ""
          } ${isConnectionTarget ? "ring-4 ring-success/40" : ""} ${
            selected ? "ring-4 ring-info/40" : ""
          } ${!isEnabled ? "opacity-50" : ""}`}
          style={{ pointerEvents: "all" }}
        >
          <div className="flex items-center justify-between mb-2 gap-1">
            <div
              className="font-bold text-sm flex-1 min-w-0 truncate"
              title="Package Dispatcher"
            >
              Package Dispatcher
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!isSummaryMode && (
                <input
                  type="number"
                  min={1}
                  value={localDispatcherInputRate}
                  onChange={(e) => setLocalDispatcherInputRate(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag input input-xs w-14 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  title="Dispatcher input rate"
                />
              )}
              {renderModeToggleButton(
                handleDispatcherModeButtonClick,
                !isSummaryMode,
              )}
              {enabledToggleButton}
            </div>
          </div>

          <div className="mb-2">
            <div className="grid grid-cols-3 items-center">
              <div className="flex justify-center">
                {hasDeficit ? (
                  <span className="text-base font-bold text-error whitespace-nowrap">
                    -{deficitAmount}
                  </span>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
              <div className="flex justify-center">
                <BuildingImage buildingId="package_dispatcher" size="medium" />
              </div>
              <div aria-hidden="true" />
            </div>
          </div>

          <div className="rounded p-2 bg-base-300">
            <div className="flex items-center gap-2">
              <ItemImage itemId={item.id} size="small" />
              <div className="flex-1">
                <div className="text-xs font-semibold truncate">
                  {item.name}
                </div>
                <div className="text-xs text-base-content/70">
                  {renderCurrentMaxRate(suppliedRate, requiredRate)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex gap-2 text-xs text-base-content/70">
            <div>⚡ 40</div>
            <div>🔥 40</div>
          </div>
        </div>
      </>
    );
  }

  const buildingDef = buildingsById[building.buildingId];
  const item = itemsById[building.itemId];
  const recipe = resolveLayoutBuildingRecipe(building, buildingDef);
  const productionState = buildingStates?.[building.id];

  if (!buildingDef || !item || !recipe) {
    return (
      <div className="bg-error text-error-content p-2 rounded">
        Invalid building
      </div>
    );
  }

  const resourceTags = calculateBuildingResourceTags(
    building,
    buildingDef,
    productionState,
  );

  const hasUnmetInputs = resourceTags.some(
    (tag) => tag.type === "input" && !tag.satisfied,
  );
  const hasSurplus = hasSurplusOutput(productionState);
  const buildingVisualClasses = getStateVisualClasses(
    hasUnmetInputs,
    hasSurplus,
  );

  let borderClass = buildingVisualClasses.borderClass;

  if (isConnectionSource) {
    borderClass = "border-primary !border-4 shadow-2xl";
  } else if (selected) {
    borderClass = "border-info !border-4 shadow-2xl";
  } else if (isConnectionTarget) {
    borderClass = "border-success !border-4 shadow-2xl";
  } else if (connectorMode) {
    borderClass = "border-primary border-dashed";
  }

  const containerClass = `backdrop-blur-md ${buildingVisualClasses.summaryBackgroundClass} rounded-lg border-2 ${borderClass} shadow-xl p-3 min-w-[180px] transition-all`;

  const buildingTitle =
    isSummaryMode && buildingCount > 1
      ? `${buildingDef.name} (x${buildingCount})`
      : buildingDef.name;

  const productionFactor =
    productionState && Number.isFinite(productionState.productionFactor)
      ? Math.max(0, Math.min(1, productionState.productionFactor))
      : 1;
  const productionPercent = Math.round(productionFactor * 100);
  const surplusAmount = productionState
    ? Math.max(
        0,
        Math.round(
          productionState.actualOutputRate - productionState.consumedOutputRate,
        ),
      )
    : 0;
  const efficiencyColorClass =
    productionFactor === 0
      ? "text-error"
      : productionFactor < 0.99
        ? "text-warning"
        : "text-success";
  const efficiencyFillColor =
    productionFactor === 0
      ? "var(--color-error)"
      : productionFactor < 0.99
        ? "var(--color-warning)"
        : "var(--color-success)";

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className={INPUT_HANDLE_CLASS}
        isConnectable={!isVirtual}
      />
      <div
        className={`${containerClass} ${
          connectorMode
            ? "cursor-pointer hover:ring-4 hover:ring-primary/50 hover:shadow-2xl"
            : ""
        } ${isConnectionSource ? "ring-4 ring-primary animate-pulse" : ""} ${
          isConnectionTarget ? "ring-4 ring-success/40" : ""
        } ${selected ? "ring-4 ring-info/40" : ""} ${!isEnabled ? "opacity-50" : ""}`}
        style={{ pointerEvents: "all" }}
      >
        {isConnectionSource && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-content text-xs font-bold px-2 py-1 rounded-full shadow-lg z-10">
            SOURCE
          </div>
        )}

        <div className="flex items-center justify-between mb-2 gap-1">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="font-bold text-sm truncate" title={buildingTitle}>
              {buildingTitle}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isSummaryMode && (
              <>
                <input
                  type="number"
                  min={1}
                  value={localBuildingCount}
                  onChange={(e) => setLocalBuildingCount(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="nodrag input input-xs w-10 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  title="Number of buildings"
                />
                <span className="text-xs font-semibold text-base-content/50">
                  ×
                </span>
              </>
            )}
            {renderModeToggleButton(handleModeButtonClick, !isSummaryMode)}
            {enabledToggleButton}
          </div>
        </div>

        <div className="mb-2">
          <div className="grid grid-cols-3 items-center">
            <div className="flex justify-center">
              <div
                className="relative w-10 h-10 rounded-full border border-base-content/20 shadow-sm"
                style={{
                  background: `conic-gradient(${efficiencyFillColor} ${productionPercent}%, var(--color-base-300) 0)`,
                }}
                title={`Output efficiency: ${productionPercent}%`}
              >
                <div className="absolute inset-[5px] rounded-full bg-base-100 flex items-center justify-center">
                  <span
                    className={`text-[10px] font-bold ${efficiencyColorClass}`}
                  >
                    {productionPercent}%
                  </span>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <BuildingImage buildingId={buildingDef.id} size="medium" />
            </div>
            <div className="flex justify-center">
              {surplusAmount > 0 ? (
                <span className="text-base font-bold text-success whitespace-nowrap">
                  +{surplusAmount}
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          </div>
        </div>

        <div className="rounded p-2 bg-base-300">
          <div className="flex items-center gap-2">
            <ItemImage itemId={item.id} size="small" />
            <div className="flex-1">
              <div className="text-xs font-semibold truncate">{item.name}</div>
              <div className="text-xs text-base-content/70">
                {renderOutputRate(
                  recipe.output.amount_per_minute,
                  productionState,
                )}
              </div>
            </div>
          </div>
        </div>

        {resourceTags.length > 0 && (
          <div className="mt-2 space-y-1">
            {resourceTags.map((tag) => {
              const tagItem = itemsById[tag.itemId];
              if (!tagItem) return null;

              if (tag.type === "output") return null;

              let bgClass = "bg-base-300";
              let textClass = "";

              if (tag.fulfillmentRatio === 0) {
                bgClass = "bg-error/20";
                textClass = "text-error font-semibold";
              } else if (tag.fulfillmentRatio < 0.99) {
                bgClass = "bg-warning/20";
                textClass = "text-warning font-semibold";
              }

              return (
                <div
                  key={tag.itemId}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${bgClass} ${textClass}`}
                >
                  <ItemImage itemId={tag.itemId} size="small" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{tagItem.name}</div>
                    <div className="font-bold whitespace-nowrap">
                      {renderCurrentMaxRate(tag.rate, tag.maxRate)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-2 flex gap-2 text-xs text-base-content/70">
          {buildingDef.power && <div>⚡ {buildingDef.power}</div>}
          {buildingDef.heat && <div>🔥 {buildingDef.heat}</div>}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className={OUTPUT_HANDLE_CLASS}
        isConnectable={!isVirtual}
      />
    </>
  );
});

LayoutBuildingNode.displayName = "LayoutBuildingNode";

export default LayoutBuildingNode;
