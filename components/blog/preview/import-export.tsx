"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { parseFrontmatter, serializeFrontmatter } from "@/lib/blog/frontmatter";
import type { BlogFrontmatter } from "@/lib/blog/schema";
import type { TranslateFn } from "@/lib/i18n/translate";
import { draftFromParsed, type PreviewDraft } from "./draft";

type ImportExportProps = {
  /** Validated frontmatter to export, or null while the draft is invalid. */
  exportData: BlogFrontmatter | null;
  body: string;
  currentDraft: PreviewDraft;
  onImport: (draft: PreviewDraft) => void;
  t: TranslateFn;
};

export const ImportExport = ({
  exportData,
  body,
  currentDraft,
  onImport,
  t,
}: ImportExportProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (!exportData) {
      return;
    }
    const file = serializeFrontmatter(
      exportData as Record<string, unknown>,
      body
    );
    const blob = new Blob([file], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${exportData.slug}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const { data, content } = parseFrontmatter(text);
    onImport(draftFromParsed(data, content, currentDraft));
  };

  return (
    <div className="preview-actions">
      <button
        className="blog-btn"
        disabled={!exportData}
        onClick={handleExport}
        type="button"
      >
        {t("preview.export")}
      </button>
      <button
        className="preview-btn-ghost"
        onClick={() => inputRef.current?.click()}
        type="button"
      >
        {t("preview.import")}
      </button>
      <input
        accept=".md,text/markdown"
        className="preview-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            handleImportFile(file).catch(() =>
              toast.error(t("preview.importError"))
            );
          }
        }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
};
