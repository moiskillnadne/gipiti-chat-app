# Research: test and CI reality, test strategy, and tooling that a restructure breaks

Scope: GIPITI app at `/Users/victorryabkov/projects/personal/gipiti/app` (HEAD `c9981de`, branch
`chore/gipiti-127-sharp-vitest-lockfile`, already squash-merged as `origin/main` `42104bb` #264).
Everything below was read only. "Observed" = seen in a file or command output (cited as
`path:line`). "Inferred" = my conclusion. Items I could not verify are marked **UNVERIFIED**.

---

## 1. Inventory of what exists today

### 1.1 Vitest (unit)

Config (observed): `vitest.config.ts:8` `include: ["**/__tests__/**/*.test.ts"]`,
`vitest.config.ts:6-7` `globals: true, environment: "node"`, `vitest.config.ts:13` alias
`"@": resolve(__dirname, ".")`. No `exclude`, no `projects`, no setup file, no coverage config.
Installed vitest is 4.1.12. Its `defaultExclude` is only `["**/node_modules/**", "**/.git/**"]`
(vitest dist chunk), so the `.claude/worktrees/*` checkouts are collected too. That is the root cause
of the "stale worktrees break pnpm check" note in the owner's memory. It is a **live bug in
`pnpm check` today**, not only a restructure risk.

`.tsx` tests are not picked up (the include is `*.test.ts` only). There are no component tests and
no jsdom/happy-dom environment.

51 test files, about 447 `it`/`test` call sites (counted with `grep -c`; each `it.each` counts as
one, so this is approximate):

| Area | Files | ~cases | Notes |
|---|---|---|---|
| `app/(chat)/api/chat/_lib/__tests__` | 13 | 167 | turn lifecycle (47), usage (36), stop-signal (18), persist-assistant-turn (14), is-turn-aborted (13), image/video stop, enforce-balance (2) |
| Route handlers (`app/**/__tests__/route.test.ts`) | 4 | 17 | quiz/[key] (3), subscription (3, export shape only), cron/reset-quotas (4), payment/create-intent (7) |
| CloudPayments handler | 1 | 7 | `app/api/webhooks/cloudpayments/lib/handlers/__tests__/tester-plan.test.ts` only |
| `lib/billing` | 6 | 47 | refund planning, turn slots/balance, charge shortfall, quiz bonus, tester plans |
| `lib/ai` + `lib/ai/tools` | 8 | 48 | model registry (15), text attachments (17), docx, watermark, csv/txt tools |
| `lib/agent-discovery` | 1 | 16 | includes the hand-written OpenAPI doc |
| `lib/marketing` | 3 | 15 | |
| Other `lib/*` (auth/normalize-email, chat, db/unique-violation, dom, i18n, media, messages, prompts, subscription, activity, attachments, client-diagnostics) | 13 | ~105 | |
| `scripts/hooks/__tests__` | 2 | 25 | protected-paths, plan-file |

**How mocking is done (observed).** Everything is mocked by module path with `vi.mock`. There is no
dependency injection and no test DB.

- DB: `vi.mock("@/lib/db/connection", …)` appears in 10 files. Three styles are used:
  - an empty stub `{ db: {} }` for pure functions, e.g. `lib/billing/__tests__/refund.test.ts:6`;
  - a hand-built Drizzle chain fake, e.g. `app/api/cron/reset-quotas/__tests__/route.test.ts:36-53`
    or the transaction fake in `lib/billing/__tests__/charge-usage-shortfall.test.ts:31-40`;
  - more often, mocking the query module itself, e.g. `vi.mock("@/lib/db/query/user/get-by-id")`
    in `app/api/payment/create-intent/__tests__/route.test.ts:21`.
- Auth: `vi.mock("@/app/(auth)/auth", () => ({ auth: vi.fn() }))` (3 files). Because `auth` is
  overloaded (route wrapper and session getter), tests cast it:
  `vi.mocked(auth as unknown as () => Promise<Session | null>)`
  (`app/api/payment/create-intent/__tests__/route.test.ts:27-28`).
- `server-only` is stubbed with `vi.mock("server-only", () => ({}))` (6 files), e.g.
  `app/(chat)/api/quiz/[key]/__tests__/route.test.ts:11`.
- AI gateway: `vi.mock("ai")` (3 files), `vi.mock("@ai-sdk/gateway")` (2),
  `vi.mock("@/lib/ai/providers")` (2), and the tool modules one by one. The `ai/test` helpers
  (`MockLanguageModelV3`, `simulateReadableStream`, exported at `node_modules/ai/package.json:39`)
  are installed but not used.
- CloudPayments: only `vi.mock("@/lib/payments/cloudpayments")`
  (`app/(chat)/api/subscription/__tests__/route.test.ts:20`). Nothing tests the webhook HMAC
  check or the route-level dispatch.
- Resend: **no test mocks or exercises Resend.** The Resend webhook, verification-code email and
  password-reset email have no tests.
- Hazard: 7 test files mock by **relative** path (`vi.mock("../charge")`,
  `vi.mock("../../../db/query/document/save-document")`):
  `app/(chat)/api/chat/_lib/__tests__/{image-generation-stop,turn-slot-release,video-generation-stop}.test.ts`,
  `lib/ai/tools/__tests__/{generate-txt,generate-csv}.test.ts`,
  `lib/billing/__tests__/{charge-usage-shortfall,turn-balance}.test.ts`. If a test moves without its
  target, or the target moves without the test, the mock silently stops applying and the real
  module (DB, gateway) is imported. Separately, 87 source files use `../../` imports.

### 1.2 Canonical route-test pattern (the one to copy)

`app/api/payment/create-intent/__tests__/route.test.ts`. It is the best example: AAA comments, a
typed `Session`, and Request construction.

- `:15` `vi.hoisted(() => ({ insertValues: vi.fn() }))` captures the DB writes.
- `:17-25` mocks auth, `db.insert().values`, the user query and the subscription catalog.
- `:42-47` `createRequest(body)` builds `new Request("http://localhost/api/payment/create-intent", { method: "POST", … })`.
- `:49-58` `arrangeUser()` does `mockedAuth.mockResolvedValue({ user: { id }, expires: "" } as Session)`.
- `:78` calls the exported `POST(request)` directly and asserts `response.status` and the mock calls.

A dynamic-segment variant is in `app/(chat)/api/quiz/[key]/__tests__/route.test.ts:42-50`. It passes
`{ params: Promise.resolve({ key }) }` and asserts the error body
`{ code: "forbidden:auth" }` at `:69-70`. That error body comes from `ChatSDKError.toResponse()`,
`lib/errors.ts:56-76`. It returns `{ code, message, cause }`, or for "log" surfaces
`{ code: "", message: "Something went wrong…" }`.

### 1.3 Route handlers and server actions: coverage today

Route handlers (37 `route.ts`). The **tested** ones are in bold:

| Route | Test | Risk if moved untested |
|---|---|---|
| `app/(chat)/api/chat/route.ts` (POST, 800 s stream) | `_lib` is unit-tested (167 cases); **route.ts orchestration itself: none** | Highest: money plus the stream protocol |
| `app/(chat)/api/chat/[id]/stream`, `[id]/stop` | stop-body/stop-signal unit only | High |
| **`app/api/payment/create-intent`** | 7 cases | High |
| `app/api/topup/create-intent`, `app/api/payment/status` | none | High (money) |
| `app/api/webhooks/cloudpayments/route.ts` (HMAC + check/pay/fail/recurrent/cancel/refund) | only the tester-plan handler (7) and `lib/billing` refund planning | Highest, but its URL stays (external) |
| `app/api/webhooks/resend/route.ts` | none | Medium (URL stays) |
| **`app/api/cron/reset-quotas`** | 4 | Medium (URL stays) |
| `app/api/cron/{cleanup-cancelled,cleanup-payment-intents,refresh-fx-rates}` | none | Medium (URL stays) |
| **`app/(chat)/api/subscription`** | export shape only (no GET/DELETE behaviour) | High (cancel is money-adjacent) |
| `subscription/resume`, `subscription/cancellation-feedback` | none | Medium |
| **`app/(chat)/api/quiz/[key]`** | 3 | Medium (bonus grant) |
| `history`, `vote`, `projects`, `projects/[id]/files`, `projects/[id]/files/[fileId]`, `files/upload`, `prompts`, `prompts/favorite`, `transactions`, `usage`, `api/me`, `api/log` | none | Medium: these become the core of `/v1` |
| `api/auth/[...nextauth]` | e2e only | High |
| `.well-known/*`, `openapi.json`, `robots.txt`, `api/agent-markdown`, `api/health` | via `lib/agent-discovery` tests | Low |

Server actions (observed): `app/(auth)/actions.ts`, with `login :61`, `register :102`,
`verifyEmail :191`, `resendVerificationCode :261`, `requestPasswordReset :326`,
`resetPassword :412`. **None of them has a unit test.** Only `login` is exercised, through the
Playwright UI suite (`tests/e2e/login.test.ts`, 687 lines). `app/(chat)/actions.ts` has 11 cookie
setters (`:19-78`) with no tests, and `deleteTrailingMessages :89`, which is covered by
`lib/chat/__tests__/delete-trailing-messages.test.ts`. There is one inline server action in
`components/sign-out-form.tsx:9`. The importers that will need rewiring are
`contexts/{model,project,web-search}-context.tsx`, `components/message-editor.tsx:13`, the
`app/(auth)/*/page|client` files, and `app/subscription/**` (`verify-email-client.tsx:18`,
`reward-banner.tsx:8`).

Inferred: the auth actions are the riskiest untested surface. They contain user-enumeration
protection (a dummy bcrypt compare), email normalisation, the 6-digit code flow and the
reset-token flow. They are also exactly what must become REST for mobile.

### 1.4 Playwright (e2e)

- `playwright.config.ts:24` `testDir: "./tests"`, `:25-26` global setup and teardown, `:58`
  project `e2e` (`/e2e\/.*.test.ts/`), `:65` project `routes` (`/routes\/.*.test.ts/`). **There is
  no `tests/routes/` directory**, so the API-test slot already exists but is empty.
- `:96-101` webServer `pnpm dev` waits for `/ping`. **There is no `/ping` route** in the `route.ts`
  list (it may be served elsewhere; I did not confirm what answers it. UNVERIFIED).
- `tests/global-setup.ts:7` imports `../lib/db/schema` by relative path and seeds `test@example.com`
  with bcrypt straight into `POSTGRES_URL`. It then warms `/login` and `/chat` with a real login
  (`:73-108`). `tests/global-teardown.ts:5` deletes the user.
- Specs: `tests/e2e/login.test.ts` (UI login: validation, toasts, callbackUrl safety, session
  cookie) and `tests/e2e/chat-input.test.ts` (composer drafts; it never sends to a model). Page
  objects are in `tests/pages/auth.ts`.
- DB: locally it is whatever `.env.local` `POSTGRES_URL` points to (per owner memory, the
  `gipiti-db-local` postgres:17 container. The repo has no docker-compose file). In CI it is a
  `postgres:16` service container (`.github/workflows/playwright.yml` `services.postgres`), migrated
  by `pnpm db:migrate`.
- No mock model or gateway exists for e2e (no `PLAYWRIGHT`/`isTestEnvironment` branch in `lib/`,
  even though `package.json:20` exports `PLAYWRIGHT=True`). A chat turn cannot run in e2e today
  without a real `AI_GATEWAY_API_KEY`.

### 1.5 `scripts/check.ts`

It runs `typecheck`, `lint`, and `test:unit` in parallel (`scripts/check.ts:160-164`), then plain
`next build` only if all three pass (`:174-191`). Placeholder env is set only when the value is
missing everywhere (`:44-48`): `AUTH_SECRET`, `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`. It restores
`next-env.d.ts` and `tsconfig.tsbuildinfo` (`:55`). It never touches the DB (it skips
`pnpm build`'s migrate on purpose, `:182`).

### 1.6 CI (`.github/workflows`)

- `lint.yml`: on every push, `pnpm lint` (Node 22, pnpm 9.12.3).
- `unit-tests.yml`: push plus PRs to main, `pnpm test:unit`.
- `playwright.yml`: push and PR to main only. It runs postgres:16, `pnpm db:migrate`, then
  `pnpm test`. It uses `pnpm/action-setup@v2` `version: latest` and Node `lts/*`, which does not match
  `packageManager: pnpm@9.12.3` and the other workflows' Node 22.
- **CI does not run `pnpm typecheck` or `next build`.** Vercel's build is the only type gate for
  PRs. There is no spec, contract or architecture check.

---

## 2. Options and constraints per test layer

### (a) Characterization tests before code moves

Constraint: today's route tests are colocated in `__tests__` next to the route. If they move in the
same commit as the code, they cannot prove that behaviour was preserved, because both sides change at
once.

Recommendation:

- Put pinning tests in a location that does **not** move: `tests/characterization/<area>.test.ts`.
  This needs `vitest.config.ts:8` to add `"tests/characterization/**/*.test.ts"`.
- Import the handler under test through **one indirection module**,
  `tests/characterization/targets.ts`, which re-exports `POST`, `GET` and so on from their current
  paths. When code moves, only `targets.ts` changes, and the assertion files stay byte-identical. A
  diff of the assertion files that is empty is the proof.
- Use `@/` aliases (never relative paths) in `vi.mock` inside these files.
- Pin status code, JSON body (`toMatchObject` on `code`, plus the presence of `message`), the
  `Set-Cookie` presence and name for auth, and DB side effects (mock call arguments).

Priority order (riskiest first):

1. CloudPayments webhook route: HMAC accept and reject, kind routing (`subscription` vs `topup`),
   idempotent top-up credit, refund debit pool.
2. Auth actions: login success and failure equivalence (same error for unknown user and wrong
   password), register, verifyEmail, resend code rate limits, requestPasswordReset (no
   enumeration), resetPassword token single use.
3. `POST /api/chat` route.ts: 401 without a session, `quota_exceeded:chat` when the balance is
   empty, charge called once per turn. Use `MockLanguageModelV3` plus `simulateReadableStream`
   from `ai/test` and assert the UI-message-stream framing (content type and the first and last
   parts).
4. Payment and top-up create-intent and status, subscription GET/DELETE/resume.
5. history, vote, projects, files, prompts, transactions, usage, me. These become `/v1` and need a
   baseline for the "same JSON shape" check.

Because actions return `ActionState` objects rather than `Response`s, characterize them by calling
the exported function with a `FormData` and mocking `signIn` from `@/app/(auth)/auth` and
`next/headers` cookies. That is the same `vi.mock` style.

### (b) oRPC procedure tests (verified against @orpc/server 1.15.7 in admin-dashboard)

Observed in admin-dashboard: `src/server/orpc/__tests__/` has **only schema and error-mapping
tests** (`errors.test.ts`, `schemas.test.ts`, `activity-schemas.test.ts`). No procedure is invoked
in a test. The context there is empty (`src/app/rpc/[[...rest]]/route.ts:13` `context: {}`).
`scripts/smoke-rpc.ts:113` uses `createRouterClient(router, { context: {} })` against the real DB.
That is a smoke script, not a test. The project has no auth context, so it is not a template for
auth.

Verified APIs (`node_modules/.pnpm/@orpc+server@1.15.7/.../dist/index.d.mts`):

- `call(procedure, input, { context, … })`, at `:787`. It invokes one procedure.
- `createRouterClient(router, { context })`, at `:797`. It produces a typed client of the whole
  router. `context` is required when the initial context is non-empty
  (`shared/server.qKsRrdxW.d.mts:132-136`), and it may be a value or a function.
- `implement(contract)`, at `:759`. It creates test doubles of a contract or procedure (docs:
  orpc.dev/docs/advanced/testing-mocking).
- `ORPCError` exposes `defined`, `code`, `status`, `data` and `toJSON()`
  (`@orpc/client/dist/index.d.ts:112-117`). The JSON shape is
  `{ defined, code, status, message, data }` (`:132`).

Recommended pattern:

```ts
const ctx: ApiContext = { auth: { userId: "user-1", sessionKind: "bearer" }, requestId: "t" };
await expect(call(router.v1.chat.history.list, { limit: 20 }, { context: ctx }))
  .resolves.toMatchObject({ items: [] });
await expect(call(router.v1.chat.history.list, {}, { context: { ...ctx, auth: null } }))
  .rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
```

Design constraint for the plan: keep the initial context small and plain (`auth`, `requestId`,
maybe `headers`). Keep DB access behind domain modules so the existing `vi.mock("@/…")` style
keeps working. Putting `db` in the context is possible, but it would split the codebase into two
mocking styles.

### (c) HTTP-level contract tests through the OpenAPI handler

- Verified: the fetch `RPCHandler.handle(request, { prefix, context })` returns
  `{ matched, response }` (`@orpc/server/dist/adapters/fetch/index.d.mts:20,40`). Per the docs,
  `OpenAPIHandler.handle` has the same shape (`prefix`, and `context` as a value or an async
  function of the request). Package `@orpc/openapi`. The exact import path
  `@orpc/openapi/fetch` is **UNVERIFIED** (not installed anywhere locally, and the docs page omits
  the import).
- Route options are verified in the contract types
  (`@orpc/contract/dist/shared/contract.TuRtB1Ca.d.mts`): `method :66`, `path :73`,
  `operationId :80`, `deprecated :101`, `successStatus :117`, `inputStructure :148`.
- Test shape: build the handler once with the real router and a context factory, then send
  `new Request("http://localhost/api/v1/...", { headers: { authorization: "Bearer …" } })`. The
  same file covers:
  1. bearer accepted;
  2. NextAuth session cookie accepted, for the web transition;
  3. neither gives 401 with the oRPC error JSON body;
  4. a malformed body gives 400 with validation `data`;
  5. an unknown path gives `matched === false`, and the Next route returns 404;
  6. a deprecated route still answers.
- Calling the Next route module's exported `GET` and `POST` (the admin-dashboard style,
  `route.ts:12-22`) also exercises the `prefix` wiring. Prefer that over calling the handler
  object directly.
- Two error shapes will coexist. Legacy routes return the `ChatSDKError` body
  (`lib/errors.ts:75`); oRPC returns `ORPCError.toJSON()`. Contract tests must pin which one each
  path returns, and the mobile client must only ever see the oRPC one. Decide whether `/v1` maps
  `ChatSDKError` to `ORPCError` in a single interceptor (as admin-dashboard does with
  `callService`, `src/server/orpc/errors.ts:23-30`) and test that mapping table the same way
  `errors.test.ts:21-30` does.

### (d) OpenAPI spec snapshot and breaking-change check

- The generator API per the docs: `new OpenAPIGenerator({ converters: [new ZodToJsonSchemaConverter()] }).generate(router, { version, base: { info } })`
  (orpc.dev/docs/openapi/openapi-specification). **Constraint found:** the docs say
  "`@orpc/zod` requires Zod v4 or later", but the app is on **zod 3.25.76**
  (`node_modules/zod/package.json`; 20 files import `"zod"` and 6 import `"zod/v4"`).
  Admin-dashboard is on zod ^4.6.7. Whether `@orpc/zod` accepts `zod/v4` schemas from the 3.25
  package is **UNVERIFIED**. The plan should include a zod 4 upgrade step (or pin new API schemas to
  `zod/v4`) and verify it with a spike.
- Snapshot: a vitest test generates the spec and asserts
  `await expect(JSON.stringify(spec, null, 2)).toMatchFileSnapshot("server/openapi/v1.openapi.json")`.
  `toMatchFileSnapshot` is present in vitest 4.1.12 types (`vitest/dist/index.d.ts`). Any API
  change then shows up as a reviewed diff in the PR. A name like `*.gen.json` would be skipped by
  Biome automatically (`node_modules/ultracite/biome.jsonc:8` excludes `**/*.gen.*`).
- Breaking-change gate: nothing is installed (no oasdiff or openapi-diff in `node_modules`).
  Options:
  1. A CI job runs `oasdiff breaking` (Docker or GitHub Action; **UNVERIFIED** action
     name/version) between `origin/main:server/openapi/v1.openapi.json` and the PR's copy, and fails
     on breaking changes for any frozen version.
  2. A cheap in-repo vitest rule needs no tool: for each frozen version, every
     `operationId`/path/method in the main snapshot must still exist, and no response property may
     disappear.

  Recommend option 2 first and option 1 once a second version exists.
- Publication conflict (observed): `/openapi.json` is already the hand-written **public-only**
  document (`app/openapi.json/route.ts:1-12`, `lib/agent-discovery/openapi.ts`). It is linked from
  every page's `Link` header (`next.config.ts:15`), and `docs/agent-discovery.md` says the
  session-authenticated APIs are intentionally undocumented. The plan must decide where the mobile
  spec is served (for example `/api/v1/openapi.json`, or not served at all and only committed), and
  update `lib/agent-discovery/__tests__/agent-discovery.test.ts` and the docs accordingly.

### (e) Integration tests against a real Postgres

- Today: no vitest test touches a real DB. CI has a Postgres service only in `playwright.yml`.
  Locally there is a manually managed Docker container (owner memory, not in the repo). Versions
  differ: CI 16, local 17, prod Neon (version **UNVERIFIED**).
- Needed for: refresh-token rotation and reuse detection (unique constraints, `SELECT … FOR UPDATE`),
  idempotent webhook crediting, and `chargeUsage` row locking. The fake Drizzle chains in
  `charge-usage-shortfall.test.ts` cannot prove locking or uniqueness. The project already relies on
  the SQLSTATE on `error.cause` (`lib/db/unique-violation.ts`), which only a real DB produces.
- Recommendation: add a second vitest project with `projects` (verified at
  `vitest/dist/chunks/reporters.d.DtoKVV2s.d.ts:2859`), for example `unit` and `integration`. The
  `integration` project includes `**/__integration__/**/*.test.ts`, gets a `globalSetup` that runs
  the Drizzle migrator against `TEST_POSTGRES_URL` (refusing any host other than
  localhost/127.0.0.1), truncates per file, and uses `fileParallelism: false`.
  - Run it in a new CI job with the same `postgres:16` service block (copy it from
    `playwright.yml`, and bump it to 17 to match local).
  - Keep it **out of `pnpm check`**, which CLAUDE.md promises "never touches the DB". Add
    `pnpm test:integration` instead.
  - PGlite or testcontainers are not installed, and adding them is optional.

### (f) E2E

- Keep the two UI specs. They are the only protection for the cookie login that the web keeps
  using.
- Fill the existing empty `routes` Playwright project (`playwright.config.ts:65`) with API-level
  specs that use Playwright's `request` fixture against `pnpm dev`. Flow: register, then verify (read
  the code from the DB in the test, as global-setup already does with direct DB access), then
  `POST /api/v1/auth/token`, then `GET /api/v1/me` with the bearer, then refresh, then reuse the old
  refresh token and expect 401. Then do logout and revoke. This is the mobile smoke test that needs
  no mobile app.
