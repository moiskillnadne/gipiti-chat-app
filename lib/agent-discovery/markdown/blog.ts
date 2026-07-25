import { IS_BLOG_INDEX_ENABLED } from "@/lib/blog/config";
import { getAllPublishedPosts, getPostBySlug } from "@/lib/blog/posts";

import { absoluteUrl } from "../constants";

/**
 * Markdown for `/blog` and `/blog/{slug}`.
 *
 * Articles are authored as Markdown under `content/blog`, so the article view
 * serves the source body verbatim — the HTML page renders that exact string
 * through Streamdown.
 */

/** Markdown for `/blog`, or `null` while the index is hidden (it 404s in HTML too). */
export const buildBlogIndexMarkdown = async (): Promise<string | null> => {
  if (!IS_BLOG_INDEX_ENABLED) {
    return null;
  }

  const posts = await getAllPublishedPosts();

  return [
    "# Блог GIPITI",
    "",
    "Гайды и анонсы о работе с нейросетями на русском языке.",
    "",
    `Страница: ${absoluteUrl("/blog")}`,
    "",
    ...posts.flatMap((post) => [
      `## ${post.frontmatter.title}`,
      "",
      `${post.frontmatter.date} · ${post.frontmatter.category} · ${post.readingTimeMinutes} мин чтения`,
      "",
      post.frontmatter.description,
      "",
      absoluteUrl(`/blog/${post.slug}`),
      "",
    ]),
  ].join("\n");
};

/** Markdown for `/blog/{slug}`, or `null` for an unknown or unpublished slug. */
export const buildBlogPostMarkdown = async (
  slug: string
): Promise<string | null> => {
  const post = await getPostBySlug(slug);
  if (!post) {
    return null;
  }

  const { frontmatter } = post;
  const tags =
    frontmatter.tags.length > 0 ? `Теги: ${frontmatter.tags.join(", ")}` : null;

  return [
    `# ${frontmatter.title}`,
    "",
    `${frontmatter.date} · ${frontmatter.category} · ${post.readingTimeMinutes} мин чтения`,
    "",
    frontmatter.description,
    "",
    `Страница: ${absoluteUrl(`/blog/${post.slug}`)}`,
    ...(tags ? ["", tags] : []),
    "",
    "---",
    "",
    post.content,
    "",
  ].join("\n");
};
