import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import type { ZodError } from "zod";
import { parseFrontmatter } from "./frontmatter";
import { computeReadingTime } from "./reading-time";
import { blogFrontmatterSchema } from "./schema";
import type { BlogPost, BlogPostMeta } from "./types";

export type { BlogPost, BlogPostMeta } from "./types";

const BLOG_DIR = path.join(process.cwd(), "content", "blog");
const MARKDOWN_EXTENSION = ".md";
// `/blog/preview` is the author preview route — no article may shadow it.
const RESERVED_SLUGS = new Set(["preview"]);

/**
 * Thrown when a file that claims `published: true` has invalid metadata. It
 * propagates out of `generateStaticParams`/page render and aborts `next build`
 * with the offending file and fields — a broken article never ships silently.
 */
export class BlogValidationError extends Error {
  constructor(fileName: string, issues: string) {
    super(`Невалидные метаданные статьи «${fileName}»: ${issues}`);
    this.name = "BlogValidationError";
  }
}

function formatIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(корень)"}: ${issue.message}`)
    .join("; ");
}

function toMeta(post: BlogPost): BlogPostMeta {
  return {
    frontmatter: post.frontmatter,
    slug: post.slug,
    readingTimeMinutes: post.readingTimeMinutes,
  };
}

async function listMarkdownFiles(): Promise<string[]> {
  try {
    const entries = await readdir(BLOG_DIR);
    return entries.filter((name) => name.endsWith(MARKDOWN_EXTENSION));
  } catch {
    // No content/blog directory yet → an empty blog, not a build error.
    return [];
  }
}

/**
 * Read one file and return a published post, or `null` for a draft (valid or
 * malformed). A file that *claims* to be published but fails validation throws,
 * so it cannot ship broken.
 */
async function readPostFile(fileName: string): Promise<BlogPost | null> {
  const raw = await readFile(path.join(BLOG_DIR, fileName), "utf8");
  const { data, content } = parseFrontmatter(raw);

  const fileSlug = fileName.slice(0, -MARKDOWN_EXTENSION.length);
  // Frontmatter `slug` overrides the filename; filename is the fallback.
  const candidate = { slug: fileSlug, ...data };

  const parsed = blogFrontmatterSchema.safeParse(candidate);

  if (!parsed.success) {
    const claimsPublished =
      (data as { published?: unknown }).published === true;
    if (claimsPublished) {
      throw new BlogValidationError(fileName, formatIssues(parsed.error));
    }
    return null;
  }

  const frontmatter = parsed.data;

  if (RESERVED_SLUGS.has(frontmatter.slug)) {
    if (frontmatter.published) {
      throw new BlogValidationError(
        fileName,
        `slug «${frontmatter.slug}» зарезервирован`
      );
    }
    return null;
  }

  if (!frontmatter.published) {
    return null;
  }

  return {
    frontmatter,
    content,
    slug: frontmatter.slug,
    readingTimeMinutes: computeReadingTime(content),
  };
}

function assertUniqueSlugs(posts: BlogPost[]): void {
  const seen = new Set<string>();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new BlogValidationError(
        `${post.slug}.md`,
        `Дублирующийся slug «${post.slug}»`
      );
    }
    seen.add(post.slug);
  }
}

// Memoized per render pass so generateMetadata + the page don't re-read the dir.
const loadPublishedPosts = cache(async (): Promise<BlogPost[]> => {
  const files = await listMarkdownFiles();
  const posts = await Promise.all(files.map(readPostFile));
  const published = posts.filter((post): post is BlogPost => post !== null);
  assertUniqueSlugs(published);
  return published;
});

/** Published posts (metadata only), newest first. Throws on invalid published files. */
export async function getAllPublishedPosts(): Promise<BlogPostMeta[]> {
  const posts = await loadPublishedPosts();
  return [...posts]
    .sort((a, b) => b.frontmatter.date.localeCompare(a.frontmatter.date))
    .map(toMeta);
}

/** A single published post, or `null` for an unknown/draft/reserved slug. */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  if (RESERVED_SLUGS.has(slug)) {
    return null;
  }
  const posts = await loadPublishedPosts();
  return posts.find((post) => post.slug === slug) ?? null;
}

/** Slugs of published posts — drives `generateStaticParams`. */
export async function getAllPublishedSlugs(): Promise<string[]> {
  const posts = await loadPublishedPosts();
  return posts.map((post) => post.slug);
}

/** Minimal data for the sitemap: slug + ISO date (used as `lastModified`). */
export async function getSitemapEntries(): Promise<
  { slug: string; date: string }[]
> {
  const posts = await getAllPublishedPosts();
  return posts.map((post) => ({
    slug: post.slug,
    date: post.frontmatter.date,
  }));
}
