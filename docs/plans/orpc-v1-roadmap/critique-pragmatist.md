# Critique: pragmatism, structure, executability

Target: `draft-plan.md` (678 lines, 13 phases). Lens: a solo developer running a production money app.
[OBS] = I checked it myself in the repo or in installed packages. [INF] = my inference.

## Verdict

The API, auth and versioning design is sound. The plan's main weakness is the order of work. Before the first mobile-usable endpoint (Phase 5), the developer has to finish five phases:
- a very large characterization suite;
- eight fix PRs;
- a Zod 4 migration;
- an atomic move of the whole repo into `src/`;
- seven server-tree move PRs.

That is roughly 25 of about 55 PRs, with no mobile value yet. The plan also moves most files twice (root → `src/lib` → final home), and the migrations folder twice. Each migrations move is done by hand and risks the production deploy. One of its definitions of done cannot be met: the characterization assertion files cannot stay byte-identical while `vi.mock` names paths that move. Two parts of the design add cost for a solo developer that the owner's goals do not require: DB-synced preferences, and a contract file plus a procedure file for every one of about 50 path folders. The new tracing key for the chat route is written in a form the Next docs suggest may be read as a glob character class.

None of this is fatal. The fix is to reorder the work so that new code is written in its final place first, legacy code moves only when a domain is ported, and the restructure-only phases come off the mobile critical path.

## Findings

### F1 [major] Order of work: mobile value is blocked behind restructure-only phases
- **Section**: Order of work, "Mobile unblock path" (`draft-plan.md:616`).
- **Problem**: "Phases 3-4 must precede 5 so new code is born in its final place." Together with Phases 0, 1 and 2, this means the first mobile-usable endpoint arrives after about 25 PRs, including the riskiest mechanical ones. The risk table says "mobile path can stop after Phase 8" (`:638`). That is not true, because Phases 0-4 are hard prerequisites. Mass moves done first also guarantee conflicts with every branch opened in the meantime.
- **Evidence**: `draft-plan.md:510-557` and `:616`. [OBS] `feat/gipiti-28-mcp-integrations-cw6f0r` still has 18 commits that are not in `origin/main` (`git cherry`), last commit 2026-11-14.
- **Fix**: let new code be born in its final place without moving old code first.
  - Create `src/server/api/**` (or root `server/`) in Phase 5. It imports today's `@/lib/*` modules.
  - During the transition, use tsconfig `paths` with a fallback, `"@/*": ["./src/*", "./*"]`. Turbopack support for fallback arrays is UNVERIFIED and needs a 30-minute spike. Alternatively, use a second alias `@server/*`.
  - Move each legacy domain (`lib/billing`, `lib/auth`, `chat/_lib`, …) into `src/server/modules/<d>` in the PR stack that ports that domain to v1, as a separate move commit.
  - Do the root `app/` → `src/app` move last or near the end, as one atomic commit, when very little is left at the root.
  - New mobile path: 0 (slim) → 1 (security fixes only) → 5 → 6 → 7 → 8.

### F2 [major] Most files move twice, and the migrations folder moves twice by hand
- **Section**: Phase 3, Phase 4, Phase 11, Phase 4 note (`:278`, `:547-555`).
- **Problem**: Phase 3 moves everything to `src/` (for example `lib/billing` → `src/lib/billing`). Phase 4 moves the server half again, and Phase 11 moves the client half again. Each file pays the cost twice: git-blame breaks, open branches rebase twice, and the docs, `.claude/agents/review.md` and the protect hook are edited twice.
- **The migrations case is worse.** `lib/db/migrations` moves in Phase 3 and again in Phase 4a, by hand each time, because the protect hook blocks agents (`:548`, `:553`). The production build runs the migrator by path: `package.json:7` is `"build": "tsx lib/db/migrate && next build"` [OBS]. So the deploy path changes twice.
- **Fix**: move every file directly to its final home, once.
  - For the db, go straight to `src/server/db` in a single manual PR, with its own preview deploy.
  - If an atomic `src/` move is kept, limit it to `app/`, `proxy.ts` and `instrumentation.ts`. Leave `lib/ components/ hooks/ contexts/` where they are until each moves once to its final layer.

