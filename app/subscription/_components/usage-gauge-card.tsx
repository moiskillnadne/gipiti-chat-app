"use client";

import Link from "next/link";
import useSWR from "swr";
import { useTranslations } from "@/lib/i18n/translate";
import type { SubscriptionUiState } from "@/lib/subscription/subscription-state";
import { fetcher } from "@/lib/utils";
import styles from "./dashboard.module.css";

type TokenAmountParts = {
  num: string;
  unit: "" | "K" | "M";
};

const TRAILING_ZERO_FRACTION = /\.0$/;

function splitTokenAmount(tokens: number): TokenAmountParts {
  if (tokens >= 1_000_000) {
    return {
      num: (tokens / 1_000_000).toFixed(1).replace(TRAILING_ZERO_FRACTION, ""),
      unit: "M",
    };
  }
  if (tokens >= 1000) {
    const k = Math.round(tokens / 1000);
    return { num: k.toLocaleString("ru-RU"), unit: "K" };
  }
  return { num: tokens.toLocaleString("ru-RU"), unit: "" };
}

type UsageSummary = {
  quota: number;
  balance: number;
  spent: number;
  remaining: number;
};

type TransactionsApiResponse = {
  summary: UsageSummary | null;
};

const GAUGE_RADIUS = 76;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

type GaugeVariant = "default" | "trial" | "warn" | "danger" | "cancelled";

const VARIANT_FILL_CLASS: Record<GaugeVariant, string> = {
  default: "",
  trial: styles.gaugeFillTrial,
  warn: styles.gaugeFillWarn,
  danger: styles.gaugeFillDanger,
  cancelled: styles.gaugeFillCancelled,
};

function pickVariant(state: SubscriptionUiState, pct: number): GaugeVariant {
  if (state === "trial") {
    return "trial";
  }
  if (state === "cancelled") {
    return "cancelled";
  }
  if (state === "past_due") {
    return "danger";
  }
  if (pct >= 80) {
    return "warn";
  }
  return "default";
}

function pickRemainingHintKey(
  state: SubscriptionUiState
): "default" | "trial" | "cancelled" {
  if (state === "trial") {
    return "trial";
  }
  if (state === "cancelled") {
    return "cancelled";
  }
  return "default";
}

type UsageGaugeCardProps = {
  state: SubscriptionUiState;
  dimmed?: boolean;
};

export function UsageGaugeCard({ state, dimmed = false }: UsageGaugeCardProps) {
  const t = useTranslations("auth.subscription.dashboard.gauge");
  const tHistory = useTranslations("auth.subscription.dashboard");
  const { data } = useSWR<TransactionsApiResponse>(
    "/api/transactions?limit=0",
    fetcher,
    { revalidateOnFocus: false }
  );

  const summary = data?.summary;
  const quota = summary?.quota ?? 0;
  const spent = summary?.spent ?? 0;
  const remaining = summary?.remaining ?? Math.max(0, quota - spent);
  const pct = quota > 0 ? Math.min(100, Math.round((spent / quota) * 100)) : 0;
  const variant = pickVariant(state, pct);
  const dash = (Math.min(pct, 100) / 100) * GAUGE_CIRCUMFERENCE;
  const cardClass = [
    styles.card,
    styles.cardSpan2,
    dimmed ? styles.cardDimmed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-label={t("title")} className={cardClass}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{t("title")}</h3>
        <Link className={styles.cardLink} href="/subscription/usage">
          {tHistory("history")} →
        </Link>
      </div>
      <div className={styles.gaugeWrap}>
        <div className={styles.gauge}>
          <svg viewBox="0 0 180 180">
            <title>{t("title")}</title>
            <circle
              className={styles.gaugeTrack}
              cx={90}
              cy={90}
              r={GAUGE_RADIUS}
            />
            <circle
              className={`${styles.gaugeFill} ${VARIANT_FILL_CLASS[variant]}`}
              cx={90}
              cy={90}
              r={GAUGE_RADIUS}
              strokeDasharray={`${dash.toFixed(1)} ${(GAUGE_CIRCUMFERENCE - dash).toFixed(1)}`}
            />
          </svg>
          <div className={styles.gaugeCenter}>
            <div className={styles.gaugePct}>
              {pct}
              <span className={styles.gaugePctSym}>%</span>
            </div>
            <div className={styles.gaugeCenterLbl}>{t("lbl")}</div>
          </div>
        </div>
        <div className={styles.gaugeStats}>
          {(() => {
            const quotaParts = splitTokenAmount(quota);
            const spentParts = splitTokenAmount(spent);
            const remainingParts = splitTokenAmount(Math.max(0, remaining));
            return (
              <>
                <div className={styles.gaugeStat}>
                  <span className={styles.gaugeStatLbl}>{t("quota")}</span>
                  <span className={styles.gaugeStatVal}>
                    {quotaParts.num}
                    <span className={styles.gaugeStatSub}>
                      {quotaParts.unit} {t("tokensWord")}
                    </span>
                  </span>
                </div>
                <div className={styles.gaugeStat}>
                  <span className={styles.gaugeStatLbl}>{t("spent")}</span>
                  <span className={styles.gaugeStatVal}>
                    {spentParts.num}
                    <span className={styles.gaugeStatSub}>
                      {spentParts.unit} · {pct}%
                    </span>
                  </span>
                </div>
                <div className={styles.gaugeStat}>
                  <span className={styles.gaugeStatLbl}>{t("remaining")}</span>
                  <span className={styles.gaugeStatVal}>
                    {remainingParts.num}
                    <span className={styles.gaugeStatSub}>
                      {remainingParts.unit} ·{" "}
                      {t(`remainingHint.${pickRemainingHintKey(state)}`)}
                    </span>
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </section>
  );
}
