"use client";

import { ExternalLinkIcon, SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { WebSearchResult as WebSearchResultType } from "@/lib/search/search-types";

type WebSearchResultProps = {
  query: string;
  results: WebSearchResultType[];
  responseTime: number;
  cached: boolean;
};

export function WebSearchResult({
  query,
  results,
  responseTime,
  cached,
}: WebSearchResultProps) {
  const t = useTranslations("chat.tools.webSearch");

  if (results.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <SearchIcon className="size-4" />
          <span className="text-sm">{t("noResults", { query })}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <span className="font-medium text-sm">"{query}"</span>
        </div>
        <span className="text-muted-foreground text-xs">
          {cached ? t("cached") : `${responseTime}ms`}
        </span>
      </div>
      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            className="border-primary/20 border-l-2 pl-3"
            key={`${result.url}-${index}`}
          >
            <a
              className="flex items-center gap-1 font-medium text-sm hover:underline"
              href={result.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {result.title}
              <ExternalLinkIcon className="size-3" />
            </a>
            <p className="line-clamp-2 text-muted-foreground text-xs">
              {result.content}
            </p>
            {result.publishedDate && (
              <span className="text-muted-foreground text-xs">
                {t("published")}: {result.publishedDate}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 text-muted-foreground text-xs">
        {t("resultsCount", { count: results.length })}
      </div>
    </div>
  );
}
