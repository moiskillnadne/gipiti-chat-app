"use client";

import { format, parseISO } from "date-fns";
import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import type { AppUsage } from "@/lib/usage";
import { cn, fetcher } from "@/lib/utils";

type UsageApiResponse = {
  balance?: {
    current?: number | null;
    formatted?: string | null;
    lastResetAt?: string | null;
  };
  subscription?: {
    periodEnd?: string | null;
    tokenQuota?: number | null;
  };
  quota?: {
    total?: number | null;
    used?: number | null;
    percentUsed?: string | null;
  };
};

type UsageHintProps = {
  className?: string;
  usage?: AppUsage;
};

const percentFromQuota = (usedTokens: number, totalTokens: number) => {
  if (
    !Number.isFinite(usedTokens) ||
    !Number.isFinite(totalTokens) ||
    totalTokens <= 0
  ) {
    return 0;
  }

  return Math.min(100, (usedTokens / totalTokens) * 100);
};

const formatReset = (isoDate?: string | null) => {
  if (!isoDate) {
    return;
  }

  try {
    const parsed = parseISO(isoDate);
    if (Number.isNaN(parsed.getTime())) {
      return;
    }

    return format(parsed, "LLL d, yyyy");
  } catch (_error) {
    return;
  }
};

const WARNING_THRESHOLD = 80; // Show warning at 80%
const CRITICAL_THRESHOLD = 95; // Show critical warning at 95%

const getWarningState = (
  percent: number
): "normal" | "warning" | "critical" | "exceeded" => {
  if (percent >= 100) {
    return "exceeded";
  }
  if (percent >= CRITICAL_THRESHOLD) {
    return "critical";
  }
  if (percent >= WARNING_THRESHOLD) {
    return "warning";
  }
  return "normal";
};

const getWarningColor = (state: ReturnType<typeof getWarningState>) => {
  switch (state) {
    case "exceeded":
      return "text-destructive";
    case "critical":
      return "text-orange-600 dark:text-orange-400";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400";
    default:
      return "text-muted-foreground";
  }
};

const InfoRow = ({ label, value }: { label: string; value?: string }) => {
  if (!value) {
    return null;
  }

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
};

export const UsageHint = ({ className, usage }: UsageHintProps) => {
  const { data } = useSWR<UsageApiResponse>("/api/usage", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  const t = useTranslations("usage");

  // Use balance-based system (primary)
  const balance = data?.balance?.current ?? null;
  const tokenQuota = data?.subscription?.tokenQuota ?? data?.quota?.total ?? null;

  // Fallback to old quota system if balance not available
  const totalTokens = tokenQuota ?? undefined;
  const usedTokens = data?.quota?.used ?? usage?.totalTokens ?? undefined;

  // Calculate percentage from balance (for progress bar and warnings)
  const percentFromBalance = (
    currentBalance: number | null,
    quota: number | null
  ): number => {
    if (
      currentBalance === null ||
      quota === null ||
      !Number.isFinite(currentBalance) ||
      !Number.isFinite(quota) ||
      quota <= 0
    ) {
      return 0;
    }
    // Percent USED = (quota - balance) / quota * 100
    const used = quota - currentBalance;
    return Math.min(100, Math.max(0, (used / quota) * 100));
  };

  // If no data available, don't render
  if (balance === null && (totalTokens === undefined || usedTokens === undefined)) {
    return null;
  }

  // Calculate percent used (for warning states and progress bar)
  let percent: number;
  if (balance !== null && tokenQuota !== null) {
    // New balance-based calculation
    percent = percentFromBalance(balance, tokenQuota);
  } else if (data?.quota?.percentUsed) {
    percent = Number.parseFloat(data.quota.percentUsed);
  } else if (usedTokens !== undefined && totalTokens !== undefined && totalTokens > 0) {
    percent = percentFromQuota(usedTokens, totalTokens);
  } else {
    percent = 0;
  }

  percent = Number.isFinite(percent) ? Math.min(100, percent) : 0;

  const resetDate = formatReset(data?.subscription?.periodEnd);
  const warningState = getWarningState(percent);
  const colorClass = getWarningColor(warningState);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "group flex cursor-pointer items-center gap-1.5 text-xs transition-colors hover:text-foreground",
            colorClass,
            className
          )}
          type="button"
        >
          <InfoIcon
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 transition-colors group-hover:text-foreground",
              colorClass
            )}
            strokeWidth={1.5}
          />
          <span>
            {t(`tooltip.${warningState}`, { percent: percent.toFixed(1) })}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-4">
        <Progress
          className={cn(
            "h-2",
            warningState === "exceeded" && "bg-destructive/20",
            warningState === "critical" &&
              "bg-orange-200 dark:bg-orange-900/20",
            warningState === "warning" && "bg-yellow-200 dark:bg-yellow-900/20",
            warningState === "normal" && "bg-muted"
          )}
          value={percent}
        />

        {warningState !== "normal" && (
          <div
            className={cn(
              "rounded-md p-2 text-xs",
              warningState === "exceeded" &&
                "bg-destructive/10 text-destructive",
              warningState === "critical" &&
                "bg-orange-100 text-orange-900 dark:bg-orange-900/20 dark:text-orange-300",
              warningState === "warning" &&
                "bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-300"
            )}
          >
            {t(`warning.${warningState}`)}
          </div>
        )}

        <div className="space-y-1">
          <InfoRow label={t("used")} value={`${percent.toFixed(1)}%`} />
          <InfoRow label={t("resetDate")} value={resetDate} />
        </div>

        {warningState === "exceeded" && (
          <button
            className="w-full rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm hover:bg-primary/90"
            onClick={() => {
              window.location.href = "/subscription";
            }}
            type="button"
          >
            {t("upgrade")}
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
};
