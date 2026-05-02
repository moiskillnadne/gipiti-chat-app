"use client";

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

export function FreeQuotaStrip() {
  const t = useTranslations("auth.subscription.dashboard.freeQuota");
  const { data } = useSWR<UsageLimitsResponse>("/api/usage-limits", fetcher, {
    revalidateOnFocus: false,
  });

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

  return (
    <div className={styles.freeQuota}>
      <div className={styles.freeQuotaLhs}>
        <div className={styles.freeQuotaLbl}>{t("label")}</div>
        <div className={styles.freeQuotaValue}>
          {used} <em>{suffix}</em>
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
