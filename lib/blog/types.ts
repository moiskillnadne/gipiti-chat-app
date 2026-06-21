import type { BlogFrontmatter } from "./schema";

/** A published article: validated frontmatter + raw Markdown body + derived fields. */
export type BlogPost = {
  frontmatter: BlogFrontmatter;
  content: string;
  slug: string;
  readingTimeMinutes: number;
};

/** List-view payload — a post without its (potentially large) Markdown body. */
export type BlogPostMeta = Omit<BlogPost, "content">;
