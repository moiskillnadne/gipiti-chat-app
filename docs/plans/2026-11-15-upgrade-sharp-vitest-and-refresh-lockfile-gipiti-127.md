---
date: 2026-11-15
status: done
branch: chore/gipiti-127-sharp-vitest-lockfile
issue: GIPITI-127
---

# Upgrade sharp and vitest, refresh the lockfile (GIPITI-127)

## Goal

Clear the advisories that need no API change: two small bumps (`sharp`, `vitest`) and a refresh of
packages whose caret ranges were still resolved to their lowest version in the lockfile. Remove the
deprecated `@types/mathjs` stub (mathjs 15 ships its own types).

`sharp` 0.34 → 0.35 is a 0.x minor, so it can break. Its changelog lists: Node >= 20.9 (the project
runs Node 22), no `install` script, new AVIF tuning, `limitInputChannels` default of 5, and the
removal of `failOnError`, `paletteBitDepth`, old `sharpen` properties and the `jp2k` format name.
The app uses none of these: only `metadata`, `resize`, `composite`, `ensureAlpha`, `png`, `jpeg`
and `toBuffer`.

The three modules that call `sharp` had no tests, so tests come first and are run on the old
version before the upgrade.

## Files

- `package.json`:
  - `sharp` ^0.34.5 → ^0.35.5; `vitest` ^4.0.18 → ^4.1.12 (the `V4` dist-tag, same major);
  - `@types/mathjs` removed;
  - ranges raised to the refreshed versions: `js-yaml` ^5.5.0, `postcss` ^8.5.33,
    `@tailwindcss/postcss` and `tailwindcss` ^4.3.5, `mammoth` ^1.13.0,
    `baseline-browser-mapping` ^2.11.37, `@tailwindcss/typography` ^0.5.20, `docx` ^9.15.4.
- `pnpm-lock.yaml`: regenerated. Two transitive packages are refreshed inside the ranges their
  parents already declare: `@xmldom/xmldom` 0.8.13 → 0.8.15 (under `mammoth`) and `nanoid` 3.x →
  3.3.20. `tar` leaves the tree with the Tailwind upgrade. `sharp` is now a single version shared
  with `next`.
- `lib/ai/__tests__/watermark.test.ts` (new): format and size are kept for PNG and JPEG, the logo
  is drawn in the bottom-right corner only, a non-image input is returned unchanged.
- `lib/ai/__tests__/document-images.test.ts` (new): `resolvePdfImages` and `resolveDocxImages`
  keep JPEG, convert other formats to PNG, downscale to the maximum dimension, and omit images
  that cannot be fetched or decoded.
- `lib/ai/__tests__/docx-round-trip.test.ts` (new): a `.docx` built by the app's generator is read
  back by the app's extractor with its heading, bold text, list, table and image intact. Covers
  `docx`, `mammoth` and `@xmldom/xmldom` together.

## Order of work

1. Write the `sharp` tests and run them on 0.34.5 (they pass: this is the baseline).
2. Bump `sharp` and `vitest`, remove `@types/mathjs`, `pnpm install`.
3. `pnpm update` for the eight packages listed above, within their ranges.
4. Refresh `@xmldom/xmldom` and `nanoid` through a temporary `pnpm.overrides` entry that is removed
   again once the lockfile holds the new versions.
5. Add the round-trip test.
6. Build, lint, typecheck, unit tests, `pnpm audit`.
7. Look at the pages in a browser: Tailwind 4.1 → 4.3 regenerates every stylesheet.

## Risks

- A blanket `pnpm update --depth` rewrites the ranges of unrelated direct dependencies. It was
  tried and reverted; step 4 is the scoped replacement.
- Tailwind 4.3 could change generated CSS. Checked visually in step 7.
- `sharp` 0.35 no longer builds from source on install. Vercel and CI use the prebuilt binaries.
- The round-trip test was written after the upgrade, so it has no run on the old versions.

## Verification

- `pnpm audit`: 142 → 103 advisories (critical 5 → 3, high 66 → 32). None left for `sharp`, `tar`,
  `js-yaml`, `postcss`, `@xmldom/xmldom`, `nanoid`, `baseline-browser-mapping`, or `vitest` 4.x.
- Still reported, out of scope here:
  - `vitest` and `@vitest/mocker` 3.2.4, nested under `ultracite` (GIPITI-182);
  - `postcss-selector-parser` 6.0.10, pinned exactly by `@tailwindcss/typography`.
- `pnpm exec next build`, `pnpm lint`, `pnpm typecheck`, `pnpm vitest run --exclude ".claude/**"`.
- Production build in a browser: landing, `/models` and a blog article render as before; the
  article's cover goes through the image optimiser, which now runs on `sharp` 0.35.5.
- Dev server: the chat and the balance page render as before.
