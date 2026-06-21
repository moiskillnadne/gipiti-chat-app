import {
  BLOG_CATEGORIES,
  type BlogCategory,
  type BlogFrontmatter,
} from "@/lib/blog/schema";

/**
 * The author preview form state. All fields are strings (form inputs) except the
 * boolean publish flag; `tags` is a comma/newline-separated string the schema
 * candidate turns into an array.
 */
export type PreviewDraft = {
  title: string;
  description: string;
  slug: string;
  date: string;
  category: BlogCategory;
  tags: string;
  published: boolean;
  coverImage: string;
  excerpt: string;
  body: string;
};

const TAG_SPLIT = /[,\n]/;
const LEADING_HASH = /^#/;

const toOptional = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const toDateString = (value: unknown): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return typeof value === "string" ? value : "";
};

const toText = (value: unknown): string => {
  if (value == null) {
    return "";
  }
  return typeof value === "string" ? value : String(value);
};

export const createEmptyDraft = (today: string): PreviewDraft => ({
  title: "",
  description: "",
  slug: "",
  date: today,
  category: "Анонсы",
  tags: "",
  published: false,
  coverImage: "",
  excerpt: "",
  body: "",
});

export const parseTags = (raw: string): string[] =>
  raw
    .split(TAG_SPLIT)
    .map((tag) => tag.trim().replace(LEADING_HASH, ""))
    .filter(Boolean);

/** Object handed to the Zod schema; empty optional fields become `undefined`. */
export const draftToCandidate = (
  draft: PreviewDraft
): Record<string, unknown> => ({
  title: draft.title,
  description: draft.description,
  slug: draft.slug,
  date: draft.date,
  category: draft.category,
  tags: parseTags(draft.tags),
  published: draft.published,
  coverImage: toOptional(draft.coverImage),
  excerpt: toOptional(draft.excerpt),
});

/**
 * Best-effort frontmatter for the live preview — always renderable even while
 * the draft is invalid, with placeholders for empty required fields.
 */
export const draftToPreviewFrontmatter = (
  draft: PreviewDraft,
  placeholders: { title: string }
): BlogFrontmatter => ({
  title: draft.title.trim() || placeholders.title,
  description: draft.description,
  slug: draft.slug.trim() || "preview",
  date: draft.date.trim() || "2026-01-01",
  category: draft.category,
  tags: parseTags(draft.tags),
  published: draft.published,
  coverImage: toOptional(draft.coverImage),
  excerpt: toOptional(draft.excerpt),
});

/** Map a parsed (imported) `.md` file back into editable form state. */
export const draftFromParsed = (
  data: Record<string, unknown>,
  body: string,
  fallback: PreviewDraft
): PreviewDraft => {
  const category = BLOG_CATEGORIES.includes(data.category as BlogCategory)
    ? (data.category as BlogCategory)
    : fallback.category;
  const tags = Array.isArray(data.tags)
    ? data.tags.map(toText).join(", ")
    : toText(data.tags);

  return {
    title: toText(data.title),
    description: toText(data.description),
    slug: toText(data.slug),
    date: toDateString(data.date) || fallback.date,
    category,
    tags,
    published: data.published === true,
    coverImage: toText(data.coverImage),
    excerpt: toText(data.excerpt),
    body,
  };
};
