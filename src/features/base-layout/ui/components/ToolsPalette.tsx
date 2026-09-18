import { useRuntime, useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import { useState, useRef, useEffect } from "react";
import type {
  DistributionMode,
  RailTier,
  TransferMode,
} from "@/app/uklad/model";

interface ToolsPaletteProps {
  className?: string;
}

interface RailTierInfo {
  tier: RailTier;
  name: string;
  capacity: number;
  icon: React.ReactNode;
}

const railTiers: RailTierInfo[] = [
  {
    tier: 1,
    name: "Tier 1 Rail",
    capacity: 120,
    icon: <span className="text-sm font-bold leading-none">&gt;</span>,
  },
  {
    tier: 2,
    name: "Tier 2 Rail",
    capacity: 240,
    icon: <span className="text-sm font-bold leading-none">&gt;&gt;</span>,
  },
  {
    tier: 3,
    name: "Tier 3 Rail",
    capacity: 480,
    icon: <span className="text-sm font-bold leading-none">&gt;&gt;&gt;</span>,
  },
];

interface DistributionModeInfo {
  mode: DistributionMode;
  label: string;
  title: string;
  icon: React.ReactNode;
}

const distributionModes: DistributionModeInfo[] = [
  {
    mode: "first-served",
    label: "First Served",
    title: "First Served — fills connections in order",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="4" y1="6" x2="20" y2="6" />
        <polyline points="14 3 17 6 14 9" />
        <line x1="4" y1="12" x2="14" y2="12" />
        <line x1="4" y1="18" x2="10" y2="18" />
      </svg>
    ),
  },
  {
    mode: "shortest-path",
    label: "Shortest Path",
    title: "Shortest Path — closest targets are filled first",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="5" cy="12" r="2" />
        <circle cx="19" cy="5" r="2" />
        <circle cx="19" cy="19" r="2" />
        <line x1="7" y1="11" x2="17" y2="6" />
        <line x1="7" y1="13" x2="17" y2="18" />
      </svg>
    ),
  },
  {
    mode: "equal",
    label: "Equal",
    title: "Equal — output is divided evenly across connections",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="5" y1="9" x2="19" y2="9" />
        <line x1="5" y1="15" x2="19" y2="15" />
      </svg>
    ),
  },
];

const transferModes: Array<{
  mode: TransferMode;
  label: string;
  title: string;
}> = [
  {
    mode: "virtual",
    label: "Virtual",
    title:
      "Virtual Transfers — all buildings share a single pool; select a building to see implicit connections",
  },
  {
    mode: "physical",
    label: "Physical",
    title: "Physical Transfers — items flow via explicit rail connections",
  },
];

