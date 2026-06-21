/**
 * Manual switch for the public blog index (`/blog` — the article list page).
 *
 * While `false`:
 *  - `/blog` returns 404 (the browsable list is hidden);
 *  - the `/blog` URL is dropped from the sitemap;
 *  - each article's footer link points to the home page instead of `/blog`.
 *
 * Individual article pages (`/blog/<slug>`) stay live, indexable and listed in
 * the sitemap regardless of this flag, so direct links and SEO are unaffected.
 *
 * To launch the index once there are enough articles: flip this to `true` and
 * redeploy. No other change is required.
 */
export const IS_BLOG_INDEX_ENABLED = true;
