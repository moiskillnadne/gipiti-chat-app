"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { useTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import { fetcher } from "@/lib/utils";
import styles from "./dashboard.module.css";
import { ImageIcon, SearchIcon, VideoIcon } from "./icons";

type UsageLimitItem = {
  used: number;
  limit: number | null;
};

type UsageLimitsResponse = {
  webSearch: UsageLimitItem;
  imageGeneration: UsageLimitItem;
  videoGeneration: UsageLimitItem;
};

const PAST_DUE_ZEROED_KEYS = new Set(["webSearch"]);

type LimitKey = "webSearch" | "imageGeneration" | "videoGeneration";

export type FreeLimitBonus = {
  webSearch: number | null;
  imageGeneration: number | null;
  videoGeneration: "static" | null;
};

type PeriodLimitsCardProps = {
  state: SubscriptionUiState;
  dimmed?: boolean;
  freeBonuses?: FreeLimitBonus | null;
};

function applyPastDueClamp(
  key: string,
  state: SubscriptionUiState,
  item: UsageLimitItem | undefined
): UsageLimitItem | undefined {
  if (state !== "past_due" || !item || !PAST_DUE_ZEROED_KEYS.has(key)) {
    return item;
  }
  return { used: 0, limit: item.limit };
}

export function PeriodLimitsCard({
  state,
  dimmed = false,
  freeBonuses = null,
}: PeriodLimitsCardProps) {
  const t = useTranslations("auth.subscription.dashboard.limits");
  const { data } = useSWR<UsageLimitsResponse>("/api/usage-limits", fetcher, {
    revalidateOnFocus: false,
  });

  const cardClass = [styles.card, dimmed ? styles.cardDimmed : ""]
    .filter(Boolean)
    .join(" ");

  const title = state === "none" ? t("titleFree") : t("title");

  const rows: Array<{
    key: LimitKey;
    icon: ReactNode;
    label: string;
    item: UsageLimitItem | undefined;
    bonus: string | null;
  }> = [
    {
      key: "webSearch",
      icon: <SearchIcon aria-label={t("webSearch")} />,
      label: t("webSearch"),
      item: applyPastDueClamp("webSearch", state, data?.webSearch),
      bonus:
        freeBonuses?.webSearch != null && freeBonuses.webSearch > 0
          ? t("bonus.webSearch", { amount: freeBonuses.webSearch })
          : null,
    },
    {
      key: "imageGeneration",
      icon: <ImageIcon aria-label={t("imageGeneration")} />,
      label: t("imageGeneration"),
      item: data?.imageGeneration,
      bonus:
        freeBonuses?.imageGeneration != null && freeBonuses.imageGeneration > 0
          ? t("bonus.imageGeneration", { amount: freeBonuses.imageGeneration })
          : null,
    },
    {
      key: "videoGeneration",
      icon: <VideoIcon aria-label={t("videoGeneration")} />,
      label: t("videoGeneration"),
      item: data?.videoGeneration,
      bonus:
        freeBonuses?.videoGeneration === "static"
          ? t("bonus.videoGeneration")
          : null,
    },
  ];

  return (
    <section aria-label={title} className={cardClass}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>
      <div className={styles.limits}>
        {rows.map((row) => (
          <LimitRow
            bonus={row.bonus}
            icon={row.icon}
            item={row.item}
            key={row.key}
            label={row.label}
            unlimitedLabel={t("unlimited")}
          />
        ))}
      </div>
    </section>
  );
}

type LimitRowProps = {
  icon: ReactNode;
  label: string;
  item: UsageLimitItem | undefined;
  unlimitedLabel: string;
  bonus: string | null;
};

function LimitRow({ icon, label, item, unlimitedLabel, bonus }: LimitRowProps) {
  const used = item?.used ?? 0;
  const limit = item?.limit ?? null;
  const isUnlimited = limit === null;
  const pct =
    !isUnlimited && limit !== null && limit > 0
      ? Math.min(100, (used / limit) * 100)
      : 0;
  const meterClass = pickMeterClass(pct);

  return (
    <div className={styles.limitRow}>
      <span className={styles.limitIcon}>{icon}</span>
      <div className={styles.limitMid}>
        <div className={styles.limitName}>
          <span className={styles.limitNameLabel}>
            {label}
            {bonus && <span className={styles.limitNameBonus}> {bonus}</span>}
          </span>
          <span className={styles.limitNameRight}>
            <b>{used}</b> / {isUnlimited ? unlimitedLabel : limit}
          </span>
        </div>
        <div className={meterClass}>
          <div className={styles.meterFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function pickMeterClass(pct: number): string {
  if (pct >= 80) {
    return `${styles.meter} ${styles.meterDanger}`;
  }
  if (pct >= 50) {
    return `${styles.meter} ${styles.meterWarn}`;
  }
  return styles.meter;
}
