"use client";

import { useMemo, useRef, useState } from "react";
import { ArticleView } from "@/components/blog/article-view";
import { computeReadingTime } from "@/lib/blog/reading-time";
import { type BlogFrontmatter, blogFrontmatterSchema } from "@/lib/blog/schema";
import { slugify } from "@/lib/blog/slug";
import { useTranslations } from "@/lib/i18n/translate";
import {
  createEmptyDraft,
  draftToCandidate,
  draftToPreviewFrontmatter,
  type PreviewDraft,
} from "./draft";
import { ImportExport } from "./import-export";
import { MarkdownEditor } from "./markdown-editor";
import { MetadataForm } from "./metadata-form";
import { ValidationPanel } from "./validation-panel";

const todayIso = (): string => new Date().toISOString().slice(0, 10);

/**
 * Client-only author tool. Writes article + metadata, renders the live preview
 * through the same `ArticleView`/`ArticleContent` pipeline as production, shows
 * validation errors live, and exports/imports the finished `.md` file. Touches
 * no server data.
 */
export const BlogPreviewTool = () => {
  const t = useTranslations("blog");
  const slugEditedRef = useRef(false);
  const [draft, setDraft] = useState<PreviewDraft>(() =>
    createEmptyDraft(todayIso())
  );

  const patchDraft = (patch: Partial<PreviewDraft>) => {
    if ("slug" in patch) {
      slugEditedRef.current = true;
    }
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (!slugEditedRef.current && typeof patch.title === "string") {
        next.slug = slugify(next.title);
      }
      return next;
    });
  };

  const handleImport = (imported: PreviewDraft) => {
    slugEditedRef.current = true; // keep the imported slug as-is
    setDraft(imported);
  };

  const validation = useMemo(
    () => blogFrontmatterSchema.safeParse(draftToCandidate(draft)),
    [draft]
  );

  const issues = validation.success
    ? []
    : validation.error.issues.map((issue) => ({
        path: issue.path.join(".") || "—",
        message: issue.message,
      }));

  const exportData: BlogFrontmatter | null = validation.success
    ? validation.data
    : null;

  const previewFrontmatter = draftToPreviewFrontmatter(draft, {
    title: t("preview.placeholderTitle"),
  });
  const readingTimeMinutes = computeReadingTime(draft.body);

  return (
    <div className="preview-tool">
      <header className="preview-bar">
        <span className="preview-brand">GIPITI</span>
        <span className="preview-bar-title">{t("preview.heading")}</span>
        <ImportExport
          body={draft.body}
          currentDraft={draft}
          exportData={exportData}
          onImport={handleImport}
          t={t}
        />
      </header>

      <div className="preview-grid">
        <section className="preview-editor-col">
          <MetadataForm draft={draft} onPatch={patchDraft} t={t} />
          <MarkdownEditor
            onChange={(value) => patchDraft({ body: value })}
            t={t}
            value={draft.body}
          />
          <ValidationPanel
            issues={issues}
            isValid={validation.success}
            readingTimeMinutes={readingTimeMinutes}
            t={t}
          />
        </section>

        <section className="preview-pane">
          <ArticleView
            content={draft.body}
            frontmatter={previewFrontmatter}
            readingLabel={t("article.readingFull")}
            readingTimeMinutes={readingTimeMinutes}
          />
        </section>
      </div>
    </div>
  );
};
