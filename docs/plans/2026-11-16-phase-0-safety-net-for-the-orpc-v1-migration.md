---
date: 2026-11-16
status: done
branch: docs/gipiti-227-orpc-v1-roadmap
session: 8b251a3d-a790-43ee-8ff7-78bff99f4bb8
---

# Phase 0: safety net for the oRPC v1 migration

## Context

The accepted roadmap (`docs/plans/2026-11-15-orpc-v1-roadmap.md`, decision D17) moves most of the server code into `server/` and replaces server actions with a REST API. Before any file moves, the money and auth paths need tests that survive the moves, and CI needs to catch what only Vercel's build catches today. Phase 0 adds that safety net and changes no runtime behaviour.

What is true on `origin/main` (`f696db7`) today:

- `vitest.config.ts` has no `exclude`, so `pnpm check` collects tests from the 14 directories under `.claude/worktrees/` and fails in this checkout.
- CI runs lint and unit tests only: no typecheck, no build.
- The Playwright workflow is red on every run (26 failed, 14 cancelled of the last 40). The tests pass; the job fails in the `Post Run actions/setup-node@v4` cache step, because the workflow sets Node up twice with `pnpm/action-setup@v2` `version: latest`.
- No test calls the CloudPayments webhook route, any auth server action, or `POST /api/chat` `route.ts`. No test touches a real database, so row locking and unique constraints on the money path are unproven.
- 11 `vi.mock` calls in 7 test files use relative specifiers. When a file moves, such a mock silently stops applying.

Outcome: five small PRs, each green on `pnpm check`, after which a move PR can prove "behaviour unchanged" with a characterization diff that contains only import specifiers.

## Decisions for this phase

| # | Decision | Reason |
|---|---|---|
| P1 | Integration tests get their own config file, `vitest.integration.config.ts`, not a second `projects` entry. | A bare `vitest run` and `pnpm check` can then never start a DB test. `CLAUDE.md` promises that `pnpm check` never touches the DB. The roadmap wording "vitest project" is updated to match. |
| P2 | The integration DB is named by `TEST_POSTGRES_URL`. The setup refuses to run unless the host is `localhost` or `127.0.0.1` **and** the database name ends in `_test`. | The tests truncate tables. The local dev database lives in the same `gipiti-db-local` container and must not be wiped. |
| P3 | The diff guard compares files after replacing module specifiers with a placeholder (TypeScript AST), not by line regex. | Biome re-wraps an import when its path gets longer, so a line-based rule would reject pure moves. |
| P4 | No coverage thresholds yet. Coverage is measured and uploaded in CI. | The roadmap sets thresholds per `server/` folder, and those folders do not exist until Phase 3. |
| P5 | `lint.yml` and `unit-tests.yml` are replaced by one `ci.yml`. | `main` has no branch protection, so no required check name breaks. One file keeps pnpm and Node versions in one place. |
| P6 | CI does not run `next build`. | Vercel builds every PR. `pnpm check` (with build) stays the local gate. |

## Implementation notes (2026-11-16)

Implemented as PRs #267 (0a), #268 (0b), #269 (0c), #270 (0d) and #271 (0e); this plan and the roadmap are in #266. All six were merged on 2026-11-16. Where the work departed from the plan below:

- **0c, five test files instead of four.** `authorize` needs the real `app/(auth)/auth.ts`, which `auth-actions.test.ts` mocks, so it has its own file, `auth-authorize.test.ts`.
- **0c, `targets/` is a folder.** One re-export module per area instead of a single `targets.ts`: a single file would make every test load every entry point and mock all of their dependencies. `biome.jsonc` turns `noBarrelFile` off for that folder.
- **0c, the guard ignores comments** as well as whitespace, because it compares token streams.
- **0c, more cases than planned** (113 tests): the agents pinned extra behaviour they found in the code, listed in #269.
- **0d, `test-database-url.ts`** is the guard's file name (the plan said `assert-test-database.ts`). It also reads only `TEST_POSTGRES_URL` from `.env.local`, so no other secret from that file reaches the tests.
- **0d, the concurrency case runs 5 charges, not 10.** Ten simultaneous `chargeUsage` calls exhaust the connection pool and never finish. That is a defect in the code, recorded as roadmap item (1m), not a test limitation to paper over.
- **0d, extra cases**: an amount mismatch credits nothing; a wrong signature is rejected before any write.
- **0e, the allowlist has two entries**, both listed in #271.

- **Open after the merge: the Playwright job is flaky.** Now that the workflow reports real results, runs fail in one or two login tests, different ones each time, always with `strict mode violation: locator('#email-display') resolved to 2 elements`. No Phase 0 change touches the app or the e2e tests. It needs its own investigation before the job can gate merges.

