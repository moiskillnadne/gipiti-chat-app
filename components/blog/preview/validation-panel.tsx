"use client";

import type { TranslateFn } from "@/lib/i18n/translate";

type ValidationIssue = {
  path: string;
  message: string;
};

type ValidationPanelProps = {
  isValid: boolean;
  issues: ValidationIssue[];
  readingTimeMinutes: number;
  t: TranslateFn;
};

export const ValidationPanel = ({
  isValid,
  issues,
  readingTimeMinutes,
  t,
}: ValidationPanelProps) => (
  <div className={`preview-validation ${isValid ? "is-valid" : "is-invalid"}`}>
    <div className="preview-validation-head">
      <span>{isValid ? t("preview.valid") : t("preview.invalid")}</span>
      <span className="preview-reading">
        {readingTimeMinutes} {t("article.readingFull")}
      </span>
    </div>
    {issues.length > 0 ? (
      <ul className="preview-issues">
        {issues.map((issue) => (
          <li key={`${issue.path}-${issue.message}`}>
            <code>{issue.path}</code> — {issue.message}
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);
