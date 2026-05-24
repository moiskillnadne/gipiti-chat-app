"use client";

import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { ModelBadge } from "@/components/model-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/billing/money";
import { useTranslations } from "@/lib/i18n/translate";
import { fetcher } from "@/lib/utils";

type TransactionType =
  | "welcome"
  | "subscription_renewal"
  | "subscription_purchase"
  | "topup_purchase"
  | "usage_debit"
  | "refund"
  | "adjustment";

type Transaction = {
  id: string;
  type: TransactionType;
  pool: "subscription" | "topup";
  currencyCode: string;
  amount: number;
  createdAt: string;
  modelId: string | null;
  chatTitle: string | null;
  description: string | null;
};

type TransactionsApiResponse = {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const BADGE_CLASS_BY_TYPE: Record<TransactionType, string> = {
  welcome: "bg-green-100 text-green-800",
  subscription_renewal: "bg-green-100 text-green-800",
  subscription_purchase: "bg-green-100 text-green-800",
  topup_purchase: "bg-green-100 text-green-800",
  usage_debit: "bg-red-100 text-red-800",
  refund: "bg-blue-100 text-blue-800",
  adjustment: "",
};

export function TokenHistoryTable() {
  const t = useTranslations("auth.subscription.history");
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;

  const { data, isLoading } = useSWR<TransactionsApiResponse>(
    `/api/transactions?limit=${PAGE_SIZE}&offset=${offset}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return <TableSkeleton />;
  }

  const transactions = data?.transactions ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getTypeBadge = (type: TransactionType) => {
    const className = BADGE_CLASS_BY_TYPE[type];
    if (type === "adjustment") {
      return <Badge variant="outline">{t(`types.${type}`)}</Badge>;
    }
    return <Badge className={className}>{t(`types.${type}`)}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">
                {t("columns.date")}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {t("columns.type")}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {t("columns.model")}
              </th>
              <th className="px-4 py-3 text-left font-medium">
                {t("columns.chat")}
              </th>
              <th className="px-4 py-3 text-right font-medium">
                {t("columns.amount")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.length === 0 ? (
              <tr>
                <td
                  className="px-4 py-8 text-center text-muted-foreground"
                  colSpan={5}
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr className="hover:bg-muted/30" key={tx.id}>
                  <td className="whitespace-nowrap px-4 py-3">
                    {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3">{getTypeBadge(tx.type)}</td>
                  <td className="px-4 py-3">
                    {tx.modelId ? (
                      <ModelBadge modelId={tx.modelId} />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3">
                    {tx.chatTitle || tx.description || "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    <span
                      className={
                        tx.amount > 0 ? "text-green-600" : "text-red-600"
                      }
                    >
                      {tx.amount > 0 ? "+" : "-"}
                      {formatCurrency(Math.abs(tx.amount), tx.currencyCode)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {t("pagination.showing", {
              start: offset + 1,
              end: Math.min(offset + PAGE_SIZE, total),
              total,
            })}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              size="sm"
              variant="outline"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              disabled={!data?.hasMore}
              onClick={() => setPage((p) => p + 1)}
              size="sm"
              variant="outline"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <div className="bg-muted/50 px-4 py-3">
          <div className="flex gap-8">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div className="border-t px-4 py-3" key={i}>
            <div className="flex gap-8">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
