"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { ModelBadge } from "@/components/model-badge";
import {
  BADGE_CLASS_BY_TYPE,
  type HistoryRow,
  type Transaction,
  type TransactionType,
  toHistoryRow,
} from "@/components/token-history-row";
import { TokenHistorySkeleton } from "@/components/token-history-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/translate";
import { fetcher } from "@/lib/utils";

type TransactionsApiResponse = {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
};

type HistoryRowsProps = {
  rows: HistoryRow[];
};

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
    return <TokenHistorySkeleton />;
  }

  const rows = (data?.transactions ?? []).map(toHistoryRow);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* The five columns need ~770px, so below lg each row becomes a two-line list item */}
      <HistoryList rows={rows} />
      <HistoryTable rows={rows} />

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
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

function TypeBadge({ type }: { type: TransactionType }) {
  const t = useTranslations("auth.subscription.history");
  if (type === "adjustment") {
    return <Badge variant="outline">{t(`types.${type}`)}</Badge>;
  }
  return (
    <Badge className={BADGE_CLASS_BY_TYPE[type]}>{t(`types.${type}`)}</Badge>
  );
}

function HistoryList({ rows }: HistoryRowsProps) {
  const t = useTranslations("auth.subscription.history");

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground text-sm lg:hidden">
        {t("empty")}
      </p>
    );
  }

  return (
    <ul className="divide-y text-sm lg:hidden">
      {rows.map((row) => (
        <li
          className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5 py-3"
          key={row.id}
        >
          {/* With no chat title or description the operation type is the row's title */}
          <p className="break-words font-medium">
            {row.title ?? t(`types.${row.type}`)}
          </p>
          <p className="whitespace-nowrap text-right font-mono">
            <span className={row.amountClassName}>{row.amountLabel}</span>
          </p>
          <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
            {row.title && <TypeBadge type={row.type} />}
            {row.modelId && <ModelBadge modelId={row.modelId} />}
            <time dateTime={row.createdAt}>{row.dateLabel}</time>
          </div>
        </li>
      ))}
    </ul>
  );
}

function HistoryTable({ rows }: HistoryRowsProps) {
  const t = useTranslations("auth.subscription.history");

  return (
    <div className="hidden overflow-x-auto rounded-lg border lg:block">
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
          {rows.length === 0 ? (
            <tr>
              <td
                className="px-4 py-8 text-center text-muted-foreground"
                colSpan={5}
              >
                {t("empty")}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="hover:bg-muted/30" key={row.id}>
                <td className="whitespace-nowrap px-4 py-3">{row.dateLabel}</td>
                <td className="px-4 py-3">
                  <TypeBadge type={row.type} />
                </td>
                <td className="px-4 py-3">
                  {row.modelId ? (
                    <ModelBadge modelId={row.modelId} />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3">
                  {row.title ?? "-"}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  <span className={row.amountClassName}>{row.amountLabel}</span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
