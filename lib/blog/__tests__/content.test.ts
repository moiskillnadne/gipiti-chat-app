import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { modelLandings } from "@/lib/marketing/model-landings";
import { catalogSections } from "@/lib/marketing/models-catalog";

import { parseFrontmatter } from "../frontmatter";

type Article = {
  fileName: string;
  title: string;
  category: string;
  body: string;
};

// `lib/blog/posts.ts` imports `server-only`, so the files are read directly.
const BLOG_DIR = join(process.cwd(), "content", "blog");
const GUIDE_CATEGORY = "Гайды";

// Any `/models...` path in the body, whatever the link form: `](/models/x)`,
// `](/models/x "title")`, `](</models/x>)`, `[ref]: /models/x`, or the absolute
// `https://gipiti.ru/models/x`. The lookbehind skips `/models` inside other
// paths (`/images/models/a.png`). The path runs to the next space, `)`, quote,
// `>` or `]`, so a trailing slash, `#hash` or `?query` is captured and fails the
// check below: only the canonical `/models` or `/models/<slug>` is accepted.
const MODELS_PATH_PATTERN =
  /(?:https?:\/\/(?:www\.)?gipiti\.ru|(?<![\w/.-]))(\/models[^\s)"'>\]]*)/g;
// A separator (dash, pipe or colon) is required, so a title such as
// «Как оплатить подписку в GIPITI» is fine.
const TRAILING_BRAND_PATTERN = /\s*[-–—|:]\s*GIPITI\s*$/i;

const validModelPaths = new Set<string>([
  "/models",
  ...catalogSections.map((section) => `/models/${section.slug}`),
  ...modelLandings.map((landing) => `/models/${landing.slug}`),
]);

const articles: Article[] = readdirSync(BLOG_DIR)
  .filter((fileName) => fileName.endsWith(".md"))
  .map((fileName) => {
    const { data, content } = parseFrontmatter(
      readFileSync(join(BLOG_DIR, fileName), "utf8")
    );
    return {
      fileName,
      title: String(data.title ?? ""),
      category: String(data.category ?? ""),
      body: content,
    };
  });

const guides = articles.filter(
  (article) => article.category === GUIDE_CATEGORY
);

const getModelPaths = (body: string): string[] =>
  Array.from(body.matchAll(MODELS_PATH_PATTERN), (match) => match[1]);

describe("blog articles", () => {
  it("finds the articles on disk", () => {
    expect(articles.length).toBeGreaterThan(0);
    expect(guides.length).toBeGreaterThan(0);
  });

  it.each(articles)(
    "$fileName links only to existing model pages",
    ({ body }) => {
      const modelPaths = getModelPaths(body);

      const brokenPaths = modelPaths.filter(
        (path) => !validModelPaths.has(path)
      );

      expect(brokenPaths).toEqual([]);
    }
  );

  it.each(articles)(
    "$fileName does not end its title with the brand",
    ({ title }) => {
      expect(title).not.toBe("");
      expect(title).not.toMatch(TRAILING_BRAND_PATTERN);
    }
  );

  it.each(guides)(
    "$fileName (a guide) links to at least one model page",
    ({ body }) => {
      const modelPaths = getModelPaths(body);

      expect(modelPaths.length).toBeGreaterThan(0);
    }
  );
});
