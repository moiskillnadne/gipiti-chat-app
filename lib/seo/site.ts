/**
 * Absolute production origin used to build canonical URLs.
 *
 * Hardcoded rather than derived from `NEXT_PUBLIC_APP_URL` on purpose: a
 * canonical must always name the production URL, so preview deployments must
 * not emit canonicals pointing at themselves.
 */
export const SITE_URL = "https://gipiti.ru";

/**
 * Builds the canonical URL for an app path.
 *
 * @param path - Path beginning with "/", or "" for the site root.
 */
export const canonicalUrl = (path: string): string => `${SITE_URL}${path}`;
