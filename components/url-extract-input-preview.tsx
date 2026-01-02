"use client";

import { LinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";

type UrlExtractInputPreviewProps = {
  urls: string[];
};

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function UrlExtractInputPreview({ urls }: UrlExtractInputPreviewProps) {
  const t = useTranslations("chat.tools.extractUrl");

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <LinkIcon className="size-4" />
        <span>{t("extracting", { count: urls.length })}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {urls.map((url) => (
          <div
            className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
            key={url}
          >
            <span className="max-w-[200px] truncate">{extractDomain(url)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