- A chat-turn e2e needs a model stub. Add an env-gated `MockLanguageModelV3` provider (test-only,
  never built for production) or keep chat out of e2e. Decide this explicitly.
- Mobile-client e2e (Detox or Maestro) is out of scope until the stack is chosen.

### (g) Architecture and boundary tests

Tools available (observed): Biome 2.2.2 via ultracite 5.3.9; TypeScript 5.8.2; no
dependency-cruiser, madge, eslint-plugin-boundaries or Steiger installed.

- **Biome `noRestrictedImports`** (enabled at error level by the preset,
  `node_modules/ultracite/biome.jsonc:517`). Its options are `paths` and `patterns`, where
  `patterns` takes gitignore-style `group`, `importNamePattern` and `message`
  (`configuration_schema.json` `NoRestrictedImportsOptions`, `PatternOptions`). Combined with
  `overrides[].includes` (present in the schema), it can forbid `@/server/**` inside the client FSD
  folders and give instant editor feedback.
  - Limitation (inferred from the options): it matches the **import specifier text**, so
    `../../server/x` evades it unless every relative depth is listed. It also does not understand FSD
    layer order without one override per layer.
  - `noImportCycles` and `noPrivateImports` exist but are switched off by the preset
    (`ultracite/biome.jsonc:353,446`).
