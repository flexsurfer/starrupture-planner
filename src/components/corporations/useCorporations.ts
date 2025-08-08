import { useState, useEffect } from "react";
import { useSubscription } from "@flexsurfer/reflex";
import { SUB_IDS } from "../../state/sub-ids";
import type { Corporation, Item, Level } from "../../state/db";

export type CorporationWithStats = Corporation & {
  stats: {
    totalLevels: number;
    totalComponents: number;
    totalCost: number;
  };
};

export const useCorporations = () => {
  const corporationsWithStats = useSubscription<CorporationWithStats[]>([SUB_IDS.CORPORATIONS_WITH_STATS]);
  const itemsMap = useSubscription<Record<string, Item>>([SUB_IDS.ITEMS_MAP]);
  const levelsMap = useSubscription<Record<number, Level>>([SUB_IDS.LEVELS_MAP]);

  return {
    corporationsWithStats,
    itemsMap,
    levelsMap,
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
