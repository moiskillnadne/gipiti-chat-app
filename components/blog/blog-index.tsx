"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatRussianDate } from "@/lib/blog/format";
import { BLOG_CATEGORIES, type BlogCategory } from "@/lib/blog/schema";
import type { BlogPostMeta } from "@/lib/blog/types";
import type { TranslateFn } from "@/lib/i18n/translate";
import { useTranslations } from "@/lib/i18n/translate";
import { BlogCta } from "./blog-cta";
import { BlogImage } from "./blog-image";
import { PostCard } from "./post-card";

type CategoryFilter = BlogCategory | "all";

type BlogIndexProps = {
  posts: BlogPostMeta[];
};

const BlogHero = ({ t }: { t: TranslateFn }) => (
  <section className="blog-hero">
    <div className="blog-hero-inner">
      <span className="kicker">{t("hero.kicker")}</span>
      <h1>
        {t("hero.title")} <span className="grad">{t("hero.titleAccent")}</span>
      </h1>
      <p>{t("hero.subtitle")}</p>
    </div>
  </section>
);

const FeaturedCard = ({
  post,
  badge,
  readingLabel,
}: {
  post: BlogPostMeta;
  badge: string;
  readingLabel: string;
}) => {
  const { frontmatter, slug, readingTimeMinutes } = post;
  const excerpt = frontmatter.excerpt ?? frontmatter.description;

  return (
    <section className="featured">
      <Link href={`/blog/${slug}`}>
        <div className="fimg">
          <BlogImage
            alt={frontmatter.title}
            shape="fmedia"
            sizes="(max-width: 900px) 100vw, 50vw"
            src={frontmatter.coverImage}
          />
        </div>
        <div className="fbody">
          <span className="fbadge">{badge}</span>
          <div className="pc-meta">
            <span className="pc-cat">{frontmatter.category}</span>
            <span>·</span>
            <span>{formatRussianDate(frontmatter.date)}</span>
            <span>·</span>
            <span>
              {readingTimeMinutes} {readingLabel}
            </span>
          </div>
          <h2>{frontmatter.title}</h2>
          <p className="fexcerpt">{excerpt}</p>
        </div>
      </Link>
    </section>
  );
};

export const BlogIndex = ({ posts }: BlogIndexProps) => {
  const t = useTranslations("blog");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

  const featured = posts.at(0);
  const readingLabel = t("reading");

  const isFeaturedVisible =
    featured !== undefined &&
    (activeCategory === "all" ||
      featured.frontmatter.category === activeCategory);

  const visiblePosts = useMemo(() => {
    const rest = posts.slice(1);
    if (activeCategory === "all") {
      return rest;
    }
    return rest.filter((post) => post.frontmatter.category === activeCategory);
  }, [activeCategory, posts]);

  if (posts.length === 0) {
    return (
      <>
        <BlogHero t={t} />
        <p className="blog-empty">{t("empty")}</p>
      </>
    );
  }

  const totalVisible = visiblePosts.length + (isFeaturedVisible ? 1 : 0);

  return (
    <>
      <BlogHero t={t} />

      <div className="blog-filters">
        <button
          className={`chip ${activeCategory === "all" ? "on" : ""}`}
          onClick={() => setActiveCategory("all")}
          type="button"
        >
          {t("filters.all")}
        </button>
        {BLOG_CATEGORIES.map((category) => (
          <button
            className={`chip ${activeCategory === category ? "on" : ""}`}
            key={category}
            onClick={() => setActiveCategory(category)}
            type="button"
          >
            {category}
          </button>
        ))}
      </div>

      {isFeaturedVisible && featured ? (
        <FeaturedCard
          badge={t("featuredBadge")}
          post={featured}
          readingLabel={readingLabel}
        />
      ) : null}

      <div className="section-head">
        <h2>{t("sectionTitle")}</h2>
        <span className="count">{t("count", { count: totalVisible })}</span>
      </div>

      <div className="grid-wrap">
        <div className="card-grid">
          {visiblePosts.map((post) => (
            <PostCard key={post.slug} post={post} readingLabel={readingLabel} />
          ))}
        </div>
      </div>

      <BlogCta />
    </>
  );
};