- **`server-only`** (already imported by 11 modules) gives a build-time guard against a client
  component pulling server code. Make it mandatory in every `server/**` entry and procedure module.
- **A vitest architecture test** (recommended as the source of truth):
  `tests/architecture/boundaries.test.ts` walks `git ls-files '*.ts' '*.tsx'`, extracts imports
  with `ts.preProcessFile` (TypeScript API, no new dependency), resolves `@/` and relative
  specifiers to repo paths, and asserts these rules:
  1. nothing outside `server/` and `app/**/route.ts` imports `server/**`;
  2. FSD layer order `app → pages → widgets → features → entities → shared`, with no upward
     imports and no cross-slice imports within the same layer except through a slice's
     `index.ts`;
  3. `server/**/domain` (or whatever the domain folder is called) imports neither `@orpc/*`,
     `next/*`, nor the transport folder;
  4. `import type` is allowed across the client/server line only from a shared-types location.

  Baseline today (observed): 10 client files import `@/lib/db/schema`, and **all of them are
  `import type`**. One `lib → app` import exists (`lib/ai/entitlements.ts:1`, type only). So rule 4
  matters, or the test will fail on day one.

  Ship the test with an explicit allowlist of current violations that may only shrink, so the
  migration can be incremental.
- FSD's official linter (Steiger) is not installed. Whether it supports Next.js App Router's root
  `app/` coexisting with an FSD `app` layer is **UNVERIFIED**. Next.js itself says that `src/app` is
  ignored if a root `app/` exists, and that proxy and instrumentation must live in `src/` when
  `src/` is used (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/src-folder.md`,
  `.../instrumentation.md:12`). The structure proposal must resolve the name clash between the
  Next.js `app/` router folder and the FSD `app` layer.

---

## 3. Tooling a folder restructure breaks (exact lines)

| File:line | Current | What must change |
|---|---|---|
| `vitest.config.ts:8` | `include: ["**/__tests__/**/*.test.ts"]` | Add an `exclude` for `.claude/**` and `**/.next/**` now (an existing bug). Add `tests/characterization/**`, `tests/architecture/**` and `.tsx` if component tests come. Split into `projects` (unit/integration). |
| `vitest.config.ts:13` | `"@": resolve(__dirname, ".")` | Stays if `@/` keeps meaning the repo root. If `src/` is introduced, it becomes `./src`, and it must match `tsconfig.json:23`. |
| `tsconfig.json:22-24` | `"paths": { "@/*": ["./*"] }` | Same decision. Optionally add `@server/*` and `@shared/*` aliases, which also make Biome specifier rules reliable. |
| `tsconfig.json:27-35` | `include: ["**/*.ts", …]`, `exclude: ["node_modules"]` | Add `.claude` to `exclude` as a precaution. Biome already skips it through `.gitignore`; whether tsc enters dot-directories through `**` was not checked (UNVERIFIED). |
| `biome.jsonc:5-10` | `includes: ["**/*", "!components/ui", "!lib/utils.ts", "!hooks/use-mobile.ts"]` | All three exclusions are path-based shadcn files. Update them to the new `shared/ui/...` locations, or the generated shadcn code starts failing lint. Add the `overrides` for `noRestrictedImports`. |
| `components.json:8` | `"css": "app/globals.css"` | Update if globals.css moves. |
| `components.json:13-18` | aliases `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks` | Point to the FSD `shared/ui`, `shared/lib` and similar, or `shadcn add` writes into the old folders. |
| `app/globals.css:4` | `@source '../node_modules/streamdown/dist/index.js';` | The path is relative to the CSS file and breaks silently (missing Tailwind classes, no error) if the file changes depth. |
| `playwright.config.ts:24-26` | `testDir: "./tests"`, `globalSetup`, `globalTeardown` | Fine if `tests/` stays at the root (recommended). |
| `playwright.config.ts:96-101` | webServer `pnpm dev`, `url: …/ping` | Confirm `/ping` exists (UNVERIFIED). |
| `tests/global-setup.ts:7`, `tests/global-teardown.ts:5` | `import { user } from "../lib/db/schema"` | Relative path; update when the schema moves. |
| `drizzle.config.ts:4-5` | `schema: "./lib/db/schema.ts"`, `out: "./lib/db/migrations"` | Update if the DB moves (for example `server/db`). |
| `lib/db/migrate.ts:21` | `migrationsFolder: "./lib/db/migrations"` | Same. |
| `package.json:7` | `"build": "tsx lib/db/migrate && next build"` | Same. **This is the production deploy path: a wrong path here breaks deploys.** |
| `package.json:14` | `"db:migrate": "npx tsx lib/db/migrate.ts"` | Same. |
| `scripts/hooks/protected-paths.mjs:32` | `/^lib\/db\/migrations\/(?!meta\/_journal\.json$)/` | **If migrations move, protection silently stops.** Update it and `scripts/hooks/__tests__/protected-paths.test.ts:70-80` (hard-coded `lib/db/migrations/...`). Moving existing migration files is itself blocked for agents by this hook (`allowsNewFiles` only protects existing files, so delete/write of an existing path is refused). Inferred: the owner must do the migrations move by hand or with `git mv` outside the hook. |
| `scripts/*.ts` (`add-tokens.ts:5`, `assign-tester.ts:5`, `seed-*.ts`, `sync-prompts.ts:4-12`, `delete-users.ts:6`, `assign-free-plan.ts:5`) | `@/lib/db/schema`, `@/lib/prompts/*`, `@/lib/subscription/subscription-tiers` | Update with the moves. Not covered by tests or the build, only by typecheck. |
| `next.config.ts:87-100` | `outputFileTracingIncludes` keyed by **URL** (`"/api/chat"`, `"/blog"`, `"/sitemap.xml"`) | Unaffected by file moves. It **must be duplicated or renamed if chat gets a `/api/v1/...` URL**, or the fonts and watermark go missing in that function at runtime (PDF generation and watermark fail only in production). |
| `next.config.ts:21` | `HTML_PAGE_SOURCE = "/((?!api/|_next/|images/|videos/).*)"` | If the API is served at `/v1/...` rather than `/api/v1/...`, the API responses would get the HTML `Link` header. This argues for `/api/v1`. |
| `next.config.ts:101-105` | `serverActions.allowedOrigins` | Remove once server actions are gone. |
| `proxy.ts:26-32`, `:142-…` matcher | protected page patterns and matcher | New API paths must not be redirected to `/login`. The API must answer 401 JSON. Add a characterization test for `proxy` on `/api/v1/*`. |
| `proxy.ts:111-114` | `getToken({ … secureCookie: !isDevelopmentEnvironment })` | Bearer auth must not depend on this. |
| `instrumentation.ts` | at the root | Must stay at the root, or in `src/` if `src/` is adopted (Next docs, instrumentation.md:12). |
| `vercel.json:2-15` | cron paths `/api/cron/*` | These are URLs. Keep them unchanged (an external contract). |
| `lib/blog/posts.ts:14`, `lib/ai/pdf-fonts.ts:18`, `lib/ai/watermark.ts:10` | `process.cwd()` + `content/blog`, `assets/fonts`, `public/icons` | Safe while `content/`, `assets/` and `public/` stay at the root. Do not move them. |
| `lib/marketing/__tests__/model-landings.test.ts:19` | `join(__dirname, "../../../public")` | Depth-relative; it breaks when the test moves. Switch to `process.cwd()`. |
| 7 test files with relative `vi.mock` (§1.1) | `vi.mock("../charge")` and similar | Convert to `@/` before moving anything. |
| `.github/workflows/*.yml` | commands only, no source paths | Unaffected by moves. Add `pnpm check:fast` (typecheck is missing in CI), the integration job and the spec diff. Align `playwright.yml` pnpm and Node with the others. |
| `CLAUDE.md` (≈40 path refs), `.claude/agents/review.md` (18), `.cursor/rules/cloudpayments.mdc` (6), `.cursor/rules/next-ts-vercel.mdc` (1), `docs/agent-discovery.md` (12) | path references | Rewrite them in the same PR as each move. Note: CLAUDE.md already references `.claude/skills/repo-recipes/SKILL.md`, `CONTEXT.md` and `docs/adr/`, which **do not exist on this branch**. They appear to be on the unmerged `feat/gipiti-28-mcp-integrations-cw6f0r` branch, which adds `.claude/skills` and `docs/adr` (inferred from its diff). |
| `.claude/settings.json` | hooks call `scripts/hooks/protect.mjs` and `scripts/hooks/save-plan.ts` | Keep `scripts/hooks/` where it is. |
| `.claude/launch.json` | commands only | Unaffected. |

---

## 4. Git state (read-only) and conflict risk

- `git worktree list`: the main checkout plus `../app-pr248` (`claude/eager-carson-nk9euo`),
  `../app-wt-activity` (`feat/user-activity-day`), and 3 registered `.claude/worktrees/*`
  (`agent-a0182…` on `fix/gipiti-122…`, `lucid-noether-bc02d3`, `optimistic-antonelli-7d5781`).
  13 directories sit under `.claude/worktrees/`, so 10 are unregistered leftovers. They are the
  ones that break vitest.
- Local `main` (`a210eda`) is behind `origin/main` (`42104bb`). The current branch's 2 commits are
  already squash-merged as #264.
- Branches with commits not in `origin/main` (by `rev-list`): the GIPITI-109/113/114/122/127/153/159
  branches all appear as `+1/+2`, but their PRs (#259–#264) are in `origin/main`. They are
  **squash-merge leftovers, not open work** (inferred from the PR numbers in `git log origin/main`).
- **Real open work:** `feat/gipiti-28-mcp-integrations-cw6f0r`. It has 18 commits, the last on
  2026-11-14, and touches **79 files**: `lib/integrations` (24), `app/(chat)` (10), `lib/db` (9,
  so it likely includes migrations and the schema), `app/integrations` (6), `proxy.ts`,
  `lib/flags.ts`, `lib/types.ts`, `messages/ru.json`, `components/tool-run-renderer.tsx`,
  `hooks/use-integration-selection.ts`, `.claude/skills`, `docs/adr` and `docs/plans`. A large move
  of `app/(chat)`, `lib/db`, `lib/` and `components/` would conflict heavily with it. Older stale
  branches (`feature/GIPITI-63` with 58 files from 2026-05, `feat/GIPITI-24`, and others) are
  presumably abandoned (UNVERIFIED).
- Recommendation: merge GIPITI-28, or explicitly park it, **before** any mass-move phase. Do the
  moves as pure `git mv` plus import-rewrite commits (no behaviour change, one area per PR), so that
  `git log --follow` and rebases of later branches stay workable. Prune the unregistered worktree
  directories before Phase 0 (owner action, since it deletes files).

---

## 5. Recommended test pyramid for this migration

From cheapest and most numerous to most expensive:

1. **Static gates, in `pnpm check`:**
   - typecheck;
   - Biome, plus `noRestrictedImports` overrides for client→server;
   - `tests/architecture/boundaries.test.ts`, the import-graph rules with a shrinking allowlist;
   - `server-only` in server modules.
2. **Domain unit tests, in `pnpm check`.** The existing ~447 cases stay. New domain code under
   `server/` gets colocated `__tests__`, using the same `vi.mock("@/…")` style and pure functions
   for money math.
3. **Procedure tests, in `pnpm check`.** One file per procedure folder, using `call(procedure, input, { context })`
   with a typed fake `ApiContext`: authorized, unauthorized, and wrong-owner (404 vs 403 chosen
   explicitly), input validation, and the domain-error → `ORPCError` mapping.
4. **HTTP contract tests, in `pnpm check`.** Through the Next route module and the OpenAPI handler
   with `Request` objects. They cover bearer vs cookie vs none, status codes, the error JSON shape,
   `deprecated` versions still served, `proxy` not redirecting `/api/v1`, and CORS if mobile web is
   ever needed.
5. **Spec snapshot and breaking-change rule, in `pnpm check`.** A `toMatchFileSnapshot` of every
   published version, plus the frozen-version "no removal" test.
6. **Characterization tests, in `pnpm check`.** In `tests/characterization/`, pinned before each
   move and deleted only when the legacy endpoint is deleted.
7. **Integration tests on a real Postgres, in `pnpm test:integration` and a CI job, not in
   `pnpm check`.** They cover refresh-token rotation and reuse detection, webhook idempotency,
   `chargeUsage` locking, and the migrations applying cleanly.
8. **Playwright, in CI.** The existing UI login and composer specs, plus a new `tests/routes/`
   API flow (register → token → me → refresh → reuse rejected → logout).

## 6. Per-phase definition of done

These phases are generic, so the phase owner should map them onto the final plan's phases.

**Phase 0: safety net, before any code moves**
- [ ] `vitest.config.ts` excludes `.claude/**`, and `pnpm check` is green in the main checkout without workarounds.
- [ ] CI runs `pnpm check:fast` (typecheck + lint + unit), and the Playwright workflow uses pnpm 9.12.3 and Node 22.
- [ ] The 7 relative `vi.mock` paths are converted to `@/`. `model-landings.test.ts:19` no longer depends on depth.
- [ ] Characterization tests exist for the CloudPayments webhook route, all 6 auth actions, the `POST /api/chat` guard path and stream framing, the payment/top-up intents and status, subscription GET/DELETE/resume, and the endpoints listed in §1.3 that become `/v1`. They are all green against the current code.
- [ ] The architecture test is in place with today's violations allowlisted.
- [ ] GIPITI-28 is merged or explicitly parked. Leftover worktree directories are removed by the owner.

**Phase 1: oRPC foundation (no endpoint moved yet)**
- [ ] The zod 4 / `@orpc/zod` compatibility is resolved by a spike, with the result written into the plan.
- [ ] `ApiContext` type plus a context factory, with unit tests for bearer, cookie and none.
- [ ] The error-mapping table (`ChatSDKError` / domain errors → `ORPCError`) has table-driven tests.
- [ ] The OpenAPI generation test writes `v1` to a snapshot. A contract test proves an unknown `/api/v1/*` path returns 404 JSON, not a login redirect.
- [ ] `docs/agent-discovery.md` and the `/openapi.json` decision are recorded, and the agent-discovery tests are updated.

**Phase 2: auth over REST**
- [ ] Procedure tests cover login, register, verify, resend, password reset, token refresh and logout, including enumeration resistance (the same error and similar timing path for an unknown user).
- [ ] Integration tests on real Postgres cover refresh rotation, reuse of a rotated token (rejected, family revoked), expiry and concurrent refresh.
- [ ] Contract tests cover bearer-only access to `/api/v1/me`, and cookie access still working for web.
- [ ] Playwright `tests/routes/auth-flow.test.ts` passes in CI. The existing `login.test.ts` still passes unchanged.
- [ ] The Phase 0 auth characterization tests still pass. The web UI calls REST, and `app/(auth)/actions.ts` exports are removed only after that.

**Phase 3: server actions and the remaining JSON routes → `/v1` procedures**
- [ ] Each migrated endpoint has procedure tests (auth, ownership, validation) and one contract test.
- [ ] Its characterization test still passes against the legacy URL while the legacy URL exists. When the legacy route is deleted, the characterization test is deleted in the same commit, and the reason is stated.
- [ ] Cookie-only settings (model, thinking, media and similar) have a REST equivalent. Mobile does not rely on `cookies()`.
- [ ] No `"use server"` file remains (the architecture test asserts this) except deliberately documented ones.
- [ ] The spec snapshot diff is reviewed in the PR.

**Phase 4: chat streaming endpoint (kept on the AI SDK protocol)**
- [ ] Bearer auth works for `POST /api/chat` (or its versioned URL) and for stream resume. This is proven by a contract test with a `MockLanguageModelV3`.
- [ ] `outputFileTracingIncludes` covers the final chat URL, checked by a test that reads `next.config.ts`, or a manual production check is noted.
- [ ] The billing characterization tests (`enforce-balance`, `usage`, `turn-*`) are unchanged and green.
- [ ] The endpoint is documented in the OpenAPI spec as a non-oRPC path (hand-added) or explicitly excluded, and that decision is written down.

**Phase 5: folder restructure (FSD client and `server/`)**
- [ ] Each PR moves one area with `git mv` plus import rewrites only, with no behaviour change. The characterization assertion files are byte-identical (only `targets.ts` changed).
- [ ] Every row of the §3 table that the move touches is updated in the same PR: `drizzle.config.ts`, `lib/db/migrate.ts:21`, `package.json:7,14`, `protected-paths.mjs:32` and its test, `components.json`, `biome.jsonc` includes, `globals.css:4`, test-file imports, scripts, CLAUDE.md, `.cursor/rules` and the review agent.
- [ ] The architecture-test allowlist shrinks. At the end it is empty for the client↔server and FSD rules.
- [ ] `pnpm check`, `pnpm test:integration` and Playwright all pass. A Vercel preview deploy runs the migration step (`package.json:7`) successfully.

**Phase 6: versioning hardening**
- [ ] The frozen `v1` snapshot plus the no-removal rule run in CI. There is a documented procedure for adding `v2` (copy the snapshot, mark `deprecated` on the v1 routes, and contract-test that v1 is still served).
- [ ] An oasdiff (or equivalent) breaking-change job exists once a second version exists.

---

## UNVERIFIED

1. The `@orpc/openapi` fetch `OpenAPIHandler` import path (`@orpc/openapi/fetch`). `@orpc/openapi` and `@orpc/zod` are not installed in either repo. Only the docs pages were read.
2. Whether `@orpc/zod`'s `ZodToJsonSchemaConverter` works with schemas from `zod/v4` inside the zod 3.25.76 package. The docs say Zod v4+ is required.
3. The exact default error-body shape of `OpenAPIHandler` (the docs say `error.toJSON()`; the `ORPCErrorJSON` type is verified, the handler's encoding is not).
4. The oasdiff tool and GitHub Action name and version for a breaking-change check.
5. The Neon production Postgres major version (CI uses 16, local 17).
6. That `/ping` (the Playwright webServer readiness URL) is served. No `route.ts` for it was found.
7. Whether tsc's `**/*` include enters the dot-prefixed `.claude/worktrees` (vitest does; Biome does not, because of `.gitignore`).
8. Whether Steiger (the FSD linter) supports the Next.js root `app/` router coexisting with an FSD `app` layer.
9. That GIPITI-28 (`feat/gipiti-28-mcp-integrations-cw6f0r`) is the only live branch, and that the other unmerged branches are abandoned.
10. That the CLAUDE.md references to `.claude/skills/repo-recipes`, `CONTEXT.md` and `docs/adr` come from the GIPITI-28 branch (inferred from its diff, not from reading those files).
