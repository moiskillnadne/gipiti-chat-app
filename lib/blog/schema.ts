import { z } from "zod";

/**
 * Article categories shown as filter chips on the blog index. Stored verbatim in
 * frontmatter and validated as an enum, so an unknown category fails the build.
 */
export const BLOG_CATEGORIES = ["Гайды", "Анонсы"] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

// Lowercase latin letters, digits and single hyphens — no leading/trailing/double hyphen.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// Local asset path only: a single leading "/". Blocks http(s):, data:, protocol-relative "//".
const LOCAL_PATH_PATTERN = /^\/(?!\/)\S*$/;
// ISO calendar date, YYYY-MM-DD.
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * YAML parses an unquoted `2026-06-21` into a `Date`. Normalise it back to an
 * ISO `YYYY-MM-DD` string before validation so both quoted and unquoted dates
 * round-trip. On the client (preview form) the value is always a string, so this
 * is a no-op there.
 */
const normalizeDate = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
};

export const blogFrontmatterSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(300),
  slug: z.string().min(1).max(120).regex(SLUG_PATTERN, {
    message: "slug может содержать только латиницу, цифры и дефисы",
  }),
  date: z.preprocess(
    normalizeDate,
    z
      .string()
      .regex(ISO_DATE_PATTERN, {
        message: "Дата должна быть в формате ГГГГ-ММ-ДД",
      })
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Невалидная дата",
      })
  ),
  category: z.enum(BLOG_CATEGORIES),
  tags: z.array(z.string().min(1).max(40)).max(12).default([]),
  published: z.boolean().default(false),
  coverImage: z
    .string()
    .regex(LOCAL_PATH_PATTERN, {
      message: "Путь к обложке должен быть локальным (начинаться с /)",
    })
    .optional(),
  excerpt: z.string().min(1).max(300).optional(),
});

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
