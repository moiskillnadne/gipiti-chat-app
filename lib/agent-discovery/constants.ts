/**
 * Shared constants for the machine-readable discovery surface — the set of
 * endpoints and headers that let an AI agent work out what this site offers
 * without scraping the rendered HTML:
 *
 *  - `Link` response headers (RFC 8288), configured in `next.config.ts`
 *  - `/.well-known/api-catalog` (RFC 9727) + `/openapi.json`
 *  - `/.well-known/agent-skills/index.json` (Agent Skills Discovery 0.2.0)
 *  - Markdown content negotiation on the public pages
 *  - `Content-Signal` directives in `/robots.txt`
 */

/** Canonical origin. `www` is redirected to the apex host in `next.config.ts`. */
export const SITE_ORIGIN = "https://gipiti.ru";

export const absoluteUrl = (path: string): string => `${SITE_ORIGIN}${path}`;

/**
 * AI usage preferences published in `robots.txt`
 * (contentsignals.org, draft-romm-aipref-contentsignals).
 *
 *  - `search=yes`     — indexing for classic search results is welcome
 *  - `ai-input=yes`   — assistants may retrieve pages to answer a user's
 *                       question, provided they link back
 *  - `ai-train=no`    — the content may not be used to train models
 *
 * These are a stated preference, not an access control; crawlers are blocked
 * from private areas with `Disallow` instead.
 */
export const CONTENT_SIGNALS = "search=yes, ai-input=yes, ai-train=no";

/**
 * Rough token count for the `x-markdown-tokens` response header.
 *
 * There is no tokenizer in this project (`tokenlens` only models context
 * windows and pricing), and pulling one in to label a marketing page is not
 * worth the bundle. Agents use this header to budget a fetch, so an estimate
 * is useful as long as it is not wildly low: ~3 characters per token is a
 * conservative figure for Cyrillic text, which tokenizes less densely than
 * English.
 */
export const estimateTokenCount = (text: string): number =>
  Math.ceil(text.length / 3);