const ToolsPalette = ({ className }: ToolsPaletteProps) => {
  const runtime = useRuntime();
  const connectorMode = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_CONNECTOR_MODE,
  ]);
  const selectedBuildingIds = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_SELECTED_BUILDING_IDS,
  ]);
  const selectedConnectionIds = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_SELECTED_CONNECTION_IDS,
  ]);
  const selectedBaseId = useSubscription([
    appIds.subscriptions.BASES_SELECTED_BASE_ID,
  ]);
  const selectedRailTier = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_SELECTED_RAIL_TIER,
  ]);
  const buildings = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_BUILDINGS_BY_BASE_ID,
    selectedBaseId ?? "",
  ]);
  const transferMode = useSubscription([
    appIds.subscriptions.BASE_LAYOUT_TRANSFER_MODE,
  ]);
  const isVirtual = transferMode === "virtual";

  // Derive active distribution mode from the first building; fall back to defaults when the
  // layout is empty or not yet loaded.
  const activeDistributionMode: DistributionMode =
    buildings?.[0]?.distributionMode ?? "first-served";

  const [distributionDropdownOpen, setDistributionDropdownOpen] =
    useState(false);
  const distributionDropdownRef = useRef<HTMLDivElement>(null);

  const [railDropdownOpen, setRailDropdownOpen] = useState(false);
  const railDropdownRef = useRef<HTMLDivElement>(null);

  const [transferDropdownOpen, setTransferDropdownOpen] = useState(false);
  const transferDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!distributionDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        distributionDropdownRef.current &&
        !distributionDropdownRef.current.contains(e.target as Node)
      ) {
        setDistributionDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [distributionDropdownOpen]);

  useEffect(() => {
    if (!railDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        railDropdownRef.current &&
        !railDropdownRef.current.contains(e.target as Node)
      ) {
        setRailDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [railDropdownOpen]);

  useEffect(() => {
    if (!transferDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        transferDropdownRef.current &&
        !transferDropdownRef.current.contains(e.target as Node)
      ) {
        setTransferDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [transferDropdownOpen]);

  const handleSelectRailTier = (tier: RailTier) => {
    setRailDropdownOpen(false);
    // Always persist the chosen tier so drag connections use it.
    runtime.dispatch([appIds.events.BASE_LAYOUT_SET_SELECTED_RAIL_TIER, tier]);
    if (selectedConnectionIds.length > 0 && selectedBaseId) {
      // Convert selected connections instead of entering connector mode.
      for (const connectionId of selectedConnectionIds) {
        runtime.dispatch([
          appIds.events.BASE_LAYOUT_UPDATE_CONNECTION_TIER,
          selectedBaseId,
          connectionId,
          tier,
        ]);
      }
      return;
    }
    runtime.dispatch([appIds.events.BASE_LAYOUT_SET_CONNECTOR_MODE, tier]);
  };

  const handleDeleteSelected = () => {
    if (selectedBuildingIds.length > 0) {
      runtime.dispatch([appIds.events.BASE_LAYOUT_DELETE_SELECTED_BUILDING]);
      return;
    }

    if (selectedConnectionIds.length > 0) {
      runtime.dispatch([appIds.events.BASE_LAYOUT_DELETE_SELECTED_CONNECTION]);
    }
  };

  const hasSelection =
    selectedBuildingIds.length > 0 || selectedConnectionIds.length > 0;

  const handleSelectDistributionMode = (mode: DistributionMode) => {
    setDistributionDropdownOpen(false);
    if (selectedBaseId) {
      runtime.dispatch([
        appIds.events.BASE_LAYOUT_SET_ALL_BUILDINGS_DISTRIBUTION_MODE,
        selectedBaseId,
        mode,
      ]);
    }
  };

  const toolBtnClass = (isActive: boolean, isDisabled?: boolean) =>
    `btn btn-square btn-sm border-2 transition-all ${
      isActive
        ? "bg-primary/20 border-primary text-primary shadow-md"
        : isDisabled
          ? "border-base-300 opacity-40 cursor-not-allowed"
          : "border-base-300 opacity-70 hover:opacity-100 hover:border-primary/50"
    }`;

  const activeDistributionInfo =
    distributionModes.find((d) => d.mode === activeDistributionMode) ??
    distributionModes[0];
  const activeTransferInfo =
    transferModes.find((t) => t.mode === transferMode) ?? transferModes[0];

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-wrap gap-2 items-center">
        {/* Transfer Mode Dropdown */}
        <div className="relative" ref={transferDropdownRef}>
          <button
            onClick={() =>
              selectedBaseId && setTransferDropdownOpen((open) => !open)
            }
            disabled={!selectedBaseId}
            className={`${toolBtnClass(transferDropdownOpen, !selectedBaseId)} flex items-center gap-1 !w-auto px-2`}
            title={activeTransferInfo.title}
          >
            <span className="text-xs font-semibold">
              {activeTransferInfo.label}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`w-3 h-3 transition-transform ${transferDropdownOpen ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {transferDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-base-200 border border-base-300 rounded-lg shadow-xl p-1 flex flex-col gap-1 min-w-[150px]">
              {transferModes.map((info) => {
                const isSelected = info.mode === transferMode;
                return (
                  <button
                    key={info.mode}
                    onClick={() => {
                      setTransferDropdownOpen(false);
                      runtime.dispatch([
                        appIds.events.BASE_LAYOUT_SET_TRANSFER_MODE,
                        info.mode,
                      ]);
                    }}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all w-full text-left ${
                      isSelected
                        ? "bg-primary/20 text-primary font-semibold"
                        : "hover:bg-base-300 opacity-80 hover:opacity-100"
                    }`}
                    title={info.title}
                  >
                    <span>{info.label}</span>
                    {isSelected && (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-3.5 h-3.5 ml-auto shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Select mode indicator — pan is always the default drag; Ctrl+drag box-selects */}
        <button
          className={toolBtnClass(!connectorMode)}
          title="Select mode — drag to pan · Ctrl+drag to box-select · click to select items"
          onClick={() =>
            runtime.dispatch([
              appIds.events.BASE_LAYOUT_SET_CONNECTOR_MODE,
              null,
            ])
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M4 2l12 9.5-5.1 1.2L15.5 22l-3.1 1.3L7.8 14 4 18V2z" />
          </svg>
        </button>

        {/* Rail Tier Dropdown — hidden in virtual mode */}
        {!isVirtual && (
          <div className="relative" ref={railDropdownRef}>
            <button
              onClick={() => setRailDropdownOpen((o) => !o)}
              className={`${toolBtnClass(connectorMode !== null || railDropdownOpen)} flex items-center gap-1 !w-auto px-2`}
              title={
                selectedConnectionIds.length > 0
                  ? `Convert selected connection(s) — current: ${railTiers.find((r) => r.tier === selectedRailTier)?.name}`
                  : `Rail tier — current: ${railTiers.find((r) => r.tier === selectedRailTier)?.name}`
              }
            >
              {railTiers.find((r) => r.tier === selectedRailTier)?.icon}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-3 h-3 transition-transform ${railDropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {railDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-base-200 border border-base-300 rounded-lg shadow-xl p-1 flex flex-col gap-1 min-w-[160px]">
                {railTiers.map(({ tier, name, capacity, icon }) => {
                  const isSelected = tier === selectedRailTier;
                  return (
                    <button
                      key={tier}
                      onClick={() => handleSelectRailTier(tier)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all w-full text-left ${
                        isSelected
                          ? "bg-primary/20 text-primary font-semibold"
                          : "hover:bg-base-300 opacity-80 hover:opacity-100"
                      }`}
                      title={
                        selectedConnectionIds.length > 0
                          ? `Convert selected connection(s) to ${name} (${capacity}/min)`
                          : `${name} — ${capacity}/min capacity`
                      }
                    >
                      {icon}
                      <span>{name}</span>
                      <span className="text-xs opacity-60 ml-auto">
                        {capacity}/min
                      </span>
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5 shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Distribution Mode Dropdown — hidden in virtual mode */}
        {!isVirtual && (
          <div className="relative" ref={distributionDropdownRef}>
            {/* Trigger button — shows the active mode's icon */}
            <button
              onClick={() => setDistributionDropdownOpen((o) => !o)}
              disabled={!selectedBaseId}
              className={`${toolBtnClass(distributionDropdownOpen, !selectedBaseId)} flex items-center gap-1 !w-auto px-2`}
              title={`Distribution: ${activeDistributionInfo.label} — click to change`}
            >
              {activeDistributionInfo.icon}
              {/* Chevron indicator */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-3 h-3 transition-transform ${distributionDropdownOpen ? "rotate-180" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Dropdown panel */}
            {distributionDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-base-200 border border-base-300 rounded-lg shadow-xl p-1 flex flex-col gap-1 min-w-[160px]">
                {distributionModes.map((info) => {
                  const isSelected = info.mode === activeDistributionMode;
                  return (
                    <button
                      key={info.mode}
                      onClick={() => handleSelectDistributionMode(info.mode)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all w-full text-left ${
                        isSelected
                          ? "bg-primary/20 text-primary font-semibold"
                          : "hover:bg-base-300 opacity-80 hover:opacity-100"
                      }`}
                      title={info.title}
                    >
                      {info.icon}
                      <span>{info.label}</span>
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-3.5 h-3.5 ml-auto shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Delete Tool */}
        <button
          onClick={handleDeleteSelected}
          disabled={!hasSelection}
          className={toolBtnClass(false, !hasSelection)}
          title={
            selectedBuildingIds.length > 0
              ? "Delete selected buildings"
              : selectedConnectionIds.length > 0
                ? "Delete selected connections"
                : "Select a building or connection first"
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default ToolsPalette;
