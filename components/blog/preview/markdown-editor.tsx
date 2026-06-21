"use client";

import type { TranslateFn } from "@/lib/i18n/translate";

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  t: TranslateFn;
};

export const MarkdownEditor = ({ value, onChange, t }: MarkdownEditorProps) => (
  <label className="preview-field preview-editor-field">
    <span className="preview-label">{t("preview.body")}</span>
    <textarea
      className="preview-input preview-editor"
      onChange={(event) => onChange(event.target.value)}
      placeholder={t("preview.bodyHint")}
      spellCheck={false}
      value={value}
    />
  </label>
);
