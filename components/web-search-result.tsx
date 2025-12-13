"use client";

import { GlobeIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { WebSearchResult as WebSearchResultType } from "@/lib/search/search-types";

type WebSearchResultProps = {
  query: string;
  results: WebSearchResultType[];
  responseTime: number;
  cached: boolean;
};

const MAX_VISIBLE_DOMAINS = 4;

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function DomainPill({ domain, url }: { domain: string; url: string }) {
  return (
    <a
      className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs transition-colors hover:bg-muted/80"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
    >
      <Image
        alt=""
        className="size-4 rounded-sm"
        height={12}
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        width={12}
      />
      <span className="max-w-[120px] truncate">{domain}</span>
    </a>
  );
}

export function WebSearchResult({ query, results }: WebSearchResultProps) {
  const t = useTranslations("chat.tools.webSearch");

  if (results.length === 0) {
    return (
      <div className="flex items-center gap-2 py-1 text-muted-foreground text-sm">
        <GlobeIcon className="size-4" />
        <span>{t("noResults", { query })}</span>
      </div>
    );
  }

  const domainToUrl = new Map<string, string>();
  for (const r of results) {
    const domain = extractDomain(r.url);
    if (!domainToUrl.has(domain)) {
      domainToUrl.set(domain, r.url);
    }
  }
  const uniqueDomains = [...domainToUrl.keys()];
  const visibleDomains = uniqueDomains.slice(0, MAX_VISIBLE_DOMAINS);
  const remainingCount = uniqueDomains.length - MAX_VISIBLE_DOMAINS;

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <GlobeIcon className="size-4" />
        <span>{t("searching", { query })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleDomains.map((domain) => (
          <DomainPill
            domain={domain}
            key={domain}
            url={domainToUrl.get(domain) ?? ""}
          />
        ))}
        {remainingCount > 0 && (
          <span className="px-1.5 text-muted-foreground text-xs">
            {t("moreCount", { count: remainingCount })}
          </span>
        )}
      </div>
    </div>
  );
}
