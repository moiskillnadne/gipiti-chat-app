"use client";

import { X } from "lucide-react";
import Link from "next/link";
import type { SpendThreshold } from "@/hooks/use-spend-banner";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

const WARN_THRESHOLD: SpendThreshold = 75;

type BalanceSpendBannerProps = {
  percent: number;
  threshold: SpendThreshold;
  onDismiss: () => void;
};

/**
 * Unobtrusive notice seam-joined to the top edge of the composer (design
 * variant C). Neutral citrus tint at 50%, warning amber at 75%. Presentational
 * only — visibility, thresholds, and dismissal live in `useSpendBanner`.
 */
export const BalanceSpendBanner = ({
  percent,
  threshold,
  onDismiss,
}: BalanceSpendBannerProps) => {
  const t = useTranslations("chat.spendBanner");
  const isWarning = threshold >= WARN_THRESHOLD;

  return (
    <output
      className={cn(
        "flex items-center gap-3 rounded-t-[20px] border border-rule border-b-0 px-4 py-3",
        isWarning ? "bg-warn-soft" : "bg-citrus-soft"
      )}
    >
      <span
        className={cn(
          "inline-flex shrink-0 items-center rounded-[6px] px-[9px] py-[5px] font-mono font-semibold text-[13px] tabular-nums tracking-[-0.02em]",
          isWarning ? "bg-warn text-paper" : "bg-citrus text-ink"
        )}
      >
        {percent}%
      </span>

      <span className="min-w-0 flex-1 text-[13.5px] text-ink-2 leading-snug">
        {t("caption")}
      </span>

      <Link
        className="shrink-0 whitespace-nowrap font-medium text-[13.5px] text-ink underline decoration-rule-strong underline-offset-[3px] transition-colors duration-fast ease-canon hover:decoration-ink"
        href="/subscription"
      >
        {t("cta")}
      </Link>

      <button
        aria-label={t("close")}
        className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-[6px] text-ink-3 transition-colors duration-fast ease-canon hover:bg-paper-3 hover:text-ink"
        onClick={onDismiss}
        type="button"
      >
        <X size={14} strokeWidth={2.2} />
      </button>
    </output>
  );
};
