"use client";

import { FileText, X } from "lucide-react";
import Image from "next/image";
import type { Attachment } from "@/lib/types";
import { cn } from "@/lib/utils";

const isImage = (contentType?: string) =>
  Boolean(contentType?.startsWith("image"));

const isPdf = (contentType?: string) => contentType === "application/pdf";

const formatBytes = (bytes?: number) => {
  if (!bytes && bytes !== 0) {
    return;
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  size?: number;
  removeLabel?: string;
  onRemove?: () => void;
};

export function AttachmentItem({
  attachment,
  size,
  removeLabel,
  onRemove,
}: AttachmentItemProps) {
  const { name, url, contentType } = attachment;
  const isPdfFile = isPdf(contentType);
  const code = codeExtension(name);
  const isImg = isImage(contentType);
  const sizeLabel = formatBytes(size);

  return (
    <div className="group relative inline-flex max-w-[280px] items-center gap-2.5 rounded-md border border-rule bg-paper px-3 py-2 pl-2 text-[12.5px] text-ink-2 transition-colors duration-fast ease-canon hover:border-rule-strong">
      <span className="relative inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper-2 text-ink-3">
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
          <FileText className="size-4 text-citrus-deep" strokeWidth={1.6} />
        ) : code ? (
          <span className="font-medium font-mono text-[11px] text-citrus">
            {code}
          </span>
        ) : (
          <FileText className="size-4" strokeWidth={1.6} />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium text-[12.5px] text-ink">
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
  percent?: number;
  uploadingLabel: string;
};

export function UploadingItem({
  filename,
  percent = 60,
  uploadingLabel,
}: UploadingItemProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="relative inline-flex max-w-[280px] items-center gap-2.5 rounded-md border border-transparent px-3 py-2 pl-2 text-[12.5px] text-ink-2 shadow-[inset_0_0_0_1px_var(--rule)]"
      style={{
        background: `linear-gradient(90deg, var(--paper) 0%, var(--paper) ${clamped}%, var(--paper-2) ${clamped}%)`,
      }}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-paper-2 text-ink-3">
        <FileText className="size-4" strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium text-[12.5px] text-ink">
          {filename}
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.04em]">
          <b className="font-medium text-citrus-deep">{uploadingLabel}</b>
        </span>
      </span>
    </div>
  );
}
