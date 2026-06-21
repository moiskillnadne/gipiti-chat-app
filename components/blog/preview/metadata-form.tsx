"use client";

import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/blog/schema";
import type { TranslateFn } from "@/lib/i18n/translate";
import type { PreviewDraft } from "./draft";

type MetadataFormProps = {
  draft: PreviewDraft;
  onPatch: (patch: Partial<PreviewDraft>) => void;
  t: TranslateFn;
};

export const MetadataForm = ({ draft, onPatch, t }: MetadataFormProps) => (
  <div className="preview-form">
    <label className="preview-field">
      <span className="preview-label">{t("preview.fields.title")}</span>
      <input
        className="preview-input"
        onChange={(event) => onPatch({ title: event.target.value })}
        type="text"
        value={draft.title}
      />
    </label>

    <label className="preview-field">
      <span className="preview-label">{t("preview.fields.slug")}</span>
      <input
        className="preview-input"
        onChange={(event) => onPatch({ slug: event.target.value })}
        spellCheck={false}
        type="text"
        value={draft.slug}
      />
    </label>

    <label className="preview-field">
      <span className="preview-label">{t("preview.fields.description")}</span>
      <textarea
        className="preview-input preview-textarea-sm"
        onChange={(event) => onPatch({ description: event.target.value })}
        rows={2}
        value={draft.description}
      />
    </label>

    <div className="preview-field-row">
      <label className="preview-field">
        <span className="preview-label">{t("preview.fields.category")}</span>
        <select
          className="preview-input"
          onChange={(event) =>
            onPatch({ category: event.target.value as BlogCategory })
          }
          value={draft.category}
        >
          {BLOG_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>

      <label className="preview-field">
        <span className="preview-label">{t("preview.fields.date")}</span>
        <input
          className="preview-input"
          onChange={(event) => onPatch({ date: event.target.value })}
          type="date"
          value={draft.date}
        />
      </label>
    </div>

    <label className="preview-field">
      <span className="preview-label">{t("preview.fields.tags")}</span>
      <input
        className="preview-input"
        onChange={(event) => onPatch({ tags: event.target.value })}
        placeholder={t("preview.fields.tagsHint")}
        type="text"
        value={draft.tags}
      />
    </label>

    <label className="preview-field">
      <span className="preview-label">{t("preview.fields.coverImage")}</span>
      <input
        className="preview-input"
        onChange={(event) => onPatch({ coverImage: event.target.value })}
        placeholder="/images/blog/cover.png"
        spellCheck={false}
        type="text"
        value={draft.coverImage}
      />
    </label>

    <label className="preview-field">
      <span className="preview-label">{t("preview.fields.excerpt")}</span>
      <textarea
        className="preview-input preview-textarea-sm"
        onChange={(event) => onPatch({ excerpt: event.target.value })}
        rows={2}
        value={draft.excerpt}
      />
    </label>

    <label className="preview-toggle">
      <input
        checked={draft.published}
        onChange={(event) => onPatch({ published: event.target.checked })}
        type="checkbox"
      />
      <span>{t("preview.fields.published")}</span>
    </label>
  </div>
);
