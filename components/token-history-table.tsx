"use client";

import { useReducedMotion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef, useState } from "react";
import useSWR from "swr";
import { type Transaction, toHistoryRow } from "@/components/token-history-row";
import { TokenHistorySkeleton } from "@/components/token-history-skeleton";
import { HistoryList, HistoryTable } from "@/components/token-history-views";
import { Button } from "@/components/ui/button";
import { resolveScrollBehavior } from "@/lib/dom/scroll-behavior";
import { useTranslations } from "@/lib/i18n/translate";
import { fetcher } from "@/lib/utils";

type TransactionsApiResponse = {
  transactions: Transaction[];
  total: number;
  hasMore: boolean;
};

const PAGE_SIZE = 20;

export function TokenHistoryTable() {
  const t = useTranslations("auth.subscription.history");
  const [page, setPage] = useState(0);
  const offset = page * PAGE_SIZE;
  const rootRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();

  const { data, isLoading } = useSWR<TransactionsApiResponse>(
    `/api/transactions?limit=${PAGE_SIZE}&offset=${offset}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return <TokenHistorySkeleton />;
  }

  /** Changes the page and, if the history card's top has scrolled away, brings it back. */
  const goToPage = (nextPage: number) => {
    setPage(nextPage);
    const card =
      rootRef.current?.closest("[data-history-card]") ?? rootRef.current;
    if (!card || card.getBoundingClientRect().top >= 0) {
      return;
    }
    card.scrollIntoView({
      behavior: resolveScrollBehavior("smooth", shouldReduceMotion),
      block: "start",
    });
  };

  const rows = (data?.transactions ?? []).map(toHistoryRow);
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4" ref={rootRef}>
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
              aria-label={t("pagination.previousPage")}
              disabled={page === 0}
              onClick={() => goToPage(Math.max(0, page - 1))}
              size="sm"
              variant="outline"
            >
              <ChevronLeftIcon aria-hidden className="h-4 w-4" />
            </Button>
            <Button
              aria-label={t("pagination.nextPage")}
              disabled={!data?.hasMore}
              onClick={() => goToPage(page + 1)}
              size="sm"
              variant="outline"
            >
              <ChevronRightIcon aria-hidden className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