### F3 [major] The "byte-identical characterization tests" definition of done cannot be met
- **Section**: D17 (`:65`), Phase 3-4 verification (`:549`, `:555`, `:650`).
- **Problem**: the `targets.ts` indirection covers the imports of handlers. It does not cover module mocks. The existing tests mock by alias path: `vi.mock("@/lib/db/connection")` appears 10 times, `vi.mock("@/app/(auth)/auth")` 3 times, and there are many `@/lib/billing/*` and `@/lib/ai/*` mocks [OBS]. Vitest hoists `vi.mock` above imports, so it cannot take a path re-exported from `targets.ts`.
  - Evidence: `node_modules/vitest/dist/index.d.ts:422-423`: "hoisted to the top of the file, so you don't have access to variables declared in the global file scope".
  - Consequence: in Phase 4a (db → `src/server/db`) and 4f (NextAuth), either the assertion files change, which breaks the DoD, or the old mock paths stop matching. In the second case the real `db` connection module loads in unit tests [INF].
- **Fix**: keep the mock paths stable through the move, not the assertion bytes.
  - Option A: put every mocked module path in `targets.ts` as constants and use `vi.mock(import(targets.DB_CONNECTION))`. Whether this form allows a non-literal path is UNVERIFIED. The overload `mock<T>(module: Promise<T>)` exists at `index.d.ts:429`.
  - Option B (simpler): change the DoD to "`git diff -M` of `tests/characterization/**` contains only specifier lines".
  - Also add a guard: a `vitest.setup` check that fails if a `vi.mock` target does not resolve.

### F4 [major] Phase 0 is too large, and its value for pure moves is low
- **Section**: Phase 0, Testing "What is written when" (`:475`).
- **Problem**: Phase 0 asks for characterization tests of about 15 areas before anything else ships: the webhook, 6 auth actions, chat POST with stream framing, intents, subscription, history, vote, projects, files, prompts, transactions, usage and me. Today 4 of 37 routes are tested. That is weeks of work, and Phase 12 deletes these tests together with the legacy routes (`:485`). For path-only moves, `tsc` plus the existing 51 test files already catch most breakage. The tests pay off only where behaviour is re-implemented.
- **Fix**: keep the money and security characterization (CloudPayments webhook, auth actions, chat POST guards and charge). Write every other test as a v1 procedure or HTTP test when that endpoint is ported, because those tests outlive the legacy code. Keep 0a and 0b (vitest excludes, CI typecheck) because they are cheap.

