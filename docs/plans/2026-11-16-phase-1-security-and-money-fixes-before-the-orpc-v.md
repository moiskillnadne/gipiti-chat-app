---
date: 2026-11-16
status: accepted
branch: docs/gipiti-230-phase-1-plan
issue: GIPITI-230
---

# Phase 1: security and money fixes before the oRPC v1 migration

## Context

Phase 1 of the accepted roadmap (`docs/plans/2026-11-15-orpc-v1-roadmap.md`) fixes the known security and money defects while the code is still in its current place, so the later move PRs carry no behaviour changes. Phase 0 (tests and CI) is merged, so each fix can now be checked against characterization and integration tests.

State of the Phase 1 list on `main` (`5d7e7c8`), re-checked in the code:

| Item | State |
|---|---|
| 1b auth `update` overrides, 1d webhook signatures, 1j attachment fetch policy | Done in PR #265 |
| 1m connection-pool deadlock | Done in PR #273. The roadmap still lists it as open |
| 1i `migrate.ts` preview guard | Dropped |
| 1c cron | Auth helper done. `cleanup-payment-intents` is not scheduled |
| 1e health and limiter | `rateLimiting.enabled` exists. Health still exposes env var names and raw DB errors; limiters fail open |
| 1a, 1f, 1g, 1h, 1k, 1l | Open |

Found since the roadmap was written, added to this phase:

- **1n, open redirect after login.** `getRedirectPath` in `app/(auth)/login/login-page-client.tsx` returns any `callbackUrl` that starts with `/`, so `//host/path` and `/\host` leave the site.
- **1o, hidden duplicate forms.** `/register`, `/forgot-password` and `/reset-password` keep the `<Suspense>` pattern that PR #274 removed from `/login`.

Outcome: 13 small PRs, each green on `pnpm check`, no file moves.

## Decisions for this phase

