"use client";

import { InfoIcon } from "lucide-react";
import useSWR from "swr";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslations } from "@/lib/i18n/translate";
import { cn, fetcher } from "@/lib/utils";

type UsageApiResponse = {
  balance?: {
    currencyCode?: string | null;
    total?: number | null;
    formatted?: string | null;
  } | null;
};

type UsageHintProps = {
  className?: string;
};

// Minor-unit thresholds for the low-balance warning. Currency-agnostic and
// intentionally coarse — exact pricing is per-request, so this only nudges the
// user to top up before they run dry.
const EXCEEDED_THRESHOLD = 0;
const CRITICAL_THRESHOLD = 5000;
const WARNING_THRESHOLD = 20_000;

type BalanceState = "normal" | "warning" | "critical" | "exceeded";

const getBalanceState = (total: number): BalanceState => {
  if (total <= EXCEEDED_THRESHOLD) {
    return "exceeded";
  }
  if (total <= CRITICAL_THRESHOLD) {
    return "critical";
  }
  if (total <= WARNING_THRESHOLD) {
    return "warning";
  }
  return "normal";
};

const getStateColor = (state: BalanceState): string => {
  switch (state) {
    case "exceeded":
      return "text-destructive";
    case "critical":
      return "text-orange-600";
    case "warning":
      return "text-yellow-600";
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

export const UsageHint = ({ className }: UsageHintProps) => {
  const { data } = useSWR<UsageApiResponse>("/api/usage", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    shouldRetryOnError: false,
  });

  const t = useTranslations("usage");

  const total = data?.balance?.total ?? null;
  const formatted = data?.balance?.formatted ?? null;

  if (total === null) {
    return null;
  }

  const balanceState = getBalanceState(total);
  const colorClass = getStateColor(balanceState);
  const balanceLabel = formatted ?? String(total);

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
          <span>{t("tooltip.balance", { balance: balanceLabel })}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-4">
        {balanceState !== "normal" && (
          <div
            className={cn(
              "rounded-md p-2 text-xs",
              balanceState === "exceeded" &&
                "bg-destructive/10 text-destructive",
              balanceState === "critical" && "bg-orange-100 text-orange-900",
              balanceState === "warning" && "bg-yellow-100 text-yellow-900"
            )}
          >
            {t(`warning.${balanceState}`)}
          </div>
        )}

        <div className="space-y-1">
          <InfoRow label={t("balance")} value={balanceLabel} />
        </div>

        {balanceState === "exceeded" && (
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
