/**
 * Which public paths have a Markdown representation.
 *
 * Deliberately dependency-free: `proxy.ts` imports this to decide whether to
 * rewrite a request, and must not pull in the filesystem-backed blog loader
 * that the Markdown builders use.
 */

export const BLOG_PREFIX = "/blog/";
export const MODELS_PREFIX = "/models/";

/** A path directly under `prefix`, with no further segments. */
const isNestedUnder = (pathname: string, prefix: string): boolean =>
  pathname.startsWith(prefix) && !pathname.slice(prefix.length).includes("/");

/**
 * Paths that answer `Accept: text/markdown` with Markdown. Everything else
 * keeps returning HTML — a partial Markdown surface is better than none, and
 * unsupported paths degrade to the HTML they already served.
 *
 * `/blog/preview` is excluded: it is the secret-gated author tool, not content.
 */
export const isMarkdownNegotiablePath = (pathname: string): boolean => {
  if (pathname === "/" || pathname === "/models" || pathname === "/blog") {
    return true;
  }

  if (pathname === "/blog/preview") {
    return false;
  }

  return (
    isNestedUnder(pathname, MODELS_PREFIX) ||
    isNestedUnder(pathname, BLOG_PREFIX)
  );
};
