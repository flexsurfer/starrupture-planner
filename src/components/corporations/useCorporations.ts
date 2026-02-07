import { useState, useEffect } from "react";
import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../state/sub-ids";
import type { Item } from "../../state/db";
import type { CorporationWithStats } from "./types";

export const useCorporations = () => {
  const corporationsWithStats = useSubscription<CorporationWithStats[]>([SUB_IDS.CORPORATIONS_LIST_WITH_STATS]);
  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_BY_ID]);

  return {
    corporationsWithStats,
    itemsMap,
  };
};

export const useCorporationCollapse = (corporationsWithStats: CorporationWithStats[]) => {
  // Track collapsed state for each corporation (collapsed by default)
  const [collapsedCorporations, setCollapsedCorporations] = useState<Set<string>>(new Set());

  // Initialize collapsed state when corporations load
  useEffect(() => {
    if (corporationsWithStats.length > 0 && collapsedCorporations.size === 0) {
      setCollapsedCorporations(new Set(corporationsWithStats.map(corporation => corporation.name)));
    }
  }, [corporationsWithStats, collapsedCorporations.size]);

  const toggleCorporation = (corporationName: string) => {
    const newCollapsed = new Set(collapsedCorporations);
    if (newCollapsed.has(corporationName)) {
      newCollapsed.delete(corporationName);
    } else {
      newCollapsed.add(corporationName);
    }
    setCollapsedCorporations(newCollapsed);
  };

  return {
    collapsedCorporations,
    toggleCorporation,
  };
};
