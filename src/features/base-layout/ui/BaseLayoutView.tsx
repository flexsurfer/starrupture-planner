import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import { useEffect } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { Base } from "@/app/uklad/model";
import { GRID_CELL_SIZE } from "@/features/base-layout/utils/gridUtils";
import LayoutCanvas from "./components/LayoutCanvas";
import ItemPalette from "./components/ItemPalette";
import ToolsPalette from "./components/ToolsPalette";
import BaseLayoutBalanceSummary from "./components/BaseLayoutBalanceSummary";

interface BaseLayoutViewProps {
  onBack?: () => void;
}

// Inner component that has access to ReactFlow context
const BaseLayoutContent = ({
  selectedBaseId,
  selectedBase,
  onBack,
}: {
  selectedBaseId: string;
  selectedBase: Base;
  onBack?: () => void;
}) => {
  const runtime = useRuntime();
  const { getViewport } = useReactFlow();

  const getViewportCenter = () => {
    const viewport = getViewport();
    // Calculate the center of the viewport in grid coordinates
    const centerX = Math.round(
      (-viewport.x + window.innerWidth / 2) / viewport.zoom / GRID_CELL_SIZE,
    );
    const centerY = Math.round(
      (-viewport.y + window.innerHeight / 2) / viewport.zoom / GRID_CELL_SIZE,
    );
    return { x: centerX, y: centerY };
  };

  return (
    <>
      {/* Top Bar with Back Button */}
      <div className="bg-base-200 border-b border-base-300 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                runtime.dispatch([appIds.events.BASES_SET_SELECTED_BASE, null]);
              }
            }}
            title="Back to base overview"
          >
            ← Back
          </button>
          <h3 className="text-lg font-bold">{selectedBase.name} - Layout</h3>
        </div>
        <div className="text-sm text-base-content/70">
          Buildings: {selectedBase.layout?.buildings.length || 0} | Connections:{" "}
          {selectedBase.layout?.connections.length || 0}
        </div>
      </div>

      {/* Main content area: Canvas + Right Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area */}
        <div className="flex-1 relative">
          <LayoutCanvas baseId={selectedBaseId} className="absolute inset-0" />
        </div>

        {/* Right Sidebar: Connector Palette + Item Palette + Balance Summary */}
        <div
          className="w-96 bg-base-200 border-l border-base-300 flex flex-col overflow-hidden"
          style={{ gap: "5px", padding: "3px 0 0 3px" }}
        >
          {/* Connector Palette - Fixed height */}
          <div className="border-b border-base-300 flex-shrink-0">
            <ToolsPalette />
          </div>

          {/* Item Palette - Flexible */}
          <div className="flex-1 flex flex-col overflow-hidden border-b border-base-300">
            <ItemPalette
              baseId={selectedBaseId}
              className="h-full"
              getViewportCenter={getViewportCenter}
            />
          </div>

          {/* Balance Summary - Fixed height */}
          <div
            className="overflow-y-auto flex-shrink-0"
            style={{ maxHeight: "40%" }}
          >
            <BaseLayoutBalanceSummary baseId={selectedBaseId} />
          </div>
        </div>
      </div>
    </>
  );
};

const BaseLayoutView = ({ onBack }: BaseLayoutViewProps = {}) => {
  const runtime = useRuntime();
  const selectedBaseId = useSubscription([
    appIds.subscriptions.BASES_SELECTED_BASE_ID,
  ]);
  const selectedBase = useSubscription([
    appIds.subscriptions.BASES_SELECTED_BASE,
  ]);

  // Ensure layout state is initialized (and transient per-building view state normalized)
  // when opening/switching base layout.
  // Do not rerun on every selectedBase update, otherwise edit mode toggles get reset immediately.
  useEffect(() => {
    if (selectedBaseId) {
      runtime.dispatch([appIds.events.BASE_LAYOUT_INIT, selectedBaseId]);
    }
  }, [runtime, selectedBaseId]);

  if (!selectedBaseId || !selectedBase) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-base-content/70">No base selected</p>
      </div>
    );
  }

  if (!selectedBase.layout) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-base-content/70 mb-4">Layout not initialized</p>
          <button
            className="btn btn-primary"
            onClick={() =>
              runtime.dispatch([appIds.events.BASE_LAYOUT_INIT, selectedBaseId])
            }
          >
            Initialize Layout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <ReactFlowProvider>
        <BaseLayoutContent
          selectedBaseId={selectedBaseId}
          selectedBase={selectedBase}
          onBack={onBack}
        />
      </ReactFlowProvider>
    </div>
  );
};

export default BaseLayoutView;