## Order of work

Each item is one PR from `origin/main`, merged in this order. 0c, 0d and 0e all edit `vitest.config.ts` or `ci.yml`, so they are not opened in parallel.

### Before 0a: docs PR

Commit the untracked roadmap, `docs/plans/orpc-v1-roadmap/` and this plan on a `docs/` branch. Create one Linear issue in team `GIPITI` for Phase 0 and reference it in every commit below.

### 0a. Test collection and mock hygiene

- `vitest.config.ts`: `exclude: [...configDefaults.exclude, ".claude/**", "**/.next/**"]`.
- `tsconfig.json`: add `.claude` to `exclude` (a precaution; `tsc` already skips dot-directories).
- Rewrite the 11 relative `vi.mock` specifiers to `@/…` in:
  - `app/(chat)/api/chat/_lib/__tests__/{image-generation-stop,turn-slot-release,video-generation-stop}.test.ts`
  - `lib/ai/tools/__tests__/{generate-csv,generate-txt}.test.ts`
  - `lib/billing/__tests__/{charge-usage-shortfall,turn-balance}.test.ts`
- `lib/marketing/__tests__/model-landings.test.ts:19`: build the `public` path from `process.cwd()`.
- After merge, drop the `--exclude ".claude/**"` workaround from the owner's memory note on local testing.

Verify: `pnpm check` passes in this checkout without `--exclude`; test count equals the count from `pnpm vitest run --exclude ".claude/**"` before the change.

### 0b. CI

- New `.github/workflows/ci.yml`, on `push` and `pull_request` to `main`, Node 22, `pnpm/action-setup@v4` (version from `packageManager`), `pnpm install --frozen-lockfile`:
  - job `static`: `pnpm typecheck`, `pnpm lint` as separate steps;
  - job `unit`: `pnpm vitest run --coverage`, upload `coverage/` as an artifact.
- Delete `lint.yml` and `unit-tests.yml`.
- `playwright.yml`: same pnpm and Node setup as `ci.yml`, one `setup-node` step, drop the hand-rolled store cache, `actions/cache@v4` for browsers.
- Add `@vitest/coverage-v8@4.1.12` (exact; npm `latest` is 5.1.0 and does not match the installed vitest 4.1.12). `vitest.config.ts` gets `coverage: { provider: "v8", reporter: ["text-summary", "json-summary"], include: ["app/**", "lib/**"] }`. `coverage/` is already in `.gitignore`.

Verify: all three jobs green on the PR, including Playwright for the first time; the `static` job fails on a deliberate type error pushed to a throwaway branch.

### 0c. Slim characterization tests and the diff guard

Location `tests/characterization/` (does not move in later phases), added to the vitest `include`. Playwright ignores it: its projects match only `e2e/` and `routes/`.

- `targets.ts`: the only file that imports the code under test. It re-exports the webhook `POST`, the six auth actions, the chat `POST`, the two create-intent `POST`s and the payment-status `GET` from their current paths. A move PR edits this file and the `vi.mock` specifiers, nothing else.
- Style: copy `app/api/payment/create-intent/__tests__/route.test.ts` (AAA comments, `vi.hoisted` spies, `auth` cast to the session getter) and the queued `db.select()` fake from `app/api/webhooks/cloudpayments/lib/handlers/__tests__/tester-plan.test.ts`. All `vi.mock` specifiers use `@/`.

