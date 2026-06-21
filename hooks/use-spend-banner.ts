"use client";

import { useCallback, useEffect } from "react";
import useSWR from "swr";
import { useLocalStorage } from "usehooks-ts";
import { fetcher } from "@/lib/utils";

const NOTICE_THRESHOLD = 50;
const WARN_THRESHOLD = 75;

export type SpendThreshold = typeof NOTICE_THRESHOLD | typeof WARN_THRESHOLD;

// Subset of /api/usage consumed by the banner. Shares the SWR key with
// `UsageHint`, so both read from a single request/cache entry.
type SpendApiResponse = {
  spend?: {
    spentPercent?: number | null;
    epochKey?: string | null;
  } | null;
};

// Per-browser memory of which thresholds the user has dismissed, scoped to the
// current balance "epoch". When a fresh credit lands the epoch changes and the
// dismissed set is cleared, re-arming both thresholds.
type DismissState = {
  epoch: string;
  dismissed: number[];
};

const INITIAL_DISMISS_STATE: DismissState = { epoch: "", dismissed: [] };

const DISMISS_STORAGE_KEY = "spend-banner-dismissed";

export type SpendBanner = {
  isVisible: boolean;
  threshold: SpendThreshold | null;
  percent: number;
  dismiss: () => void;
};

const resolveThreshold = (percent: number): SpendThreshold | null => {
  if (percent >= WARN_THRESHOLD) {
    return WARN_THRESHOLD;
  }
  if (percent >= NOTICE_THRESHOLD) {
    return NOTICE_THRESHOLD;
  }
  return null;
};

/**
 * Drives the spend banner above the composer: reads the user's spend progress
 * (% of balance burned since the last credit) and tracks per-threshold dismissal
 * in localStorage. Each of the 50% / 75% thresholds shows once until dismissed,
 * and both re-arm automatically after a top-up/renewal (new epoch).
 */
export const useSpendBanner = (): SpendBanner => {
  const { data } = useSWR<SpendApiResponse>("/api/usage", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  const [dismissState, setDismissState] = useLocalStorage<DismissState>(
    DISMISS_STORAGE_KEY,
    INITIAL_DISMISS_STATE
  );

  const percent = data?.spend?.spentPercent ?? 0;
  const epochKey = data?.spend?.epochKey ?? null;

  // A fresh credit (top-up / renewal / bonus) starts a new epoch — reset the
  // dismissed set so the banner can surface again.
  useEffect(() => {
    if (epochKey && epochKey !== dismissState.epoch) {
      setDismissState({ epoch: epochKey, dismissed: [] });
    }
  }, [epochKey, dismissState.epoch, setDismissState]);

  const threshold = resolveThreshold(percent);
  const isDismissed =
    threshold !== null &&
    epochKey === dismissState.epoch &&
    dismissState.dismissed.includes(threshold);
  const isVisible = threshold !== null && !isDismissed;

  const dismiss = useCallback(() => {
    if (threshold === null || !epochKey) {
      return;
    }
    setDismissState((previous) => {
      const base =
        previous.epoch === epochKey
          ? previous
          : { epoch: epochKey, dismissed: [] };
      if (base.dismissed.includes(threshold)) {
        return base;
      }
      return { epoch: epochKey, dismissed: [...base.dismissed, threshold] };
    });
  }, [threshold, epochKey, setDismissState]);

  return { isVisible, threshold, percent, dismiss };
};
