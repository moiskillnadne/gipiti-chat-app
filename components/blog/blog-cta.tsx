"use client";

import { useTranslations } from "@/lib/i18n/translate";

/** Shared "try GIPITI" call-to-action shown on the blog index and articles. */
export const BlogCta = () => {
  const t = useTranslations("blog");

  return (
    <section className="blog-cta">
      <div className="blog-cta-inner">
        <h2>{t("cta.title")}</h2>
        <p>{t("cta.text")}</p>
        <a className="blog-btn" href="/register">
          {t("cta.button")}
        </a>
      </div>
    </section>
  );
};
