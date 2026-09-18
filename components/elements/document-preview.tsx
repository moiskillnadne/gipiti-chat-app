"use client";

import { DownloadIcon, FileText, Maximize2Icon } from "lucide-react";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import type { MediaPreviewState } from "./media-preview";

const CARD =
  "flex w-full max-w-[392px] items-center gap-3 rounded-lg border border-rule bg-card p-3.5 shadow-sm";

/** Downloadable document formats produced by the generate* tools. */
export type DocumentFormat = "pdf" | "docx" | "markdown" | "txt" | "csv";

type FormatLabels = {
  /** Short badge shown under the title (e.g. "PDF"). */
  badge: string;
  /** File extension used for the download name. */
  extension: string;
  generatingKey:
    | "generatingPdf"
    | "generatingDocx"
    | "generatingMarkdown"
    | "generatingTxt"
    | "generatingCsv";
  documentKey:
    | "pdfDocument"
    | "docxDocument"
    | "markdownDocument"
    | "txtDocument"
    | "csvDocument";
  downloadKey:
    | "downloadPdf"
    | "downloadDocx"
    | "downloadMarkdown"
    | "downloadTxt"
    | "downloadCsv";
};

export const DOCUMENT_FORMAT_LABELS: Record<DocumentFormat, FormatLabels> = {
  pdf: {
    badge: "PDF",
    extension: "pdf",
    generatingKey: "generatingPdf",
    documentKey: "pdfDocument",
    downloadKey: "downloadPdf",
  },
  docx: {
    badge: "DOCX",
    extension: "docx",
    generatingKey: "generatingDocx",
    documentKey: "docxDocument",
    downloadKey: "downloadDocx",
  },
  markdown: {
    badge: "MD",
    extension: "md",
    generatingKey: "generatingMarkdown",
    documentKey: "markdownDocument",
    downloadKey: "downloadMarkdown",
  },
  txt: {
    badge: "TXT",
    extension: "txt",
    generatingKey: "generatingTxt",
    documentKey: "txtDocument",
    downloadKey: "downloadTxt",
  },
  csv: {
    badge: "CSV",
    extension: "csv",
    generatingKey: "generatingCsv",
    documentKey: "csvDocument",
    downloadKey: "downloadCsv",
  },
};

type DocumentPreviewProps = {
  format: DocumentFormat;
  state: MediaPreviewState;
  title?: string;
  url?: string;
  onDownload?: () => void;
};

const BlinkDots = () => (
  <div className="ml-auto inline-flex gap-1">
    {[0, 0.2, 0.4].map((delay) => (
      <span
        className="size-[5px] animate-media-blink rounded-full bg-ink-4"
        key={delay}
        style={{ animationDelay: `${delay}s` }}
      />
    ))}
  </div>
);

/**
 * Card for a tool-generated document (PDF / DOCX / Markdown / TXT / CSV): a generating
 * placeholder, an error state, or the finished file with open + download
 * actions. One component for every format so the cards stay identical.
 */
export const DocumentPreview = ({
  format,
  state,
  title,
  url,
  onDownload,
}: DocumentPreviewProps) => {
  const t = useTranslations("chat.media");
  const labels = DOCUMENT_FORMAT_LABELS[format];

  if (state === "queued" || state === "generating") {
    return (
      <div className={CARD}>
        <div className="flex size-[38px] shrink-0 animate-pulse items-center justify-center rounded-md bg-paper-2 text-citrus-deep">
          <FileText className="size-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-[13px] text-ink">
            {t(labels.generatingKey)}
          </div>
          <div className="mt-[3px] font-mono text-[10px] text-ink-3 uppercase tracking-[0.06em]">
            {labels.badge}
          </div>
        </div>
        <BlinkDots />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={cn(CARD, "bg-danger-soft")}>
        <div className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-card text-danger">
          <FileText className="size-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="font-medium text-[13px] text-ink">
            {t("errorTitle")}
          </div>
          <div className="mt-[3px] text-[11px] text-ink-3">
            {t("errorTimeout")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="flex size-[38px] shrink-0 items-center justify-center rounded-md bg-paper-2 text-citrus-deep">
        <FileText className="size-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[13px] text-ink">
          {title || t(labels.documentKey)}
        </div>
        <div className="mt-[3px] font-mono text-[10px] text-ink-3 uppercase tracking-[0.06em]">
          {labels.badge}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {url && (
          <a
            className="flex size-[34px] items-center justify-center rounded-md border border-rule bg-card text-ink-2 transition-colors duration-fast ease-canon hover:border-rule-strong hover:bg-paper-2 hover:text-ink"
            href={url}
            rel="noopener noreferrer"
            target="_blank"
            title={t("open")}
          >
            <Maximize2Icon className="size-4" />
          </a>
        )}
        {onDownload && (
          <button
            className="flex size-[34px] items-center justify-center rounded-md border border-ink bg-ink text-paper transition-colors duration-fast ease-canon hover:bg-black"
            onClick={onDownload}
            title={t(labels.downloadKey)}
            type="button"
          >
            <DownloadIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
};
