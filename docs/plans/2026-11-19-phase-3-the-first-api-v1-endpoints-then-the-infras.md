---
date: 2026-11-19
status: done
branch: chore/gipiti-233-move-tooling
issue: GIPITI-233
---

# Phase 3: the first /api/v1 endpoints, then the infrastructure move to server/

## Context

Phases 0 to 2 prepared the ground: tests that survive file moves, the security fixes, and verified answers about oRPC (`docs/plans/orpc-v1-roadmap/spike-findings.md`). Phase 3 of the roadmap (`docs/plans/2026-11-15-orpc-v1-roadmap.md`) puts the first real API code on `main` and starts the `server/` folder.

The roadmap orders it as "3a: move the server code, then 3b: build the API kit". Research for this plan showed that the order can be turned around and the move made much smaller:

- **3b does not need 3a.** Code under `server/api/` may import `lib/**`; no rule forbids it. The one import that would break a rule, `auth` from `app/(auth)/auth`, is avoided by having the route file hand the session getter to the handler.
- **The roadmap's 3a touches about 330 files** (94 of them `vi.mock` specifiers) in one PR, and three of its targets do not work as written: `lib/ai/models.ts` in `core/` breaks the core rule (it imports `@ai-sdk/*` types), the query folders are claimed by two phases with two naming schemes, and `lib/constants.ts` needs a split, which is not a move.
- **None of the four first endpoints needs anything in `core/`.** Contracts define shapes; routers fill them from `lib/`.

Owner decisions taken for this plan (2026-11-18): 3b first, then a small 3a; the branch `feat/gipiti-28-mcp-integrations` is no longer needed; the agent moves the migrations folder, with a checksum check.

Outcome: four PRs. After them `/api/v1/config`, `/models`, `/plans`, `/me` and `/openapi.json` are live, and the database layer, Redis, rate limits and flags live under `server/`.

## Decisions for this phase

| # | Decision | Reason |
|---|---|---|
| P1 | Order: tooling, 3b, 3a-1, 3a-2. | Owner decision. The API is on the mobile path; the move is not. |
| P2 | 3a moves infrastructure only: `lib/db/{connection,schema,migrate,utils,unique-violation}.ts` and `lib/db/migrations` to `server/db`; `lib/redis.ts`, `lib/rate-limit.ts`, `lib/http/client-ip.ts`, `lib/api/handle-route-error.ts`, `lib/flags.ts`, `lib/cron/*` to `server/`. | These have one obvious home and no domain. |
| P3 | `lib/db/query/**` and `lib/db/queries-transactions.ts` stay where they are and move with their domains (users in 4a, chat in 5a, projects in 5b, prompts and quiz in 5c, billing and subscription in 5d, documents in 6a). | The mapping table already gives chat queries to 5a. Moving a domain's queries with its module is one move instead of two. |
| P4 | Nothing moves to `core/` in this phase. | No v1 contract needs it yet. `models.ts` needs a type split first. Each file moves when a contract first imports it. |
| P5 | The kit gets only the files the four endpoints use. Pagination, CSRF, client-version, rate-limit, activity, transport-policy, raw-route, server-caller and deprecation helpers are written in the phase that first needs them (4 to 6, 10). | The roadmap lists the whole kit for 3b; nothing in 3b would exercise those files. |
| P6 | The route file passes `auth` into the handler context (`getCookieSession`). `server/api/_kit/guards/principal.ts` imports nothing from `app/`. | The rule "server/ must not import app/" stays true without an allowlist entry. The indirection goes away in 4a, when the auth module moves under `server/`. |
| P7 | A request with an `Authorization` header gets 401 in this phase, cookie or not. | Decision D9: a bearer header is never ignored in favour of the cookie. Bearer verification arrives in 4d; until then the honest answer is "not accepted". |
| P8 | `/config` is public and holds nothing per user. Per-user switches (top-up enabled) are in `/me`. Client version fields exist and are `null` until Phase 10 adds the flags behind them. | `isTopupEnabled` is targeted per user and fails closed, so an anonymous answer would always be `false`. |
| P9 | `/api/v1/openapi.json` is served from the committed snapshot, by the catch-all route file. | No generator at runtime; the snapshot test already guarantees the file matches the code. Unlinked from agent discovery (owner decision Q3). |
| P10 | The characterization tests are taken out of Biome's import sorting, or, if an override cannot do that, the diff guard compares import statements regardless of order. | A move rewrites `@/lib/db/…` to `@/server/db/…`; re-sorting those lines is a token-order change and would fail the guard on three files. |

