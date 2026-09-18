import { appIds } from "@/app/uklad/catalog";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSubscription } from "@/app/uklad/bindings";
import type { Base } from "@/app/uklad/model";
import type { MyBasesStats as MyBasesStatsType } from "@/features/bases/types";
import {
  calculateTopProducedItems,
  shareBasesStats,
} from "../utils/baseStatsShare";

interface ShareBasesStatsButtonProps {
  stats: MyBasesStatsType;
  bases: Base[];
  className?: string;
}

type ShareButtonState =
  "idle" | "sharing" | "shared" | "copied" | "downloaded" | "failed";

const STATUS_RESET_DELAY_MS = 4000;

const getButtonLabel = (
  state: ShareButtonState,
): { desktop: string; mobile: string; title: string; className: string } => {
  switch (state) {
    case "sharing":
      return {
        desktop: "Preparing...",
        mobile: "...",
        title: "Generating your share card.",
        className: "btn-ghost text-base-content/65",
      };
    case "shared":
      return {
        desktop: "Shared",
        mobile: "Shared",
        title: "Shared via your device share dialog.",
        className: "btn-success",
      };
    case "copied":
      return {
        desktop: "Copied",
        mobile: "Copied",
        title: "Card copied. Paste it in Discord (Ctrl+V).",
        className: "btn-success",
      };
    case "downloaded":
      return {
        desktop: "Downloaded Card",
        mobile: "Saved",
        title: "Card downloaded. Upload it in Discord.",
        className: "btn-accent",
      };
    case "failed":
      return {
        desktop: "Share Failed",
        mobile: "Failed",
        title: "Sharing failed. Try again.",
        className: "btn-error",
      };
    default:
      return {
        desktop: "Share",
        mobile: "Share",
        title: "Generate a stats card and share it in Discord.",
        className: "btn-ghost text-base-content/65",
      };
  }
};

export const ShareBasesStatsButton: React.FC<ShareBasesStatsButtonProps> = ({
  stats,
  bases,
  className,
}) => {
  const [state, setState] = useState<ShareButtonState>("idle");
  const resetTimerRef = useRef<number | null>(null);
  const isSharingRef = useRef(false);
  const lastShareStartRef = useRef(0);
  const itemsById = useSubscription([appIds.subscriptions.ITEMS_BY_ID_MAP]);
  const corporations = useSubscription([
    appIds.subscriptions.CORPORATIONS_LIST,
  ]);

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(() => {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      setState("idle");
      resetTimerRef.current = null;
    }, STATUS_RESET_DELAY_MS);
  }, [clearResetTimer]);

  useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, [clearResetTimer]);

  const onShare = useCallback(async () => {
    const now = Date.now();
    if (bases.length === 0) return;
    if (state === "sharing" || isSharingRef.current) return;
    // Guard against double-click / duplicate event firing within the same second.
    if (now - lastShareStartRef.current < 1000) return;

    isSharingRef.current = true;
    lastShareStartRef.current = now;
    setState("sharing");
    try {
      const topProducedItems = calculateTopProducedItems(
        bases,
        itemsById,
        corporations,
        4,
      );
      const result = await shareBasesStats(stats, bases, topProducedItems);
      if (result === "cancelled") {
        setState("idle");
        return;
      }
      if (result === "shared") setState("shared");
      if (result === "copied") setState("copied");
      if (result === "downloaded") setState("downloaded");
      scheduleReset();
    } catch (error) {
      console.error("Failed to share bases stats:", error);
      setState("failed");
      scheduleReset();
    } finally {
      isSharingRef.current = false;
    }
  }, [bases, corporations, itemsById, scheduleReset, state, stats]);

  const buttonInfo = getButtonLabel(state);

  return (
    <button
      type="button"
      aria-label={buttonInfo.desktop}
      className={`btn btn-sm size-8 min-h-8 shrink-0 p-0 ${buttonInfo.className} ${className ?? ""}`}
      onClick={onShare}
      title={buttonInfo.title}
      disabled={bases.length === 0 || state === "sharing"}
    >
      {state === "sharing" ? (
        <span
          aria-hidden="true"
          className="loading loading-spinner loading-xs"
        />
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="size-4"
        >
          {state === "failed" ? (
            <path strokeLinecap="round" d="m6 6 12 12M6 18 18 6" />
          ) : state !== "idle" ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m5 12 4 4L19 6"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16V3m-4 4 4-4 4 4M5 13v7h14v-7"
            />
          )}
        </svg>
      )}
      <span className="sr-only" role="status">
        {state !== "idle" ? buttonInfo.title : ""}
      </span>
    </button>
  );
};
