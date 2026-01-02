"use client";

import { CheckCircle2Icon, LinkIcon, XCircleIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { UrlExtractResult as UrlExtractResultType } from "@/lib/search/search-types";

type UrlExtractResultProps = {
  results: UrlExtractResultType[];
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function UrlPill({ url, success }: { url: string; success: boolean }) {
  const domain = extractDomain(url);

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
      <span className="max-w-[150px] truncate">{domain}</span>
      {success ? (
        <CheckCircle2Icon className="size-3 text-green-600" />
      ) : (
        <XCircleIcon className="size-3 text-red-600" />
      )}
    </a>
  );
}

export function UrlExtractResult({ results }: UrlExtractResultProps) {
  const t = useTranslations("chat.tools.extractUrl");

  if (results.length === 0) {
    return (
      <div className="flex items-center gap-2 py-1 text-muted-foreground text-sm">
        <LinkIcon className="size-4" />
        <span>{t("noResults")}</span>
      </div>
    );
  }

  const successfulResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <LinkIcon className="size-4" />
        <span>{t("extracted", { count: successfulResults.length })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {results.map((result) => (
          <UrlPill key={result.url} success={result.success} url={result.url} />
        ))}
      </div>
      {failedResults.length > 0 && (
        <span className="px-1.5 text-muted-foreground text-xs">
          {t("failed", { count: failedResults.length })}
        </span>
      )}
    </div>
  );
}
