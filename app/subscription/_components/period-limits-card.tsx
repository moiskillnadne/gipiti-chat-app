"use client";

import type { ReactNode } from "react";
import useSWR from "swr";
import { useTranslations } from "@/lib/i18n/translate";
import { fetcher } from "@/lib/utils";
import styles from "./dashboard.module.css";
import { ImageIcon, MessageIcon, SearchIcon, VideoIcon } from "./icons";

type UsageLimitItem = {
  used: number;
  limit: number | null;
};

type UsageLimitsResponse = {
  messages: UsageLimitItem;
  webSearch: UsageLimitItem;
  imageGeneration: UsageLimitItem;
  videoGeneration: UsageLimitItem;
};

type PeriodLimitsCardProps = {
  dimmed?: boolean;
};

export function PeriodLimitsCard({ dimmed = false }: PeriodLimitsCardProps) {
  const t = useTranslations("auth.subscription.dashboard.limits");
  const { data } = useSWR<UsageLimitsResponse>("/api/usage-limits", fetcher, {
    revalidateOnFocus: false,
  });

  const cardClass = [styles.card, dimmed ? styles.cardDimmed : ""]
    .filter(Boolean)
    .join(" ");

  const rows: Array<{
    key: string;
    icon: ReactNode;
    label: string;
    item: UsageLimitItem | undefined;
  }> = [
    {
      key: "messages",
      icon: <MessageIcon aria-label={t("messages")} />,
      label: t("messages"),
      item: data?.messages,
    },
    {
      key: "webSearch",
      icon: <SearchIcon aria-label={t("webSearch")} />,
      label: t("webSearch"),
      item: data?.webSearch,
    },
    {
      key: "imageGeneration",
      icon: <ImageIcon aria-label={t("imageGeneration")} />,
      label: t("imageGeneration"),
      item: data?.imageGeneration,
    },
    {
      key: "videoGeneration",
      icon: <VideoIcon aria-label={t("videoGeneration")} />,
      label: t("videoGeneration"),
      item: data?.videoGeneration,
    },
  ];

  return (
    <section aria-label={t("title")} className={cardClass}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
      </div>
      <div className={styles.limits}>
        {rows.map((row) => (
          <LimitRow
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
};

function LimitRow({ icon, label, item, unlimitedLabel }: LimitRowProps) {
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
          <span className={styles.limitNameLabel}>{label}</span>
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