### F5 [major] The new tracing key for the chat route may silently not match
- **Section**: Phase 8 (`:585`), Risks (`:627`).
- **Problem**: the plan adds `outputFileTracingIncludes["/api/v1/chats/[chatId]/turns"]`. The Next docs say the keys are picomatch globs (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md:93`), and their dynamic-segment example escapes the brackets: `'/api/login/\\[\\[\\.\\.\\.slug\\]\\]'` (`:105`). Unescaped, `[chatId]` is a character class. Line 114 of the same doc shows an unescaped `/products/[id]`, so the docs contradict each other (UNVERIFIED which form works). If the key does not match, the watermark logo and the Roboto PDF fonts are missing only in production (`next.config.ts:87-93`, `lib/ai/pdf-fonts.ts:18`, `lib/ai/watermark.ts:10`). The planned "tracing-includes test reading `next.config.ts`" checks the config text, not the outcome, so it passes either way.
- **Fix**: use the escaped key, or `"/api/v1/chats/**"`. In `scripts/check.ts` after `next build`, assert that `.next/server/app/api/v1/chats/[chatId]/turns/route.js.nft.json` lists the 4 fonts and the icon. Keep the manual PDF and watermark turn on the preview.

### F6 [major] DB-persisted preferences (D15, Phase 10) is scope creep on the mobile path
- **Section**: D15 (`:63`), Phase 10 (`:596-599`), mobile unblock path (`:616`).
- **Problem**: the plan's own research says the chat POST already carries every setting in its body and the chat route reads no cookies (api-surface decision 5). So mobile needs nothing from the server here. Phase 10 adds a lot to get there:
  - migration 0048;
  - jsonb merge semantics;
  - a one-time cookie import;
  - debounced optimistic sync in 4 providers;
  - a server-caller read in the chat layout on every chat navigation;
  - and a user-visible behaviour change (Q4).

  The owner's goal is "nothing depends on server actions". That is met more cheaply.
- **Fix**: replace the 11 `save*AsCookie` actions with client-side cookie writes, a small `shared/lib/preferences-cookie.ts` with the same names and the same zod validation. The RSC layout keeps reading `cookies()`. Mobile stores its preferences on the device. Take Phase 10 off the mobile path and make `/me/preferences` an optional additive endpoint later.

### F7 [major] Too much ceremony per path for a solo developer, and no home for shared DTOs
- **Section**: D3/D4, `src/server/` tree (`:105-180`).
- **Problem**: about 50 path folders, each with `contract.ts` + `procedure.ts` (+ `mappers.ts`) + `__tests__/`, add up to roughly 150-200 files before any logic. The data model is also split across folders. The chat resource alone spans `chats/`, `chats/[chatId]/`, `messages/`, `messages/[messageId]/vote/` and `votes/`, and all of them need the same `Chat`, `Message` and `Money` schemas. The plan does not say where the version-scoped DTO schemas and the shared mappers live. `_kit` holds only errors and pagination (`:114-115`), and `contract.ts` "may import only each other" (`:101`). This is also exactly the place where v2 diverges.
  - Router-first (the owner's `admin-dashboard` style) was rejected because it "leaks the server type graph". But a type-only `RouterClient<typeof router>` import is erased at build. The frozen artefact the plan needs is `openapi.snapshot.json` anyway, and native clients will consume that.
- **Fix**:
  - Keep URL mirroring at the resource level: one folder per resource node, with one `contract.ts` / `router.ts` per folder covering all its methods. That is what the plan already does for collections, so it should say so explicitly.
  - Add `src/server/api/v1/_schemas/` (DTOs: `chat.ts`, `message.ts`, `money.ts`, `me.ts`) and `v1/_mappers/`, both versioned with v1.
  - Allow small endpoints to collapse `contract.ts`/`procedure.ts` into the parent folder.
  - If contract-first stays, justify it by the Expo package, not by bundle leakage.

### F8 [major] The FSD layer rule conflicts with existing RSC data fetching, and the cost is not planned
- **Section**: `src/app` rule (`:231`), dependency table (`:96-103`), Phase 11e.
- **Problem**: `src/client` may not import `src/server`, and `page.tsx` does all the loading. But several nested Server Components query the DB today [OBS]:
  - `app/subscription/_components/plan-card.tsx` (`get-by-id`, flags);
  - `transaction-history-card.tsx` (`lib/billing/spend.ts`, which imports `db`);
  - `manage/_components/payment-history-card.tsx` (`lib/billing/payment-history.ts` → `db`);
  - `tariff-card.tsx` (`lib/subscription/get-latest-subscription.ts` → `db`).

  Lifting all of that into `page.tsx` is a behaviour refactor of the billing pages. Phase 11 labels it "[R] pure restructuring … no behaviour changes", which it is not. It also rules out future per-card `<Suspense>` streaming.
- **Fix**:
  - Do the data-lift of these four cards in Phase 7d (the billing-reads port), labelled [B] and with tests, not in Phase 11.
  - Alternatively, allow a `src/client/**/api/*.server.ts` segment that may import only `@/server/api/_kit/server-caller`, and add it to the boundary test.
  - Either way, state the rule before Phase 11.

### F9 [minor] The barrel and `index.ts` policy is decided after the code has moved
- **Section**: Slice segments (`:202`), S13 (`:542`).
- **Problem**: every slice gets an `index.ts`, and its tree-shaking is measured only after 11b. If a slice index mixes `"use client"` components with server-safe helpers, server-only or heavy modules can land in client chunks. By then the barrels already exist everywhere.
- **Fix**: run S13 on one slice before 11a. If the result is bad, use FSD's "no index, import from the segment" style.

### F10 [minor] The feature list is too granular
- **Section**: `src/client/features` (`:192-195`).
- **Problem**: there are 26 features, and several are a single button or hook: `stop-generation`, `resume-stream`, `download-media`, `spend-warning`, `web-search-toggle`. Same-layer cross-slice rules then force awkward composition in widgets.
- **Fix**: start coarse (`chat-composer`, `auth`, `billing-actions`, `projects`, `prompts`) and split only when a slice gets two consumers.

### F11 [minor] The client imports from `src/server`, which undermines the clarity goal
- **Section**: D4, the adaptation table (`:206`).
- **Problem**: the owner's complaint is that it is hard to tell client from server. Under the plan, `entities/*/model` and `shared/api` import `@/server/api/v1/contract`, and every `contract.ts` sits next to a `procedure.ts` that the client must not touch. Only the architecture test stops an accidental `procedure.ts` import.
- **Fix**: either put contracts in `src/contract/v1/<same path>` (the research proposal), or re-export them once from `src/client/shared/api/contract.ts` so that client code never spells `@/server`.

### F12 [minor] In-process calls run every HTTP middleware
- **Section**: D14, `_kit/middleware` (`:116-123`), versioning item 7.
- **Problem**: only client-version is said to skip in-process calls. So `rate-limit`, `activity` and `csrf` would also run on RSC page renders through the server caller, and `InitialContext` requires a `request: Request` that RSC must synthesize from `headers()`.
- **Fix**: give each middleware a per-transport table (http or in-process), and test it in `_kit/__tests__`.

### F13 [minor] The cookie-path `token_version` check adds a DB read to every web request
- **Section**: Auth design, resolution order (`:368`).
- **Problem**: today the web session is JWT-only. Checking `ver` against `User.token_version` on the cookie path adds a query to every authenticated page render and route call, across all 42 `auth()` call sites. This trade-off goes unmentioned and is not measured.
- **Fix**: say so explicitly, and either cache the value briefly (the Redis cache already considered for bearer), or check it only on mutations and on `/me`.

### F14 [minor] There are three mechanisms for one versioning guarantee
- **Section**: Versioning item 9, Phase 13.
- **Problem**: the plan has a snapshot test, a hand-written `frozen-surface.test.ts` and an `oasdiff` CI job. `deprecation.ts` and `client-version.ts` are built in Phase 5 with no consumer.
- **Fix**: keep the snapshot test (cheap) and `oasdiff` from GA. Drop the custom frozen-surface comparer. Build `deprecation.ts` when v2 or the first deprecation exists. Keep `client-version` and `/config` before the first mobile build, as planned.

### F15 [minor] The legacy-removal gate relies on log retention, and "one release" is undefined
- **Section**: server-actions wrapper rule (`:450`), Phase 12.
- **Problem**: the gate is "zero `[legacy-*]` `console.warn` hits for 14 days (Vercel logs)", but how long Vercel keeps runtime logs on this plan is UNVERIFIED and may be shorter than 14 days. The project deploys continuously, so "one release" is not defined.
- **Fix**: count hits in Redis (`INCR legacy:<name>:<yyyy-mm-dd>`) or in a DB table, and define the window as calendar days after the web-switch PR is deployed.

### F16 [minor] Verification commands diff against a stale local `main`
- **Section**: Verification for 3 and 4 (`:650`).
- **Problem**: `git diff --stat main -- tests/characterization`. Local `main` is at 2026-10-18 (`a210eda`), while `origin/main` is at 2026-11-15 (`42104bb`) [OBS].
- **Fix**: use `origin/main...HEAD` everywhere.

### F17 [minor] Phase steps that are vague or internally inconsistent
- 7(iii) is literally "nothing else" (`:571`). Either delete it or define it as "wrapper + hit counter deployed".
- 6a is labelled "behaviour-neutral for web", yet it puts the welcome grant in the same transaction as the user insert (`:565`). That is a behaviour change, so give it its own PR with a test.
- 1h makes `GET /api/payment/status` stop writing and relies on "cron expires intents". But the cron is unscheduled, and scheduling it is open question Q10 (`:675`). Make 1c a hard prerequisite of 1h, and check the Vercel plan's cron limits (UNVERIFIED).
- Rule inconsistency: webhooks and cron sit in `src/server/{webhooks,cron}`, not under a URL mirror of `/api/webhooks` and `/api/cron`. State the rule as "`api/<version>/` mirrors versioned URLs; everything else is organised by role".

### F18 [minor] The plan's size does not fit the repo's plan workflow
- **Section**: whole document vs CLAUDE.md "Plans".
- **Problem**: CLAUDE.md requires updating the plan file in the same commit when the implementation departs from it, and setting `status: done`. A 678-line, 13-phase single plan would be edited in almost every PR and would never reach `done`. The plan also never says where it will be saved, or how it maps to Linear issues (CLAUDE.md: Linear team `GIPITI`).
- **Fix**: save an umbrella roadmap at `docs/plans/<date>-orpc-v1-roadmap.md` with the decisions and the phase list, plus one plan file and one Linear issue per phase.

## Unverified assumptions the plan depends on

- **Turbopack and tsconfig paths**: Turbopack resolves `paths` fallback arrays (needed only for my F1 fix) and overlapping aliases the way tsc does.
- **Next.js behaviour**:
  - `outputFileTracingIncludes` matches unescaped `[param]` keys (F5).
  - Specific `route.ts` files win over `api/v1/[[...rest]]` without 405s (S3).
  - `src/client/pages` is not treated as a Pages Router (S9).
  - Vercel's upload body cap is sufficient for 10 MiB (S4).
- **Vitest**: `vi.mock(import(x))` accepts a non-literal specifier (F3 option A).
- **Zod 4 upgrade**: it is truly required. oRPC 1.15.7 schemas are Standard Schema (`@orpc/contract/dist/shared/contract.TuRtB1Ca.d.mts:6`), and zod 3.25.76 implements `~standard` (`node_modules/zod/v3/types.d.ts:54`) and ships `zod/v4`. Only the JSON-schema converter's Zod-version support is unknown, so the 26-file upgrade (PR 2a) may not belong on the critical path. Do S1 first, and upgrade only if the converter forces it.
- **oRPC 1.16.2 APIs**: `OpenAPIHandler`, `OpenAPIGenerator`, `OpenAPILink` and `ResponseHeadersPlugin` are not installed anywhere locally.
- **In-process calls**: `createRouterClient` with a synthesized `Request` behaves correctly in RSC (S5).
- **Preview builds**: they run the migrator (`package.json:7`) against which database? If preview shares the production `POSTGRES_URL`, then "preview deploy runs migrator before merge" (Risks, `:626`) applies migrations 0046-0048 to production before review is finished.
- **Vercel platform**: runtime log retention of at least 14 days, cron limits for scheduling a fourth cron, and Skew Protection availability.
- **AI SDK on mobile**: `useChat` works in React Native against the raw turn route (S10 tests this only in Node).

## Missing from the plan

- A home for version-scoped shared DTO schemas and mappers (F7).
- A rule for nested data-fetching Server Components under FSD (F8).
- An explicit effort estimate per phase, and a cut line ("minimum mobile beta = phases X-Y").
- A rollback note for the manual migrations-folder move if a preview build fails after merge.
- Updating `.claude/skills/*`, the memory notes and the `repo-recipes` references that name old paths. Only `CLAUDE.md`, `.claude/agents/review.md`, `.cursor/rules` and `docs/agent-discovery.md` are listed (`:547`).
- How `app-pr248` and `app-wt-activity` (sibling worktrees outside `.claude/`, both clean, branches already merged per `git cherry`) are handled. Pruning them before Phase 3 should be added to the owner actions.
