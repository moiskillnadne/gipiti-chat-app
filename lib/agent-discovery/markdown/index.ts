import { buildBlogIndexMarkdown, buildBlogPostMarkdown } from "./blog";
import { buildHomeMarkdown } from "./home";
import { buildModelsIndexMarkdown, buildModelsSlugMarkdown } from "./models";
import { BLOG_PREFIX, MODELS_PREFIX } from "./paths";

/**
 * Resolves a public page path to its Markdown representation. Path matching
 * lives in `./paths` so `proxy.ts` can reuse it without importing the
 * filesystem-backed blog loader.
 */

/** Markdown for a public page, or `null` when the path has no Markdown view. */
export const getMarkdownForPath = async (
  pathname: string
): Promise<string | null> => {
  if (pathname === "/") {
    return buildHomeMarkdown();
  }

  if (pathname === "/models") {
    return buildModelsIndexMarkdown();
  }

  if (pathname === "/blog") {
    return await buildBlogIndexMarkdown();
  }

  if (pathname.startsWith(MODELS_PREFIX)) {
    return buildModelsSlugMarkdown(pathname.slice(MODELS_PREFIX.length));
  }

  if (pathname.startsWith(BLOG_PREFIX)) {
    return await buildBlogPostMarkdown(pathname.slice(BLOG_PREFIX.length));
  }

  return null;
};
