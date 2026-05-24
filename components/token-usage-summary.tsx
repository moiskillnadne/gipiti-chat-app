"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/billing/money";
import { useTranslations } from "@/lib/i18n/translate";
import { fetcher } from "@/lib/utils";

type BalanceSummary = {
  balance: number;
  currencyCode: string;
};

type TransactionsApiResponse = {
  summary: BalanceSummary | null;
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

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1">
          <p className="font-medium text-muted-foreground text-sm">
            {t("balance")}
          </p>
          <p className="font-semibold text-3xl">
            {formatCurrency(summary.balance, summary.currencyCode)}
          </p>
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
        <div className="space-y-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}
