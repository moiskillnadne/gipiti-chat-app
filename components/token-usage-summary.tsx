"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatTokenBalance } from "@/lib/format-tokens";
import { fetcher } from "@/lib/utils";

type UsageSummary = {
  quota: number;
  balance: number;
  spent: number;
  remaining: number;
};

type TransactionsApiResponse = {
  summary: UsageSummary | null;
};

type TokenUsageSummaryProps = {
  showHistoryButton?: boolean;
};

export function TokenUsageSummary({
  showHistoryButton = true,
}: TokenUsageSummaryProps) {
  const t = useTranslations("auth.subscription.usage");
  const { data, isLoading } = useSWR<TransactionsApiResponse>(
    "/api/transactions?limit=0",
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  if (isLoading) {
    return <TokenUsageSummarySkeleton />;
  }

  const summary = data?.summary;
  if (!summary) {
    return null;
  }

  const percentUsed =
    summary.quota > 0 ? (summary.spent / summary.quota) * 100 : 0;

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Progress className="h-3" value={percentUsed} />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t("quota")}
            </p>
            <p className="font-semibold text-lg">
              {formatTokenBalance(summary.quota)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t("spent")}
            </p>
            <p className="font-semibold text-lg">
              {formatTokenBalance(summary.spent, { maxUnit: "K" })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-muted-foreground text-sm">
              {t("remaining")}
            </p>
            <p className="font-semibold text-lg">
              {formatTokenBalance(summary.remaining, { maxUnit: "K" })}
            </p>
          </div>
        </div>

        {showHistoryButton && (
          <Link href="/subscription/usage">
            <Button className="w-full gap-2" variant="outline">
              {t("seeFullHistory")}
              <ExternalLinkIcon className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

function TokenUsageSummarySkeleton() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-2 h-4 w-48" />
      </CardHeader>
      <CardContent className="space-y-6">
        <Skeleton className="h-3 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div className="space-y-1" key={i}>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