## Order of work

One Linear issue in team `GIPITI`; every commit references it. Each PR is from `origin/main` with base `main`.

### PR 1. Tooling for moves [B: tooling]

- **`scripts/codemods/rewrite-imports.ts`** plus `scripts/lib/` logic and a unit test: given `old path → new path` pairs, rewrite every specifier that resolves to a moved file (alias or relative; import and export declarations, `import()`, `typeof import()`, `vi.mock`, `vi.doMock`, `vi.importActual` and friends) to the `@/` form of the new path, and rewrite relative specifiers inside moved files that point at files left behind. Built on the TypeScript parser the repo already uses for this (`tests/architecture/import-graph.ts` `resolveSpecifier`, `scripts/lib/characterization-diff.ts` `moduleSpecifierOf`); no new dependency.
- **P10**: first try a `biome.jsonc` override that turns `assist.actions.source.organizeImports` off for `tests/characterization/**/*.test.ts`. If Biome 2.2.2 does not accept that in an override, change `tokenizeIgnoringSpecifiers` to sort import declarations before comparing, with tests for both directions (a reordered import passes; a changed assertion still fails).
- **Checks that would go quiet after a move**: `vitest.config.ts` coverage `include` gains `server/**` and `core/**`; `tests/architecture/rules.ts` `LEGACY_SERVER_CODE` gains `server/db/` next to `lib/db/`, so legacy client files stay limited to type-only imports of the database layer after it moves.

Verify: `pnpm check`; the codemod's own tests; a dry run of the 3a-1 mapping that prints the count of files it would touch.

### PR 2. Phase 3b: the kit and four endpoints [B, M]

New files (contract-first: `oc` in contracts, `implement(contract)` in routers, as verified in the spike):

| File | Role |
|---|---|
| `server/api/_kit/context.ts` | `InitialContext = { request, transport: "http" \| "in-process", requestId, getCookieSession }` |
| `server/api/_kit/errors.ts` | One table from `ChatSDKError` codes to `ORPCError`; anything else becomes the library's sanitised 500 |
| `server/api/_kit/common-errors.ts` | Contract-zone error map fragments: `UNAUTHORIZED`, `NOT_FOUND` |
| `server/api/_kit/open-enum.ts` | `openEnum(values)` = `z.string().meta({ description })`, typed `Known \| (string & {})` |
| `server/api/_kit/guards/principal.ts`, `require-auth.ts` | `resolvePrincipal` (P6, P7); `Principal = { userId, sessionId: null, via: "cookie" }` |
| `server/api/_kit/middleware.ts` | oRPC middlewares over the guards: optional principal, required principal |
| `server/api/_kit/create-handler.ts` | `OpenAPIHandler` → Next method handlers; writes the 404 envelope for `matched: false`; `X-Request-Id`; `Cache-Control: no-store`; serves the spec document it is given |
| `server/api/_kit/openapi.ts` | Generator factory: `ZodToJsonSchemaConverter`, bearer scheme omitted until 4d, error `code` as an open string through `customErrorResponseBodySchema` |
| `server/api/v1/contract.ts`, `router.ts`, `implementer.ts` | The aggregate contract (the only client entry later), the router, `implement(v1Contract).$context<InitialContext>()` |
| `server/api/v1/_schemas/{money,config,model,plan,me}.ts`, `_mappers/*` | Wire shapes and row-to-shape functions |
| `server/api/v1/{config,models,plans,me}/{contract,router}.ts` | One folder per resource |
| `server/api/v1/openapi.snapshot.json` | Committed; excluded from Biome in `biome.jsonc` |
| `app/api/v1/[[...rest]]/route.ts` | `createHandler(v1Router, { prefix: "/api/v1", getCookieSession: auth, openApiDocument })`; `maxDuration = 60` |
| `scripts/api-spec.ts` | `pnpm api:spec`: generates the document with sorted keys and writes the snapshot. Imports contracts only, so no database or env is needed |

