import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/blog/article-view";
import { BlogCta } from "@/components/blog/blog-cta";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { IS_BLOG_INDEX_ENABLED } from "@/lib/blog/config";
import { getAllPublishedSlugs, getPostBySlug } from "@/lib/blog/posts";
import { getTranslations } from "@/lib/i18n/translate";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = 3600;

const SITE_URL = "https://gipiti.ru";

type ArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {};
  }

  const { frontmatter } = post;
  const canonical = `${SITE_URL}/blog/${slug}`;

  return {
    title: { absolute: `${frontmatter.title} | Блог GIPITI` },
    description: frontmatter.description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: frontmatter.title,
      description: frontmatter.description,
      url: canonical,
      publishedTime: frontmatter.date,
      tags: frontmatter.tags,
      images: frontmatter.coverImage
        ? [{ url: `${SITE_URL}${frontmatter.coverImage}` }]
        : undefined,
    },
    twitter: { card: "summary_large_image" },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const t = await getTranslations("blog");
  const { frontmatter } = post;

  // The article list is gated, so when it's hidden the "back" link returns to the
  // home page rather than the 404'd `/blog`.
  const backHref = IS_BLOG_INDEX_ENABLED ? "/blog" : "/";
  const backLabel = IS_BLOG_INDEX_ENABLED
    ? t("article.backToBlog")
    : t("article.backToHome");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: frontmatter.title,
    description: frontmatter.description,
    datePublished: frontmatter.date,
    dateModified: frontmatter.date,
    author: { "@type": "Organization", name: "GIPITI", url: SITE_URL },
    publisher: { "@type": "Organization", name: "GIPITI", url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blog/${slug}`,
    inLanguage: "ru",
    keywords: frontmatter.tags.join(", "),
    ...(frontmatter.coverImage
      ? { image: `${SITE_URL}${frontmatter.coverImage}` }
      : {}),
  };

  return (
    <>
      {/* Native <script> so the JSON-LD is server-rendered into the static HTML
          (next/script would defer it to client injection, hurting SEO). */}
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD for SEO
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />
      <LandingNav />
      <main>
        <ArticleView
          content={post.content}
          frontmatter={frontmatter}
          readingLabel={t("article.readingFull")}
          readingTimeMinutes={post.readingTimeMinutes}
        />
        <BlogCta />
        <div className="back">
          <Link href={backHref}>
            <span aria-hidden="true">←</span> {backLabel}
          </Link>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
