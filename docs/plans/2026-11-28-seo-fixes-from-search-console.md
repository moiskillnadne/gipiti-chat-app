---
date: 2026-11-28
status: done
branch: fix/seo-gsc-fixes
---

# SEO fixes from the Search Console review

## Goal

A review of Search Console for gipiti.ru (30 Aug – 27 Nov 2026) found four things
the code can fix:

1. Article titles carry the brand twice: the frontmatter title ends with
   «— GIPITI» and the page template adds «| Блог GIPITI». The same suffix is in
   the H1, the blog cards and the JSON-LD headline. This change removes the
   duplicate and nothing more: six of the seven titles are still longer than the
   ~60 characters Google shows (67 to 96 with « | GIPITI»). Shortening them is a
   rewrite of the headings and is left to the owner.
2. Nothing links to the model pages except `/models`: the seven articles have no
   link to `/models/*`, and the footer links only to the catalog. Google does not
   know `/models/text` and `/models/video-generation`, live since 4 July.
3. The sitemap lists `/login` and `/register` at priority 0.8, next to the pages
   that should rank.
4. `/forgot-password` is indexed under the default site title; it and
   `/reset-password` have no metadata of their own.

## Files that change

- `content/blog/*.md` (7 files): drop the « — GIPITI» suffix from `title`; add
  links to model and section pages where the text first names a model; set
  `updated`. Slugs and file names stay (the URLs are indexed).
- `app/(marketing)/blog/[slug]/page.tsx`: title `<title> | GIPITI`; JSON-LD
  `dateModified` and Open Graph `modifiedTime` from `updated`.
- `lib/blog/schema.ts`, `lib/blog/posts.ts`: an optional `updated` date; the
  sitemap entry of an article carries `updated ?? date`.
- `components/landing/landing-footer.tsx`: a fourth column with the four
  catalog sections.
- `lib/marketing/landing-nav-links.ts`: the four links of that column. They are
  written out here and not read from `catalogSections`, because the footer is a
  client component and `models-catalog.ts` is about a thousand lines of copy
  that must stay out of the client bundle. A test keeps the two in step.
- `app/sitemap.ts`: remove `/login` and `/register`.
- `app/(auth)/forgot-password/layout.tsx` (new) and
  `app/(auth)/reset-password/page.tsx`: a title and `robots: noindex`.
- Tests (new): `lib/blog/__tests__/content.test.ts` (every `/models/...` link in
  an article points at an existing landing or section; no title ends with the
  brand; a guide links to at least one model page), the schema tests for
  `updated`, and `lib/marketing/__tests__/landing-nav-links.test.ts`.

## Order of work

1. Titles (frontmatter + template).
2. Footer column.
3. Links in the articles + the test that guards them.
4. Sitemap.
5. Metadata of the two password pages.
6. `pnpm check`, then a look at the pages in a local build.
7. After the review: the `updated` date, link targets, stricter tests.

## Where a family name links

An anchor that names a family without a version goes to the page a reader of
that sentence expects: «Flux» to `/models/flux-3-image` (the flagship, not the
light Klein), «Banana» to `/models/nano-banana` (the page Google already shows
for «нано банана»), «Claude», «ChatGPT» and «Gemini» to the newest landing of
the family. A named version goes to its own landing.

## Not in this change

- `lastModified` for model pages in the sitemap. The landings have no date of
  their own, and a build date on every entry is a signal Google learns to
  ignore. It also would not help: the pages Google is missing are unknown to
  it, and `lastModified` only schedules a recrawl of pages it already knows.
  The footer links are the fix for discovery. The articles are the opposite
  case (known to Google and edited today), which is why they get `updated`.
- `/login` and `/register` stay indexable (`index: true` and the canonical were
  set on purpose); they only leave the sitemap.
- Shorter article titles, rewriting article content, new articles, deeper model
  pages (points 5 and 6 of the review).
- How links in an article open. Streamdown renders every link, internal ones
  included, with `target="_blank"` and `rel="noreferrer"`. The links are
  followable, so search is not affected, but a reader leaves the article tab.
  This was so before the change; it now applies to about 35 more links.

## Risks

- A link in an article to a model that is later removed would 404
  (`dynamicParams = false`). The new test fails the build of such a change.
- The footer is shared by the landing, the catalog and the blog: the fourth
  column must not break the layout on a narrow screen.
- A changed title changes what is shown in the results for the seven articles.
  The words in front stay the same; only the tail is shorter.

## Verification

- `pnpm check` (typecheck, lint, unit tests, build).
- Local build: `<title>`, the H1 and the JSON-LD of an article; the footer at
  desktop and mobile width; `robots` of `/forgot-password` and
  `/reset-password`; `/sitemap.xml` without `/login` and `/register`.
- After the deploy, by the owner in Search Console (the service account is
  read-only): resubmit the sitemap, request indexing of `/models/text` and
  `/models/video-generation`.
