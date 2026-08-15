import { useMemo, useState } from "react";
import { useSubscription } from "@/app/uklad/bindings";
import { appIds } from "@/app/uklad/catalog";
import type { CorporationWithStats } from "./types";

export const useCorporations = () => {
  const corporationsWithStats = useSubscription([appIds.subscriptions.CORPORATIONS_LIST_WITH_STATS]);
  const itemsMap = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);

  return {
    corporationsWithStats,
    itemsMap,
  };
};

export const useCorporationCollapse = (corporationsWithStats: CorporationWithStats[]) => {
  // Track expanded state for each corporation (collapsed by default)
  const [expandedCorporations, setExpandedCorporations] = useState<Set<string>>(new Set());

  const toggleCorporation = (corporationName: string) => {
    const newExpanded = new Set(expandedCorporations);
    if (newExpanded.has(corporationName)) {
      newExpanded.delete(corporationName);
    } else {
      newExpanded.add(corporationName);
    }
    setExpandedCorporations(newExpanded);
  };

  const collapsedCorporations = useMemo(() => {
    const collapsed = new Set<string>();
    for (const corporation of corporationsWithStats) {
      if (!expandedCorporations.has(corporation.name)) {
        collapsed.add(corporation.name);
      }
    }
    return collapsed;
  }, [corporationsWithStats, expandedCorporations]);

  return {
    collapsedCorporations,
    toggleCorporation,
  };
};
