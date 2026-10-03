"use client";

import { FileText, Loader2, X } from "lucide-react";
import Image from "next/image";
import { formatFileSize } from "@/lib/attachments/attachment-display";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const isImage = (contentType?: string) =>
  Boolean(contentType?.startsWith("image"));

const isPdf = (contentType?: string) => contentType === "application/pdf";

const codeExtension = (name?: string) => {
  if (!name) {
    return null;
  }
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex === -1) {
    return null;
  }
  const ext = name.slice(dotIndex).toLowerCase();
  if (
    [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".json",
      ".md",
      ".txt",
      ".csv",
      ".tsv",
      ".py",
      ".rb",
      ".go",
      ".rs",
      ".css",
      ".html",
    ].includes(ext)
  ) {
    return ext;
  }
  return null;
};

const typeLabel = (attachment: Attachment) => {
  if (isImage(attachment.contentType)) {
    const ext = attachment.name?.split(".").pop()?.toUpperCase();
    return ext && ext.length <= 4 ? ext : "IMG";
  }
  if (isPdf(attachment.contentType)) {
    return "PDF";
  }
  const code = codeExtension(attachment.name);
  if (code) {
    return code.replace(".", "").toUpperCase();
  }
  return "FILE";
};

type AttachmentItemProps = {
  attachment: Attachment;
  removeLabel?: string;
  onRemove?: () => void;
  openLabel?: string;
  /** Opens the image in the fullscreen lightbox (image attachments only). */
  onOpen?: () => void;
};

const THUMBNAIL_CLASS =
  "relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper-2 text-ink-3";

export function AttachmentItem({
  attachment,
  removeLabel,
  onRemove,
  openLabel,
  onOpen,
}: AttachmentItemProps) {
  const { name, url, contentType, size } = attachment;
  const isPdfFile = isPdf(contentType);
  const code = codeExtension(name);
  const isImg = isImage(contentType);
  const sizeLabel = size === undefined ? undefined : formatFileSize(size);
  const isOpenable = isImg && Boolean(url) && Boolean(onOpen);

  return (
    <div className="group relative inline-flex max-w-[280px] items-center gap-2.5 rounded-md border border-rule bg-paper px-3 py-2 pl-2 text-[12.5px] text-ink-2 transition-colors duration-fast ease-canon hover:border-rule-strong">
      {isOpenable ? (
        <button
          aria-label={openLabel}
          className={cn(THUMBNAIL_CLASS, "cursor-zoom-in")}
          onClick={onOpen}
          type="button"
        >
          <Image
            alt={name ?? "image"}
            className="size-full object-cover"
            height={36}
            src={url}
            unoptimized
            width={36}
          />
        </button>
      ) : (
        <span
          className={cn(
            THUMBNAIL_CLASS,
            isPdfFile && "bg-danger-soft text-danger"
          )}
        >
          {isImg && url ? (
            <Image
              alt={name ?? "image"}
              className="size-full object-cover"
              height={36}
              src={url}
              unoptimized
              width={36}
            />
          ) : isPdfFile ? (
            <FileText className="size-4" strokeWidth={1.6} />
          ) : code ? (
            <span className="font-medium font-mono text-[11px] text-citrus">
              {code}
            </span>
          ) : (
            <FileText className="size-4" strokeWidth={1.6} />
          )}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className="truncate font-medium text-[12.5px] text-ink"
          title={name}
        >
          {name}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-3 uppercase tracking-[0.04em]">
          <span>{typeLabel(attachment)}</span>
          {sizeLabel && (
            <>
              <span className="size-[3px] rounded-full bg-ink-4" />
              <span>{sizeLabel}</span>
            </>
          )}
        </span>
      </span>
      {onRemove && (
        <button
          aria-label={removeLabel}
          className={cn(
            "-top-1.5 -right-1.5 absolute inline-flex size-[18px] items-center justify-center rounded-full bg-ink text-paper opacity-0 shadow-sm transition-opacity duration-fast ease-canon",
            "focus-visible:opacity-100 group-hover:opacity-100"
          )}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onRemove();
          }}
          type="button"
        >
          <X className="size-[9px]" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}

type UploadingItemProps = {
  filename: string;
  /** Formatted file size, e.g. "2,4 МБ". */
  sizeLabel?: string;
  uploadingLabel: string;
};

/** Composer chip for a file whose upload has not finished yet. */
export function UploadingItem({
  filename,
  sizeLabel,
  uploadingLabel,
}: UploadingItemProps) {
  return (
    <div
      aria-busy="true"
      className="relative inline-flex max-w-[280px] items-center gap-2.5 rounded-md border border-rule bg-paper-2 px-3 py-2 pl-2 text-[12.5px] text-ink-2"
      data-testid="attachment-uploading"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper text-citrus-deep">
        <Loader2 className="size-4 animate-spin" strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span
          className="truncate font-medium text-[12.5px] text-ink"
          title={filename}
        >
          {filename}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-3 uppercase tracking-[0.04em]">
          <b className="font-medium text-citrus-deep">{uploadingLabel}</b>
          {sizeLabel && (
            <>
              <span className="size-[3px] rounded-full bg-ink-4" />
              <span>{sizeLabel}</span>
            </>
          )}
        </span>
      </span>
    </div>
  );
}
