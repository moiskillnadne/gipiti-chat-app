"use client";

import { format, parseISO } from "date-fns";
import { InfoIcon } from "lucide-react";
import useSWR from "swr";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import type { AppUsage } from "@/lib/usage";
import { cn, fetcher } from "@/lib/utils";

interface UsageApiResponse {
  subscription?: {
    periodEnd?: string | null;
  };
  quota?: {
    total?: number | null;
    used?: number | null;
    percentUsed?: string | null;
  };
}

interface UsageHintProps {
  className?: string;
  usage?: AppUsage;
}

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

const formatTokens = (tokens: number) => {
  if (!Number.isFinite(tokens)) {
    return "—";
  }

  return tokens.toLocaleString();
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
  } catch (error) {
    return;
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

  const totalTokens = data?.quota?.total ?? undefined;
  const usedTokens = data?.quota?.used ?? usage?.totalTokens ?? undefined;

  if (
    totalTokens === undefined ||
    totalTokens === null ||
    usedTokens === undefined ||
    usedTokens === null ||
    totalTokens <= 0
  ) {
    return null;
  }

  const percentRaw = data?.quota?.percentUsed
    ? Number.parseFloat(data.quota.percentUsed)
    : percentFromQuota(usedTokens, totalTokens);
  const percent = Number.isFinite(percentRaw) ? Math.min(100, percentRaw) : 0;
  const roundedPercent = Math.round(percent);
  const resetDate = formatReset(data?.subscription?.periodEnd);

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <div
          className={cn(
            "group flex cursor-help items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground",
            className
          )}
          tabIndex={0}
        >
          <InfoIcon
            aria-hidden="true"
            className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-foreground"
            strokeWidth={1.5}
          />
          <span>{`You've used ${roundedPercent}% of your usage limit`}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 space-y-3 p-4">
        <div className="flex items-center justify-between font-medium text-sm">
          <span>{`${formatTokens(usedTokens)} / ${formatTokens(totalTokens)} tokens`}</span>
          <span className="text-muted-foreground">{`${roundedPercent}% used`}</span>
        </div>
        <Progress className="h-2 bg-muted" value={percent} />
        <div className="space-y-1">
          <InfoRow label="Resets" value={resetDate} />
          <InfoRow label="Used tokens" value={formatTokens(usedTokens)} />
          <InfoRow label="Total tokens" value={formatTokens(totalTokens)} />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