Endpoints (all `GET`; money as `{ amountMinor, currencyCode }`; dates as ISO strings):

| Path | Auth | Answer | Reads |
|---|---|---|---|
| `/config` | none | `clients.{ios,android}.{minSupportedVersion,latestVersion,updateUrl}` (null for now), `features.signup`, `bonuses.{welcome,emailConfirm,onboardingQuiz}`, `topup.{minimum,maximum,presets}` | `lib/flags.ts` `isSignupEnabled`, `lib/billing/constants.ts`, `lib/billing/money.ts` |
| `/models` | none | `defaultModelId`, `items[]` of `{ id, name, description, provider (open enum), capabilities }` for models visible in the UI. Never `providerOptions` | `lib/ai/models.ts` `uiVisibleChatModels`, `DEFAULT_CHAT_MODEL` |
| `/plans` | optional | `items[]` of `{ code, displayName, billingPeriod (open enum), billingPeriodCount, prices[] }`; tester-only plans only for a tester, read from the `User` row | a new `listActiveSubscriptionsWithPrices` in `lib/billing/subscriptions.ts` (the catalog has no list function today), `lib/billing/tester-plans.ts` |
| `/me` | required | `id`, `email`, `emailVerified`, `isTester`, `hasActiveSubscription`, `balance` (both pools and total, or null), `features.topup` | `getUserById`, `lib/db/query/subscription/get-active-user-subscription.ts` (the period-aware one `auth.ts` uses), `getBalance`, `isTopupEnabled.run({ identify })` |
| `/openapi.json` | none | the committed snapshot | P9 |

Tests (unit, mocks by `@/` path):

- `server/api/_kit/__tests__/`: the error table; `resolvePrincipal` (header present → 401 even with a cookie; cookie → principal; neither → none); the handler (404 envelope for an unknown path and for a wrong method, `X-Request-Id`, no `Access-Control-Allow-Origin`, an unexpected error is a sanitised 500).
- `server/api/v1/__tests__/http.test.ts`: every endpoint through the real handler with the data modules mocked, including `/me` without a session (401 envelope), `/plans` for an anonymous caller, a regular user and a tester, and `/models` never containing `providerOptions`.
- `server/api/v1/__tests__/openapi-snapshot.test.ts`: the generated document equals the committed file; it is part of `pnpm check`.
- `lib/billing/__integration__/`: the new catalog query on real Postgres.
- `tests/architecture`: passes with no new allowlist entry.

Also in this PR: one sentence in `docs/agent-discovery.md` (the v1 spec exists at `/api/v1/openapi.json` and is deliberately not linked); `CLAUDE.md` (the `server/api` layout, `pnpm api:spec`). Spike S14 (does a generated Swift or Kotlin client decode an unknown open-enum value) is run once against the snapshot and recorded in `spike-findings.md`; if the toolchain is not at hand, it is recorded as not run.

Verify: `pnpm check`; `pnpm test:integration`; `pnpm api:spec && git diff --exit-code server/api/v1/openapi.snapshot.json`; on the preview, from a browser signed in to Vercel: `/api/v1/config` (200), `/api/v1/me` signed out (401 envelope), `/api/v1/does-not-exist` (404 envelope), `/api/v1/openapi.json`.

