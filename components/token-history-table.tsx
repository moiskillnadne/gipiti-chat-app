"use client";

import { useState } from "react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import useSWR from "swr";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/utils";
import { formatTokenBalance } from "@/lib/format-tokens";
import { ModelBadge } from "@/components/model-badge";

interface TransactionMetadata {
  modelId?: string;
  chatId?: string;
}

interface Transaction {
  id: string;
  type: "credit" | "debit" | "reset" | "adjustment";
  amount: number;
  balanceAfter: number;
  createdAt: string;
  chatTitle: string | null;
  description: string | null;
  metadata: TransactionMetadata | null;
}

interface TransactionsApiResponse {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

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

  const getTypeBadge = (type: Transaction["type"]) => {
    switch (type) {
      case "credit":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            {t("types.credit")}
          </Badge>
        );
      case "debit":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            {t("types.debit")}
          </Badge>
        );
      case "reset":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            {t("types.reset")}
          </Badge>
        );
      case "adjustment":
        return <Badge variant="outline">{t("types.adjustment")}</Badge>;
    }
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
                {t("columns.tokens")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {t("empty")}
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(tx.createdAt), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3">{getTypeBadge(tx.type)}</td>
                  <td className="px-4 py-3">
                    {tx.metadata?.modelId ? (
                      <ModelBadge modelId={tx.metadata.modelId} />
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
                      {tx.amount > 0 ? "+" : ""}
                      {formatTokenBalance(Math.abs(tx.amount))}
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
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.hasMore}
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
          <div key={i} className="border-t px-4 py-3">
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
