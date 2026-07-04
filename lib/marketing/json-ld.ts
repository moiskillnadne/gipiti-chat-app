/**
 * Escapes `<` so a JSON-LD payload cannot terminate the script tag early.
 * Rendered via a native <script> (not next/script) so the markup is
 * server-rendered into the static HTML for SEO — same approach as the blog
 * article page.
 */
export const toJsonLdString = (value: object): string =>
  JSON.stringify(value).replace(/</g, "\\u003c");