### PR 3. Phase 3a-1: the database layer to `server/db` [R]

- `git mv` of `lib/db/{connection,schema,migrate,utils,unique-violation}.ts`, `lib/db/__tests__/` and `lib/db/migrations/` to `server/db/`. For the 95 migration files: a checksum list before and after must be identical (`git ls-files -s` blob ids), and the diff must show them as pure renames.
- Specifiers by the codemod, then `pnpm format`. No logic edits.
- Path strings in the same commit, because each hard-codes the folder: `server/db/migrate.ts` (`migrationsFolder`), `package.json` `build` and `db:migrate`, `drizzle.config.ts`, `tests/integration/global-setup.ts`, `scripts/hooks/protected-paths.mjs` and its test (the protection must follow the folder), the comment in `vitest.integration.config.ts`.
- Docs: `CLAUDE.md`, `.claude/agents/review.md`, the memory notes that name `lib/db`.

Verify: `pnpm check`; `pnpm test:integration`; `pnpm db:migrate` against the local database reports nothing to apply; `pnpm check:characterization-diff origin/main` passes without the label; on the preview the build log shows the migration step succeeding and the app answers; `git diff --stat -M origin/main` lists the migrations as renames with no content change.

### PR 4. Phase 3a-2: Redis, limits, flags, cron auth to `server/` [R]

- `lib/redis.ts` → `server/integrations/redis/client.ts`; `lib/rate-limit.ts` and `lib/http/client-ip.ts` → `server/http/`; `lib/api/handle-route-error.ts` → `server/http/`; `lib/flags.ts` → `server/flags.ts`; `lib/cron/*` → `server/cron/`. Their tests move with them.
- Specifiers by the codemod (`proxy.ts` imports `./lib/flags` relatively), then `pnpm format`. `CLAUDE.md` updated.
- `lib/constants.ts` stays: its split into a server part and an isomorphic part is a change, not a move, and is planned with Phase 4.

Verify: as PR 3, without the migration checks; on the preview the login limit still answers "too many attempts" on the eleventh wrong password (the limiter module moved).

### After the PRs

Roadmap: Phase 3 status, the mapping table rows that P2 to P4 change, the Phase 3 file list reduced by P5, the stale lines found while planning (the hook does not block `git mv`; `package.json` line 14; the integration setup path; the non-existent `.claude/skills` and `targets.ts`; the dropped fallback stop path). This plan gets `status: done` with implementation notes.

## Risks

| Risk | Mitigation |
|---|---|
| A production deploy cannot find the migrations after PR 3 | The path is changed in the same commit in all five places; the preview build runs the same `build` script against its own Neon branch before merge; `vercel rollback` is the way back, and the migration state is untouched because no migration is added. |
| The codemod misses a specifier | `tsc`, the `mock-specifier` architecture rule (every `@/` mock must resolve) and `next build` each fail on a path that no longer exists. |
| A move PR changes behaviour by accident | No logic edits; the characterization guard runs without its bypass label; integration tests run on real Postgres. |
| Open PRs and worktrees conflict with the move | PRs 3 and 4 are opened only when no other PR is open, and merged the same day. |
| The mobile client cannot reach `/api/v1` | Production answers non-browser requests on some paths with Vercel's Security Checkpoint. The owner checks the Firewall settings; PR 2 can merge regardless, since no client calls v1 yet, but Phase 3 is not "ready for mobile" until that is settled. |
| The spec shape is frozen too early | Nothing calls v1 yet and the breaking-change gate starts in Phase 5, so shapes can still change in Phase 4. |
| S14 shows native clients cannot decode open enums as emitted | The registry variant (`x-known-values`) from the spike is added in `_kit/openapi.ts` without touching contracts. |

## Verification (whole phase)