| File | Pins | Mocked |
|---|---|---|
| `cloudpayments-webhook.test.ts` | `?type=` missing or unknown → 400; missing or wrong `Content-HMAC` → 401 `{code:13}`; valid signature dispatches; JSON and form-urlencoded bodies; unparseable body → 200 `{code:13}`; `recurrent` without `Status`/`Id` → 400; top-up routing (`Data.kind === "topup"` or an intent found by session) calls `creditTopupForIntent`; subscription pay calls `resetSubscriptionPool` with `type: "subscription_purchase"`; already-succeeded transaction → `{code:0}` and no credit; refund calls `applyPaymentRefund`, and `duplicate` → `{code:0}` | `@/lib/payments/cloudpayments-config` (test secret, real HMAC computed in the test), `@/lib/db/connection`, `@/lib/billing/{balance,subscriptions,refund}`, `@/lib/payments/cloudpayments`. Handlers and `signature.ts` stay real. |
| `auth-actions.test.ts` | Every returned `status` of `login`, `register`, `verifyEmail`, `resendVerificationCode`, `requestPasswordReset`, `resetPassword`, including the anti-enumeration paths (unknown email → `success`) and rate-limit payloads. Plus `authorize` in `app/(auth)/auth.ts`: unknown user and wrong password both return `null` and both run one `compare` (captured the way `app/(auth)/__tests__/auth-jwt-callback.test.ts` captures the config). | `@/app/(auth)/auth`, `next/headers`, `@/lib/flags`, `@/lib/rate-limit`, `@/lib/geo/registration-geo`, the user query modules, the three email senders, `@/lib/billing/balance`. `DuplicateEmailError` stays real via `importActual`. |
| `chat-post.test.ts` | Guards only, no inference: invalid body → 400 `bad_request:api`; no session → 401 `unauthorized:chat`; rate limit → 429 `rate_limit:chat`; empty balance → 429 `quota_exceeded:chat`, the notice is saved, the turn slot is released, no mode handler runs; a sufficient balance calls the text handler exactly once. | `@/app/(auth)/auth`, `next/server` (`after`), `@vercel/functions`, `@/lib/activity/record-user-activity`, `@/lib/rate-limit`, `@/lib/billing/{turn-slots,turn-balance}`, the chat and project query modules, the three `_lib/handlers/*`, `_lib/persist-assistant-turn`, `_lib/stream-context`. |
| `payment-intents.test.ts` | `topup/create-intent`: 401, flag off 403, bad amount 400, no subscription 403, bad JSON 500 (as it is today), 200 insert shape. `payment/status`: 401, 400, 429 with `Retry-After`, 404, the write that flips a stale pending intent to `expired`, both `succeeded` shapes. `payment/create-intent`: 401 and the 200 insert shape (the 7 colocated cases stay where they are). | `@/app/(auth)/auth`, `@/lib/flags`, `@/lib/rate-limit`, `@/lib/db/connection`, `@/lib/billing/{balance,subscriptions}`, the user and subscription query modules. |

Charging itself is not re-pinned here: `_lib/__tests__/{turn-lifecycle,turn-slot-release}.test.ts` already cover "charge once per turn" with a real `streamText`, and 0d covers `chargeUsage` on a real database.

Diff guard:

- `scripts/check-characterization-diff.ts [base]` (default `origin/main`), with the comparison in a pure function under `scripts/lib/` and a unit test in `scripts/__tests__/`.
- Reads `git diff --name-status base...HEAD -- tests/characterization`. Added files pass. `targets.ts` is free. A modified `*.test.ts` passes only if both versions are equal after every module specifier (import declarations, `vi.mock`, `vi.doMock`, `vi.importActual`, dynamic `import()`) is replaced by a placeholder and whitespace is collapsed. Deleted or renamed test files fail.
- CI job `characterization-diff` in `ci.yml`, `pull_request` only, `fetch-depth: 0`, skipped when the PR carries the label `characterization-change`.

Verify: `pnpm vitest run tests/characterization`; flip one status code in the webhook route locally and see the matching test fail; run the guard against a branch that edits an assertion (fails) and one that edits only a specifier (passes).

### 0d. Integration tests on a real Postgres

- `vitest.integration.config.ts`: `include: ["**/__integration__/**/*.test.ts"]`, the same `exclude` as the unit config, `fileParallelism: false`, `globalSetup: "tests/integration/global-setup.ts"`, alias `server-only` → `tests/integration/server-only-stub.ts`. The config loads `.env.local`, runs the P2 guard on `TEST_POSTGRES_URL`, and passes it to the tests as `POSTGRES_URL` through `test.env`, because `lib/db/connection.ts` reads that variable once at import. It also sets test values for `CLOUDPAYMENTS_PUBLIC_ID` and `CLOUDPAYMENTS_API_SECRET`.
- `tests/integration/assert-test-database.ts` (the guard) with a unit test in `tests/integration/__tests__/`.
- `tests/integration/global-setup.ts`: guard again, create the database if it is missing, then `migrate(db, { migrationsFolder: "./lib/db/migrations" })` from `drizzle-orm/postgres-js/migrator` (the script `lib/db/migrate.ts` cannot be imported, it calls `process.exit`).
- `tests/integration/helpers.ts`: `resetMoneyTables()` truncates only the tables these tests write (`User`, `Balance`, `Transaction`, `PaymentIntent`, `UserSubscription`, `FxRate`); `seedCurrency`, `seedFxRate`, `seedUserWithBalance`, `seedPaymentIntent` upsert what a test needs; `signedWebhookRequest(type, payload)` builds a `Request` with a real `Content-HMAC`.
- No module-path mocks. The one outbound call (`cancelSubscription` to CloudPayments on a full refund) is stubbed with `vi.spyOn(globalThis, "fetch")`.