| # | Decision | Reason |
|---|---|---|
| P1 | The `[R]` half of 1c (move cron bodies to `server/cron/*`) waits for Phase 3. | `server/` does not exist yet; creating it for one folder is a move mixed into a fix phase. |
| P2 | A cron request with `CRON_SECRET` unset keeps returning 401 (the roadmap said 500). | Already shipped and tested in PR #265; 401 tells a caller less. The roadmap line is corrected. |
| P3 | `cleanup-payment-intents` deletes only `expired` and `failed` intents older than 30 days. Succeeded intents are kept. | Today it deletes every intent older than 30 days. The refund webhook finds the payment by `PaymentIntent.externalTransactionId` (`app/api/webhooks/cloudpayments/lib/handlers/refund.ts:53-59`); with the row gone, a refund of an older payment is logged and not applied. Scheduling the cron as it is would start that. |
| P4 | Health keeps the field `checks.rateLimiting.enabled` (the roadmap said `rateLimiter: "missing"`). | It is shipped and described in `lib/agent-discovery/openapi.ts`. |
| P5 | Fail-closed limiters apply only when `VERCEL_ENV === "production"`. | Owner decision Q8. Previews and local runs may have no Upstash. |
| P6 | Email verification gets both a 5-attempt cap per code and a per-email limiter (10 checks per hour). | The cap alone still allows 5 guesses per resend, and a resend is allowed every 60 s. |
| P7 | Login limits live in `authorize`, not in the `login` action. | `POST /api/auth/callback/credentials` reaches `authorize` without the action. |
| P8 | Register limit is 20 per hour per IP (IPv6 by /64). | Mobile carriers in Russia put many users behind one address; a tight limit would block real sign-ups. The value is one constant. |
| P9 | The disposable-domain list is a vendored snapshot of the public CC0 `disposable-email-domains` list, in `lib/auth/`. | No runtime dependency and no network call at sign-up. `core/validation/` (the roadmap's place) does not exist yet. |
| P10 | Model-written image URLs are fetched with `node:https` and a `lookup` hook that rejects non-public addresses. | The check then runs on the address that is actually connected to, so a DNS answer cannot change between check and connect. Global `fetch` cannot do this without a new dependency. |
| P11 | The image fetcher accepts `https` only. | Plain `http` images in generated documents stop loading and fall back to their alt text. This is a visible change. |

## Order of work

One Linear issue in team `GIPITI` for the phase; every commit references it. Each item is one PR from `origin/main`. 1e, 1f and 1g all edit `lib/rate-limit.ts`, `app/(auth)/actions.ts` and `tests/characterization/auth-actions.test.ts`, so they go strictly in that order. 1h-c merges only after 1c is deployed. The others are independent.

### 0. Docs PR

This plan, plus roadmap edits: 1m done (#273); the login flake fixed (#274); new items 1n and 1o; decisions P1-P4 where they change roadmap wording; Q11 note that the cron cleans no refresh tokens yet.

### 1a. Delete orphans

- Delete after a symbol grep for each: `components/sign-out-form.tsx`, `components/usage-limits-widget.tsx`, `lib/subscription/use-cancel-subscription.ts`, `app/api/me/`, `lib/format-tokens.ts`, `components/{cancellation-feedback-dialog,suggested-actions,url-extract-input-preview,url-extract-result,video-player,web-search-input-preview,web-search-result}.tsx`, `components/elements/{branch,context,image,inline-citation,task,tool,usage-hint,web-preview}.tsx`. Keep the shadcn primitives in `components/ui/`.
- Remove `GET` from `app/(chat)/api/subscription/route.ts` (every caller uses `DELETE`) and the dead `/api/*` branch in `proxy.ts:87-94` (the matcher excludes `api/`).
- Same PR, or the checks fail: remove the `sign-out-form` entry from `tests/architecture/allowlist.ts`; change `app/(chat)/api/subscription/__tests__/route.test.ts`, which requires a `GET` export.
- Remove the i18n keys only these files used (`auth.subscription.limits.*`, `auth.subscription.management.dangerZone.*`, `chat.empty.suggestions.*`, `chat.tools.*`, `usage`), each after a grep.

Verify: `pnpm check`; `pnpm vitest run tests/architecture`.

### 1n. Open redirect after login

- New pure helper `lib/auth/safe-redirect-path.ts`: `getSafeRedirectPath(callbackUrl, origin)`. Always parse with `new URL(callbackUrl, origin)`; accept only the same origin; reject a result whose path starts with `//`; return `pathname + search + hash`, otherwise `/chat`. No `startsWith("/")` shortcut.
- `login-page-client.tsx` calls it; `proxy.ts` keeps writing the absolute URL.
- Tests: a unit table (`//host`, `/\host`, `///host`, `/.//host`, `javascript:`, absolute same-origin, absolute foreign, plain path with query and hash); two e2e cases in `tests/e2e/login.test.ts` for `//malicious-site.com` and `/\malicious-site.com`.

### 1c. Schedule the intent cleanup

- `app/api/cron/cleanup-payment-intents/route.ts`: one `UPDATE … RETURNING` for pending intents past `expiresAt`; one `DELETE` limited by P3; fix the "7 days" log line.
- `vercel.json`: `15 * * * *` (the project already runs 10-minute crons, so the plan allows it).
- Tests: a route unit test (401 without the secret, counts in the response) and an integration test on real Postgres: an expired pending intent becomes `expired`; an old succeeded intent survives; an old expired one is deleted.
- `CLAUDE.md`: the cron list matches `vercel.json`.

Verify after deploy: the cron run in Vercel logs; `curl` with and without the secret on a preview.

### 1h-a. `PATCH /api/vote`

- `app/(chat)/api/vote/route.ts`: auth first; zod body (`chatId` uuid, `messageId` uuid, `type` `up | down`), unparseable JSON → 400 `bad_request:api`; 404 unless the message belongs to the chat (reuse the message query in `lib/db/query/`, add one if none fits).
- `lib/db/query/chat/vote-message.ts`: upsert on the primary key `(chatId, messageId)` instead of the lookup by `messageId` alone.
- `components/message-actions.tsx`: reject the toast promise when `!response.ok`, so a refused vote is not shown as saved.
- Tests: new `app/(chat)/api/vote/__tests__/route.test.ts`.

### 1h-b. `DELETE /api/subscription`

- The `catch` around the CloudPayments calls (`route.ts:154-156`) returns 502 `{ error: "payment_provider_error" }` (same shape as `subscription/resume/route.ts`) before feedback is saved and before the local update. Remove the `console.log`.
- `cancel-flow-dialog.tsx` already handles a non-OK response.
- Tests: CloudPayments throws → 502 and no local update; `Success: false` → 502; success → 200 and the update.

### 1h-c. `GET /api/payment/status` stops writing (after 1c is live)

- `app/api/payment/status/route.ts`: a pending intent past `expiresAt` is reported as `expired` with the same body, without the `UPDATE`. Both pollers (`use-payment.ts`, `top-up-dialog.tsx`) already treat `expired` as final.
- **Label `characterization-change`**: `tests/characterization/payment-intents.test.ts:492` pins the write.

### 1e. Health redaction and fail-closed limiters

- `app/api/health/route.ts`: `error` fields become fixed strings, `checks.environment` loses `configured` and `missing`; details go to the server log. No OpenAPI change (`HealthCheck` already declares only `status`, `latency`, `error`).
- `lib/rate-limit.ts`: export `isRateLimitingConfigured`; auth limiters (resend code, password reset now; verify, login, register as 1f and 1g add them) return `{ success: false, isUnavailable: true }` in production when Upstash is missing or throws. Chat and payment-status stay fail-open. Existing export names and call signatures do not change, so the characterization mocks stay valid.
- Actions return `failed` for `isUnavailable`.
- Tests: rewrite the fail-open case in `lib/__tests__/rate-limit.test.ts`; update `app/api/health/__tests__/route.test.ts`.

### 1f. Verification code: scoped lookup and attempt cap

- Migration `0046_email_verification_attempts.sql`: `"email_verification_attempts" integer NOT NULL DEFAULT 0` on `User`, journal entry, `schema.ts` (hand-written, per the `repo-recipes` skill; `0043` is the pattern).
- `verifyEmail`: limiter (P6), then one statement that takes an attempt for the user with this normalized email (`attempts < 5`, code not expired) and returns the stored hash; compare with `timingSafeEqual`. The fifth miss clears the code (`clearEmailVerificationCode` exists and is unused today). No more lookup by code across all users.
- `setEmailVerificationCode` and `markEmailAsVerified` reset the counter. `sendVerificationEmail`: `randomInt` upper bound → `1_000_000`.
- **Label `characterization-change`**: the tests at `auth-actions.test.ts:450-565` pin the global lookup and the case-sensitive email compare.
- Tests: unit tests for the new query; an integration test that 6 parallel wrong guesses consume exactly 5 attempts.

### 1g. Login and register limits, disposable domains

- `lib/http/client-ip.ts`: first `x-forwarded-for` entry, IPv6 reduced to /64, `null` when absent.
- `lib/rate-limit.ts`: login limiters from roadmap line 413: (email, IP) 10 per 15 min and IP 60 per 15 min block; email 50 per hour adds a 2 s delay and never blocks. Register: P8.
- `authorize(credentials, request)` in `app/(auth)/auth.ts`: reads `request?.headers` (guarded, the characterization test calls it with one argument); on a block throws a `CredentialsSignin` subclass with `code = "rate_limited"`. The `login` action maps it to a new `rate_limited` status with an i18n message.
- `register`: limiter, then `lib/auth/disposable-email-domains.ts` (P9) → new status `disposable_email` with an i18n message.
- **Label `characterization-change`**: the mock factories in `auth-actions.test.ts` need the new limiter exports and `headers`.

### 1k. Welcome grant in the user-insert transaction

- `lib/billing/balance.ts`: `getBalance`, `ensureBalance` and `creditBalance` take `executor: DatabaseExecutor = db` (type from `lib/db/connection.ts`, same pattern as `fx.ts` after #273); `creditBalance` opens its transaction on the executor (a savepoint when nested).
- `lib/db/query/user/create-user.ts`: insert, balance row and grant in one `db.transaction`, every query through `tx`; a unique violation still becomes `DuplicateEmailError`; minor units from `getMinorUnits(code, tx)` instead of the literal `2`.
- Tests: integration test next to the query: success leaves one user, one balance, one `welcome` row; a failing grant leaves no user; a duplicate email leaves one user. `register`'s call is unchanged, so no characterization change.

### 1l. Fetch policy for model-written image URLs

- New `lib/ai/remote-image-fetch.ts` (P10, P11): no credentials, default port, at most 3 redirects with every hop re-checked, `content-type: image/*`, `Content-Length` check plus a streaming cap of 10 MB, 10 s per image, 20 s for the batch, 4 at a time. Blocked: loopback, private, CGNAT, link-local and metadata, unique-local, multicast, reserved, IPv4-mapped forms (`node:net` `BlockList`).
- `lib/ai/docx-images.ts` and `lib/ai/pdf-images.ts` call it; their duplicated fetch code goes away.
- Tests: address table; URL checks; redirect to a private address; content type; both caps. `lib/ai/__tests__/document-images.test.ts` mocks the new module by `@/` path.

### 1o. Auth pages without `<Suspense>` (lowest priority)

- `/register` and `/forgot-password`: drop the boundary (neither reads the query string). `/reset-password`: the server page reads `searchParams` and passes `token` as a prop.
- One e2e test per page like the login one: the form is in the first HTML chunk, exactly once.

## Files that change

| PR | New | Edited | Deleted |
|---|---|---|---|
| 1a | | `proxy.ts`, `subscription/route.ts` and its test, `tests/architecture/allowlist.ts`, `messages/ru.json` | ~20 orphan files, `app/api/me/` |
| 1n | `lib/auth/safe-redirect-path.ts` + test | `login-page-client.tsx`, `tests/e2e/login.test.ts` | |
| 1c | 2 tests | cron route, `vercel.json`, `CLAUDE.md` | |
| 1h-a | route test | `vote/route.ts`, `vote-message.ts`, `message-actions.tsx` | |
| 1h-b | route test | `subscription/route.ts` | |
| 1h-c | | `payment/status/route.ts`, 1 characterization test | |
| 1e | | `health/route.ts`, `lib/rate-limit.ts`, `actions.ts`, 2 tests | |
| 1f | migration `0046`, query + tests | `schema.ts`, journal, `actions.ts`, user queries, 1 characterization test | |
| 1g | `lib/http/client-ip.ts`, `lib/auth/disposable-email-domains.*`, tests | `auth.ts`, `actions.ts`, `lib/rate-limit.ts`, login and register clients, `messages/ru.json`, 1 characterization test | |
| 1k | integration test | `balance.ts`, `create-user.ts` | |
| 1l | `lib/ai/remote-image-fetch.ts` + test | `docx-images.ts`, `pdf-images.ts`, 1 test | |
| 1o | 3 e2e tests | 3 auth pages | |

## Risks

| Risk | Mitigation |
|---|---|
| Fail-closed limiters block login, sign-up and password reset while Upstash is down | Accepted by the owner (Q8). Production only; `/api/health` shows the limiter state. Revert of 1e restores fail-open. |
| An IP limit blocks real users behind one carrier address | Loose values (P8); the per-email login limit delays and never blocks; constants in one file. |
| The disposable list rejects a real provider | The list is a file in the repo; removing a line is a one-line PR. |
| 1h-c lands before the cron runs, so intents stay `pending` in the DB | Merge order; and the check webhook already rejects by `expiresAt`, not by status. |
| Three PRs change pinned behaviour | Each carries the `characterization-change` label and names the changed tests in its body. |
| Deleting an "orphan" that is loaded by a string path | Grep each symbol and path before deleting; `next build` in `pnpm check`. |
| `https`-only images change generated documents | Stated in the PR; the fallback to alt text already exists. |

## Verification

- Every PR: `pnpm check`; `pnpm test:integration` when it touches the DB (1c, 1f, 1k).
- `pnpm exec playwright test tests/e2e/login.test.ts` for 1n, 1g, 1o.
- CI green, including `characterization-diff` (skipped only on the three labelled PRs).
- On a preview deployment: cron call with and without the secret (1c); `GET /api/health` shows no env names (1e); six wrong verification codes, then the right one is refused (1f); a document with an image from a public host and one from `http://169.254.169.254/` (1l).
- Owner, on a preview: one CloudPayments test-mode payment and a subscription cancel (1h-b, 1h-c).
- Rollback: revert the single PR. Migration `0046` is additive.
- When all PRs are merged: Phase 1 marked done in the roadmap, `status: done` in this plan.