- Every PR: `pnpm check` green locally and in CI; `pnpm test:integration` for PRs 2 and 3.
- `pnpm vitest run server/api tests/architecture`.
- `pnpm api:spec` leaves the snapshot unchanged.
- Preview checks listed under PRs 2, 3 and 4, from a browser signed in to Vercel.
- After each merge: the production deployment is READY and the runtime log has no errors in the following hour (Vercel MCP `list_deployments`, `get_runtime_logs`); `/api/health` answers 200.
- Rollback: revert the single PR; for a failed production deploy after PR 3, roll back to the previous deployment first.

## Implementation notes (2026-11-19)

Done: PR #294 (tooling and this plan), #295 (3b: the kit, `GET /api/v1/{config,models,plans,me,openapi.json}`), #296 (3a-1: the database layer in `server/db`), #297 (3a-2: Redis, rate limits, client IP, the route error handler, flags and the cron guard in `server/`). GIPITI-233.

Where the work departed from this plan:

- **P7 was narrowed.** The plan said every request with an `Authorization` header gets 401. As built, only a procedure that identifies the caller does that (`/plans`, `/me`). `/config`, `/models` and `/openapi.json` read no credentials, so a mobile client with a stale token can still fetch its config, which is where a forced update will be announced. Found by the review of #295; tests pin both sides.
- **`/models` resolves names and descriptions to text.** The registry stores translation keys (`grok47.name`) and the web resolves them in the browser; an API client has no dictionary. Found on the local production build, not foreseen in the plan.
- **HEAD is answered like GET, without the body.** No procedure is declared for HEAD, so the router alone answered 404 for a path that GET serves. Found by the review.
- **A 5xx that oRPC raises itself is replaced by the plain 500.** Its message ("Output validation failed") passed through the error table. A 5xx that a contract declares still passes. Found by the review.
- **`guards/require-auth.ts` was not written.** The required-principal check is a middleware in `_kit/middleware.ts` over `guards/principal.ts`; a second guard file had nothing of its own to hold.
- **S14 was not run.** The agent's environment refused to download and build `swift-openapi-generator`, and no generator is installed. Recorded as open item 4 in `spike-findings.md`, with what the document already shows: both open enums are emitted as `type: string` with no `enum` keyword.
- **P10 needed only the Biome override.** Turning import sorting off for `tests/characterization/**/*.test.ts` in `biome.jsonc` works in Biome 2.2.2, so the diff guard was not changed.
- **The codemod counts.** 3a-1: 235 specifiers in 140 files, 101 files moved (the dry run before #295 said 230 in 137). 3a-2: 47 specifiers in 31 files, 9 files moved. `proxy.ts` keeps relative imports, so its one changed line was put back by hand as `./server/flags`.
- **A folder entry in the move map needs the old folder gone.** After moving files of `lib/http` one by one the empty folder stayed and the codemod refused to run. Noted in `CLAUDE.md` under "Moving files".
- **PR 4 was prepared on top of PR 3 and opened after it merged**, as one cherry-picked commit on a fresh branch from `main`, so that no PR was ever based on another PR's branch.
- **The login-limit check on the preview for PR 4 was lighter than planned.** Not eleven wrong passwords, which spend the login budget of the owner's own address in the shared Upstash, but: `/api/health` reports Redis up and rate limiting enabled, one wrong-password sign-in goes through `authorize` and its limiter and answers "invalid credentials", the flags endpoint and a cron route answer 401 without their secrets, and a route that uses `handleRouteError` answers its 401. `rate-limit.ts` differs from the old file in import lines only, and its unit tests moved with it and pass.

Verified in production after #295 and #296: the deployment is READY, the build log shows `tsx server/db/migrate && next build` and `Migrations completed`, `/api/health` reports the database and Redis up, `/api/v1/config`, `/plans` and `/me` (signed in) answer 200, an unknown path answers the 404 envelope, and the runtime log of each deployment has no error records.

Left open:

- **The Vercel Firewall and `/api/v1/*`** (owner): production answers some non-browser requests with a challenge page. To settle before the first request from the mobile app.
- **S14**, before the first generated build of the mobile client.