| File | Cases |
|---|---|
| `lib/billing/__integration__/charge-usage.integration.test.ts` | drains the subscription pool, then the top-up pool; floors at zero and records the shortfall in `Transaction.metadata`; 10 concurrent `chargeUsage` calls leave `start − sum` and 10 `usage_debit` rows (proves the `FOR UPDATE` lock); no `FxRate` row → returns `null`, balance unchanged |
| `app/api/webhooks/cloudpayments/__integration__/cloudpayments-webhook.integration.test.ts` | top-up `pay` delivered twice → one credit, one `topup_purchase` row; the same delivery twice in parallel → one credit; refund debits the pool the payment credited, floored at zero; the same refund id again → no second debit; a full subscription refund sets the subscription to `cancelled` |

- `package.json`: `"test:integration": "vitest run --config vitest.integration.config.ts"`.
- `.env.example`: `TEST_POSTGRES_URL=postgresql://postgres:postgres@localhost:5432/gipiti_test`. The owner adds the real line to `.env.local`.
- `ci.yml` job `integration`: `postgres:17` service (matches the local container), `TEST_POSTGRES_URL` pointing at it, `pnpm test:integration`.
- `CLAUDE.md`: document `pnpm test:integration`, the `_test` rule and the `__integration__` folder convention.

Verify: `docker start gipiti-db-local && pnpm test:integration`; row counts in the dev database are the same before and after; with `TEST_POSTGRES_URL` pointing at the dev database name the run refuses to start; remove `.for("update")` from `chargeUsage` locally and see the concurrency case fail.

### 0e. Architecture test

- `tests/architecture/boundaries.test.ts` (added to `include`): walks `git ls-files '*.ts' '*.tsx'`, extracts imports with `ts.preProcessFile`, resolves `@/` and relative specifiers to repo paths.
- Rules active today:
  1. files under `lib/` do not import `app/**`;
  2. client modules (`"use client"` files, `components/`, `hooks/`, `contexts/`) import `lib/db/**` and `app/(auth)/auth` only as `import type`;
  3. every `vi.mock` / `vi.doMock` / `vi.importActual` specifier resolves to an existing file or installed package, and none is relative;
  4. no file imports `ResponseValidationPlugin`.
- Rules written now and vacuous until the folders exist: the `app` / `client` / `server` / `core` table from the roadmap section "Dependency rules".
- `tests/architecture/allowlist.ts`: today's violations as `{ from, to, reason }`. The test fails on a violation that is not listed and on a listed entry that no longer occurs, so the list can only shrink.

Verify: `pnpm vitest run tests/architecture`; adding `import { db } from "@/lib/db/connection"` to a client component makes it fail.

## Files that change

| PR | New | Edited | Deleted |
|---|---|---|---|
| docs | `docs/plans/2026-11-15-orpc-v1-roadmap.md`, `docs/plans/orpc-v1-roadmap/*`, this plan | | |
| 0a | | `vitest.config.ts`, `tsconfig.json`, 8 test files | |
| 0b | `.github/workflows/ci.yml` | `playwright.yml`, `vitest.config.ts`, `package.json`, `pnpm-lock.yaml` | `lint.yml`, `unit-tests.yml` |
| 0c | `tests/characterization/{targets.ts, 4 test files}`, `scripts/check-characterization-diff.ts`, `scripts/lib/*`, `scripts/__tests__/*` | `vitest.config.ts`, `ci.yml` | |
| 0d | `vitest.integration.config.ts`, `tests/integration/*`, 2 `__integration__` test files | `package.json`, `.env.example`, `ci.yml`, `CLAUDE.md` | |
| 0e | `tests/architecture/{boundaries.test.ts, allowlist.ts}` | `vitest.config.ts` | |

No file under `app/` or `lib/` changes outside `__tests__` and `__integration__` folders.

## Risks

| Risk | Mitigation |
|---|---|
| Integration tests run against a real database by mistake | P2 guard, covered by its own unit test; the script is not part of `pnpm check`. |
| Characterization tests pin a bug | They pin behaviour as it is. A Phase 1 fix that changes pinned behaviour updates the test in the same PR under the `characterization-change` label. |
| The diff guard blocks a legitimate change | The label bypass; the guard only runs on `pull_request`. |
| Heavy mocking makes the chat POST test brittle | It stops before inference and asserts only status, error code and that charging was not called. |
| `ci.yml` rename loses a required check | Checked: `main` is not protected. |

## Verification (whole phase)

- `pnpm check` green on every PR.
- `pnpm vitest run tests/characterization tests/architecture`.
- `pnpm test:integration` locally against `gipiti_test` in the `gipiti-db-local` container.
- CI: `static`, `unit`, `characterization-diff`, `integration`, `playwright` all green on the last PR.
- Roadmap: tick Phase 0 and record deviations P1 and P5 in the same PR that introduces them.
