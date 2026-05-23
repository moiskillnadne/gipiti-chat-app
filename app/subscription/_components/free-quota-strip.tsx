"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { useTranslations } from "@/lib/i18n/translate";
import { fetcher } from "@/lib/utils";
import styles from "./dashboard.module.css";

type UsageLimitItem = {
  used: number;
  limit: number | null;
};

type UsageLimitsResponse = {
  messages: UsageLimitItem;
};

const MS_PER_HOUR = 1000 * 60 * 60;
const RESET_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function hoursUntilNextMidnight(now: Date): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, Math.ceil((next.getTime() - now.getTime()) / MS_PER_HOUR));
}

export function FreeQuotaStrip() {
  const t = useTranslations("auth.subscription.dashboard.freeQuota");
  const { data } = useSWR<UsageLimitsResponse>("/api/usage-limits", fetcher, {
    revalidateOnFocus: false,
  });
  const [resetHours, setResetHours] = useState<number | null>(null);

  useEffect(() => {
    setResetHours(hoursUntilNextMidnight(new Date()));
    const interval = setInterval(
      () => setResetHours(hoursUntilNextMidnight(new Date())),
      RESET_REFRESH_INTERVAL_MS
    );
    return () => clearInterval(interval);
  }, []);

  const used = data?.messages.used ?? 0;
  const limit = data?.messages.limit ?? null;
  const isUnlimited = limit === null;
  const pct =
    !isUnlimited && limit !== null && limit > 0
      ? Math.min(100, (used / limit) * 100)
      : 0;
  const limitText = isUnlimited ? "∞" : String(limit);

  const suffix = isUnlimited
    ? t("ofUnlimited")
    : t("ofLimit", { limit: limitText });

  const resetHint =
    resetHours === null
      ? null
      : resetHours < 1
        ? t("resetSoon")
        : t("resetIn", { hours: resetHours });

  return (
    <div className={styles.freeQuota}>
      <div className={styles.freeQuotaLhs}>
        <div className={styles.freeQuotaLbl}>{t("label")}</div>
        <div className={styles.freeQuotaValue}>
          {used} <em>{suffix}</em>
          {resetHint && (
            <span className={styles.freeQuotaResetHint}>
              {" · "}
              {resetHint}
            </span>
          )}
        </div>
      </div>
      <div className={styles.freeQuotaMeter}>
        <div
          className={styles.freeQuotaMeterFill}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
