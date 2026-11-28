---
date: 2026-11-22
status: done
branch: chore/gipiti-263-auth-move-preparation
issue: GIPITI-263
session: 4693d346-d6e1-4c17-8c91-f2d2f42edc76
---

# Phase 4: Auth v1 — the auth module in server/, revocable sessions, bearer tokens and /api/v1/auth

## Context

Phases 0 to 3 are done: the safety net, the security fixes, the oRPC kit with four read endpoints, and the infrastructure under `server/`. Phase 4 of the roadmap (`docs/plans/2026-11-15-orpc-v1-roadmap.md`, "Auth design" and "Phase 4") is what a mobile client needs first: it can register, sign in and stay signed in with bearer tokens, and a session can be revoked. Today the only credential is the NextAuth cookie, a stateless 30-day JWT that survives a password reset, and `/api/v1` answers 401 to any `Authorization` header.

Research for this plan found four things the roadmap does not say:

- **A revoked web cookie would loop between `/login` and `/chat`.** The roadmap relies on "the `jwt` callback returns `null`, which clears the cookie". That is true only for `GET /api/auth/session`. `auth()` in a page or a route handler reads the session response and drops its `Set-Cookie` headers (`next-auth/lib/index.js`, `getSession(...).then(parseSessionResponse)`). `proxy.ts` uses `getToken`, which never runs the callback. So after a revocation the page redirects to `/login`, and the proxy, still seeing a decodable cookie, redirects back to `/chat`. The proxy has to check the version too and delete the cookie (P4).
- **`lib/geo/registration-geo.ts` cannot move into `server/modules/` as it is.** It imports `next/headers`, and the architecture rule forbids the `next` package there (`tests/architecture/rules.ts`, `DOMAIN_FORBIDDEN_PACKAGE_PATTERN`). `next-auth` is a different package name and is allowed. A small preparation PR makes the function take the reader of the headers as an argument.
- **Not everything in `lib/auth` is server code.** `safe-redirect-path.ts` is imported by the login page (client), `lib/utm/constants.ts` by `components/utm-capture.tsx`, `lib/validation/password.ts` by `components/password-input.tsx`. They stay where they are until Phase 11.
- **The client names its own platform**, so "defer the welcome grant for ios and android only" (owner decision Q5) can be bypassed by sending `web`.

Owner decisions taken for this plan (2026-11-20): the move comes first, as the roadmap orders it; every registration through `POST /api/v1/auth/register` gets the welcome grant only after the email is verified.

Outcome: seven PRs and a docs PR. After them the auth code lives in `server/modules/{auth,users,email}`, a password reset or "log out everywhere" ends every web and mobile session at once, and `/api/v1/auth/*` (12 operations) works with bearer tokens next to the cookie.

## Decisions for this phase

| # | Decision | Reason |
|---|---|---|
| P1 | Order: preparation, move (4a), services (4b), token version (4c), tokens and sessions (4d-1), account endpoints (4d-2), grant deferral (4e). | Owner decision. Everything 4b to 4d writes is extracted from, or sits next to, the files 4a moves; with the module under `server/` the kit imports `auth` and `signIn` directly. |
| P2 | Stay in `lib/` for now: `lib/auth/safe-redirect-path.ts`, `lib/utm/constants.ts`, `lib/validation/password.ts`. Nothing moves to `core/`. | Client code imports them. No contract file imports them: the password rule is checked in the service, so that a weak password answers `BAD_REQUEST` with `data.reason: "weak_password"` and not a generic validation error. |
| P3 | The three env booleans of `lib/constants.ts` move to `server/env.ts` as a plain move, after the preparation PR takes `DUMMY_PASSWORD` out of the file. | All six importers are server code. Without `DUMMY_PASSWORD` the file no longer pulls `bcrypt-ts` and the database utils into `proxy.ts`. The roadmap planned a split; this is simpler. |
| P4 | `proxy.ts` compares the cookie's `ver` claim with the user's token version on the three branches where the token decides something (`/`, protected routes, auth routes). A stale cookie counts as no cookie and is deleted on the response. | The redirect loop described above. The check costs one Redis read on a page navigation, never on `/api/*` (the matcher excludes it). |
| P5 | `getTokenVersion(userId)` reads Redis key `tv:<userId>` and falls back to the database, which it loads lazily. A bump writes the new value to Redis (`rememberTokenVersion`: `SET` with a 10-minute expiry) after the database update. A value read from the database on a cache miss is written with `NX`, so it cannot replace the number a bump wrote in between. When the version cannot be read at all (Redis and the database both failing), the session is kept and an error is logged. | Write-through as in the roadmap, plus a bound: if the Redis write fails, a stale value lives 10 minutes at most instead of forever. The lazy import keeps the database driver out of the proxy unless Redis is missing. Keeping the session on a failed read: `GET /api/auth/session` deletes the cookie when the callback ends a session, so a database blip would sign out every open tab; and nothing a stale session could reach works without the database. |
| P6 | A cookie without a `ver` claim counts as version 0. | Nobody is signed out by the deploy. |
| P7 | The password update, the version bump and the revocation of the user's `AuthSession` rows happen in one database transaction, inside `updateUserPassword`. | Atomic. The characterization test already mocks that query module, so the web `resetPassword` action keeps its pinned behaviour with no change to the test. |
| P8 | Services return a discriminated result (`{ status: "ok", … } \| { status: "user_exists" } \| …`); they do not throw for expected outcomes and never read `headers()` or `cookies()`. | The actions map a status to their form state as today; the routers map it to a wire error. `server/modules` may not import `next` or `@orpc/*`. |
| P9 | The CSRF check is part of the principal middlewares: a cookie principal on a method other than GET or HEAD must send `Sec-Fetch-Site: same-origin` or an `Origin` whose host is the request's own. Bearer and in-process callers skip it. | These are the first cookie-authenticated mutations in v1. Inside the middleware no procedure can forget the check. Kit decision P5 of Phase 3: written in the phase that first needs it. |
| P10 | The `getCookieSession` indirection goes away in 4d-1: `guards/principal.ts` imports the cookie session from `server/modules/auth`. Tests mock that module by its `@/` path. | It existed only because the auth module was under `app/` (Phase 3, P6). |
| P11 | A second refresh with an already used token inside 30 seconds gets a sibling pair, two at most. Past that cap, still inside the window: 401 without revoking. After the window: the session is revoked (`refresh_reused`). | Roadmap M3. The cap bounds how many tokens one refresh token can mint; refusing without revoking keeps a burst of parallel refreshes from signing the user out. |
| P12 | `POST /auth/password/change` answers 200 with `{ tokens: TokenPair \| null }`, not 204. A bearer caller gets a new pair; a cookie caller gets a fresh cookie through the server-side `signIn` and `tokens: null`. | The change bumps the token version, which ends the caller's own session too; a 204 cannot carry the new pair. |
| P13 | `POST /auth/register` accepts `client.platform` `ios` or `android` only, always issues tokens, and always defers the welcome grant. The output field `tokens` is declared nullable from the start. `web` is added in Phase 7 together with the rule for the web form. | Owner decision. Widening an input enum later is additive; making an output nullable later would be breaking. |
| P14 | The deferral marker is a new column `User.signup_platform` (null for web and old accounts), in its own migration `0048`. At verification the welcome grant is credited when the column is set and no `welcome` transaction exists, under the same row lock as the email bonus. | A grant "if none exists" without a marker would also pay accounts created before the welcome grant existed. The column also tells the dashboard how many sign-ups are mobile. Account deletion's migration becomes `0049`. |
| P15 | `API_TOKEN_SECRET` is read on first use, not at import. In development a fixed fallback is used; in production a missing or short (< 32 characters) secret makes token endpoints and bearer requests fail with the sanitised 500 and a clear log line, and leaves the cookie path working. | The build and fresh worktrees need no new placeholder; a missing secret cannot take the web down. |
| P16 | No new rate limiter. Login, register, forgot, send and verify reuse the existing ones through the services, with today's keys and fail-closed policy; a limiter that cannot be checked in production answers 503. Refresh has none. | A refresh token is 256 random bits and costs one indexed lookup. A flood is the Firewall's job. |
| P17 | Not moved, because nothing imports them and they are deleted in the preparation PR: `lib/db/query/user/{clear-email-verification-code,clear-password-reset-token,is-email-verified}.ts`. `lib/email/add-contact-to-segment.ts` also has no importer but is moved, not deleted. | Dead queries are one-line updates, cheap to write again. The Resend segment helper looks like unfinished marketing work; whether to drop it is the owner's call. |

## Order of work

One Linear issue in team `GIPITI` (GIPITI-263); every commit and PR title carries its id. Each PR is from `origin/main` with base `main`, opened after the previous one merged. `pnpm check` before each. The `review` agent reads PRs 3 to 7 before the merge is asked for.

### PR 1. Preparation [B: behaviour-neutral]

- `UserType` is imported from `@/types/next-auth` in `lib/ai/entitlements.ts` and `contexts/model-context.tsx`; the re-export in `app/(auth)/auth.ts` goes. The one entry in `tests/architecture/allowlist.ts` is removed; the list is then empty.
- `getRegistrationGeoFromHeaders(readRequestHeaders)` takes the function that yields the headers; `register` in `app/(auth)/actions.ts` passes `headers` from `next/headers`. Not the headers themselves: the function stays asynchronous, as the characterization test mocks it, and a failure to read the headers still ends in its fallback to nulls (GIPITI-87). It gets a unit test.
- `DUMMY_PASSWORD` moves from `lib/constants.ts` to a new `lib/auth/dummy-password.ts`.
- The three dead user queries are deleted (P17).

Verify: `pnpm check`; `pnpm check:characterization-diff origin/main` passes without the label.

### PR 2. Phase 4a: the auth module to `server/` [R]

`git mv`, then `scripts/codemods/rewrite-imports.ts`, then `pnpm format`. No logic edits.

| From | To |
|---|---|
| `app/(auth)/auth.ts`, `auth.config.ts` | `server/modules/auth/next-auth.ts`, `next-auth.config.ts` |
| `app/(auth)/__tests__/{auth-jwt-callback,authorize-rate-limit}.test.ts` | `server/modules/auth/__tests__/` (the two tests of `actions.ts` stay) |
| `lib/auth/{normalize-email,reset-token,secret,sign-in-error-codes,dummy-password,disposable-email-domains}.ts`, the `.json`, their tests | `server/modules/auth/` |
| `lib/geo/registration-geo.ts`, `lib/utm/parse-utm-cookie.ts` | `server/modules/auth/` |
| `lib/db/query/user/**` (9 files, `__tests__`, `__integration__`) | `server/modules/users/queries/` |
| `lib/email/{send-verification-email,send-password-reset,send-password-changed,forward-email}.ts`, `templates/` | `server/modules/email/` |
| `lib/email/{client,add-contact-to-segment}.ts` | `server/integrations/resend/` |
| `lib/constants.ts` | `server/env.ts` |

By hand in the same commit: `app/(auth)/api/auth/[...nextauth]/route.ts` (re-export from the new path), the relative imports of `proxy.ts`, `LEGACY_SERVER_CODE` in `tests/architecture/rules.ts` and the path strings in `boundaries.test.ts`, `tests/characterization/targets/{auth-config,auth-actions}.ts`, `CLAUDE.md` (the paths it names: the disposable-domain list, `take-verification-attempt.ts`, the layout notes), `.claude/agents/review.md` if it names them.

Verify: `pnpm check`; `pnpm test:integration` (two user-query suites moved); the characterization guard without its label; the codemod's dry-run count recorded. Preview: sign in, sign out, a wrong password answers "invalid credentials", `/api/v1/me` answers 200 signed in, `/api/health` is green.

### PR 3. Phase 4b: auth services [B, web behaviour unchanged]

New files in `server/modules/auth/`, each with explicit inputs (email, password, IP, UTM, geo, language) and a result union (P8):

| Service | Extracted from | Used by |
|---|---|---|
| `authenticateCredentials` | `authorize` in `next-auth.ts`: the three login limits, the 2-second delay, the lookup, the dummy compare | `authorize` now; `POST /auth/login` in PR 5 |
| `registerUser` | `register`: signup flag, limit, disposable domains, existing user, `createUser` | the action; `POST /auth/register` |
| `sendVerificationCode`, `verifyEmailCode` | `resendVerificationCode`, `verifyEmail` | the actions; `/auth/email-verification/*` |
| `requestPasswordReset`, `resetPassword` | the actions of the same names | the actions; `/auth/password/*` |
| `password-policy.ts` | the regex block written twice in `actions.ts`; built on `passwordRequirements` of `lib/validation/password.ts` | services |

The actions keep form parsing, `cookies()`, `headers()`, `signIn` and the mapping from a result to their state types. The services call the same leaf modules (queries, email senders, limiters) with the same arguments in the same order.

Tests: one unit test file per service (each status of its union). `tests/characterization/auth-actions.test.ts` and `auth-authorize.test.ts` must pass with no diff beyond specifiers: they are the proof that the web did not change.

Verify: `pnpm check`; the characterization guard without its label. Preview: register a throwaway address (asks the owner first), request and enter a verification code, request a password reset.

### PR 4. Phase 4c: token version and session tables [B]

- Migration `0047_auth_sessions.sql`, journal entry, snapshot, `server/db/schema.ts`: `User.token_version integer NOT NULL DEFAULT 0`; `AuthSession`; `RefreshToken` with `parent_id` (DDL as in the roadmap's "DB changes" table).
- `server/modules/auth/token-version.ts`: `getTokenVersion`, `rememberTokenVersion`, `isSessionVersionCurrent` (P5), with a query file in `server/modules/users/queries/`.
- `next-auth.ts`: the `jwt` callback reads the account's version on sign-in from the database (`getTokenVersionForNewSession`, never the cache, which may be behind) and stores it as `ver`, and returns `null` when `token.ver ?? 0` differs from the current version (P6). `authorize` is not touched: what it returns is pinned by the characterization test.
- `proxy.ts`: the check and the cookie deletion (P4), tested through `proxy()` itself (`__tests__/proxy.test.ts`); the cookie names come from `server/http/session-cookie.ts`. On a page where the session decides nothing the cookie is no longer read at all.
- `updateUserPassword` becomes the transaction of P7; the `resetPassword` service refreshes the Redis value afterwards.
- `types/next-auth.d.ts`: `ver` on `JWT`.

Tests: unit for `token-version.ts` (Redis hit, Redis miss, Redis error, no Redis), the `jwt` callback (no claim, equal, stale), the proxy function (stale cookie on each of the three branches: no redirect to `/chat`, cookie deleted). Integration: the password transaction changes the password, bumps the version and revokes the user's sessions together, and leaves another user's rows alone.

Verify: `pnpm check`; `pnpm test:integration`. Local dev server (a local production build cannot show protected pages: over plain http the proxy does not see the secure cookie): with a signed-in session, raise the account's version the way a reset does; a legacy route and `/api/v1/me` answer 401, `/chat` lands on `/login` after one redirect, `/login` shows the form, and a new sign-in works. Preview: the build log shows `0047` applied; sign-in works; an existing cookie from before the deploy still works. After the merge: p95 of `GET /api/history` for the day before and the day after, read with the Vercel MCP tools; the roadmap's budget is +20 ms.

### PR 5. Phase 4d-1: tokens, sessions and the bearer principal [B, M]

Module (`server/modules/auth/`):

- `access-token.ts`: sign and verify with `jose` (already pinned at 6.2.17): HS256, header `kid`, claims `sub`, `sid`, `ver`, `iss`, `aud`, 15 minutes; verification also accepts `API_TOKEN_SECRET_PREVIOUS` (P15).
- `sessions.ts` and `queries/`: `issueTokenPair` (creates the `AuthSession` and the first `RefreshToken`; 60-day sliding, 180-day absolute), `rotateRefreshToken` (one transaction, row lock on the session; P11), `revokeSession`, `revokeAllSessions` (with the version bump), `listSessions`, `resolveBearerSession` (verify, then one query for the session and the user's version; `last_used_at` written at most every 5 minutes).
- The refresh token is 32 random bytes in base64url, stored through the existing `hashToken`.
- From the review of this PR: a session (web cookie or API) is stamped with the token version read together with the credentials (`Account.tokenVersion`), and `createAuthSession` locks the account's row and refuses when the version has moved on, so a sign-in in flight during a password reset cannot outlive it; an account keeps at most 20 live sessions; a used refresh token that comes back is treated as a copy even after its expiry, and used tokens are kept as long as their session; the token secret is checked before a session or a rotation is written.

Kit:

- `guards/principal.ts`: a `Bearer` header is verified and never falls back to the cookie; an invalid one is 401; any other `Authorization` scheme is 401. Otherwise the cookie (P10).
- `guards/csrf.ts` and its use in `middleware.ts` (P9); a refusal is `FORBIDDEN` with `data.reason: "cross_site_request"`. The principal middlewares put a reason on every 401 too (`not_authenticated`, `invalid_token`, `unsupported_authorization`).
- `_kit/openapi.ts`: the `bearerAuth` security scheme. `common-errors.ts`: `FORBIDDEN`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE`. The `UNAUTHORIZED` with an open-enum `data.reason` is declared by the auth contract itself (`v1/_schemas/auth.ts`), so `/me` and `/plans` keep the plain one.
- `authenticateCredentials` tells `limiter_unavailable` apart from `rate_limited` (503 and 429 on the wire; the web form shows one message for both, as before). `/me`'s loader moves to `v1/me/load-me.ts`, shared with login.

Endpoints (`server/api/v1/auth/{contract,router}.ts`, `auth/sessions/`, `_schemas/auth.ts`, a mapper):

| Method + path | Auth | 2xx | Errors (`code` / `data.reason`) |
|---|---|---|---|
| `POST /auth/login` | none | 200 `{ user: Me, tokens }` | `UNAUTHORIZED/invalid_credentials`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE` |
| `POST /auth/refresh` | refresh token in the body | 200 `{ tokens }` | `UNAUTHORIZED/{refresh_invalid,refresh_expired,session_revoked,refresh_reused}` |
| `POST /auth/logout` | bearer | 204 | idempotent; `UNAUTHORIZED/bearer_required` for a browser session |
| `POST /auth/logout-all` | bearer or cookie | 204 | a cookie caller is signed out too |
| `GET /auth/sessions` | bearer or cookie | 200 `{ items }` with `isCurrent` | mobile sessions only |
| `DELETE /auth/sessions/{sessionId}` | bearer or cookie | 204 | `NOT_FOUND` (also for another user's session) |

`/me` and `/plans` now accept a bearer token; the tests that pinned "401 for any `Authorization` header" change with them.

Also: `.env.example` gains `API_TOKEN_SECRET` and `API_TOKEN_SECRET_PREVIOUS`; `CLAUDE.md`; `pnpm api:spec`; the `cleanup-payment-intents` cron also deletes refresh tokens expired more than 7 days ago and sessions 7 days past their absolute expiry (owner decision Q11), with its integration test extended.

Tests: unit for the access token (expiry, wrong `aud`, wrong secret, previous secret, tampered `kid`), the principal (bearer wins over a cookie; a bad bearer does not fall back), CSRF (cookie mutation with and without the proof; bearer exempt; GET exempt). HTTP tests per endpoint and per declared error in `server/api/v1/__tests__/`. Integration (`server/modules/auth/__integration__/`): rotation; five parallel refreshes leave the session alive with at most three pairs minted; reuse after the window revokes the session; `logout-all` kills a bearer token and a cookie version at once.

**Owner, before this PR's preview check:** set `API_TOKEN_SECRET` (`openssl rand -base64 48`) for Preview and Production in Vercel.

Verify: `pnpm check`; `pnpm test:integration`. Local production build against the local database: login, `/me` with the token, refresh twice in parallel, reuse after 30 seconds (401, session gone), `logout`. Preview, from the browser pane with `fetch`: the same flow with a throwaway account (asks the owner first), and a cross-site-style `POST /auth/logout-all` with the cookie but no same-origin proof answers 403.

### PR 6. Phase 4d-2: account endpoints [B, M]

| Method + path | Auth | 2xx | Errors (`code` / `data.reason`) |
|---|---|---|---|
| `POST /auth/register` | none | 201 `{ user, tokens }` (P13) | `FORBIDDEN/signup_disabled`, `CONFLICT/email_taken`, `BAD_REQUEST/{weak_password,disposable_email}`, `TOO_MANY_REQUESTS`, `SERVICE_UNAVAILABLE` |
| `POST /auth/email-verification/send` | bearer or cookie | 202 `{ cooldownSeconds }` | `CONFLICT/already_verified`, `TOO_MANY_REQUESTS` |
| `POST /auth/email-verification/verify` | bearer or cookie | 200 `{ emailVerified, bonusGranted }` | `BAD_REQUEST/{invalid_code (data.attemptsLeft),expired_code}`, `TOO_MANY_REQUESTS/too_many_attempts`, `CONFLICT/already_verified` |
| `POST /auth/password/forgot` | none | 202 always | `TOO_MANY_REQUESTS` |
| `POST /auth/password/reset` | none | 204 | `BAD_REQUEST/{invalid_token,weak_password}` |
| `POST /auth/password/change` | bearer or cookie | 200 `{ tokens }` (P12) | `UNAUTHORIZED/invalid_credentials`, `BAD_REQUEST/weak_password` |

The email for send and verify comes from the principal's user row, never from the body. Register takes UTM from the body and geo from the request headers. A new service `changePassword` reuses the transaction of P7.

As built, where it differs from the table above:

- `POST /auth/password/change` takes no `revokeOtherSessions` flag: a changed password always ends every other session (P7), and the caller gets a new one of the kind it came with. The current password is checked through `authenticateCredentials`, so guessing it here is held back by the login limits.
- `POST /auth/password/change` answers `{ tokens, sessionRenewed }`. Once the password is changed nothing fails the request any more: if the caller's new session cannot be opened (the new cookie through Auth.js, or the new pair), the answer is still 200 with `sessionRenewed: false`, and the user signs in again with the new password (found by the review; before, that was a 500 or a silent sign-out).
- `POST /auth/email-verification/verify` answers 503, not 429, when its limit cannot be checked (`verifyEmailCode` gained `limiter_unavailable`).
- A session issued while the cached token version is behind the database (a bump whose cache write was lost) would be refused until the cache expired; the `jwt` callback now drops such a stale entry when it issues a session (`forgetTokenVersionOlderThan`).
- `POST /auth/password/forgot` answers 202 also when the mail could not be sent: another answer would say that the address has an account. The service logs the failure.
- `POST /auth/email-verification/send` answers 503 when the mail provider refuses or the limit cannot be checked, and 429 with `data.retryAfterSeconds`.
- `POST /auth/email-verification/verify` also answers `welcomeGrantCredited`.
- `POST /auth/register` checks that sessions can be issued (the token secret) before it creates the account: an account whose first sign-in then failed would have its email taken with nobody signed in.
- The error maps with a `data.reason` live in `v1/_schemas/auth-errors.ts` (the contract zone).
- `playwright.yml` needs no `API_TOKEN_SECRET`: the Playwright server is `next dev`, where the development value is used. The test seeds the `RUB` currency row, which no migration creates.

Tests: HTTP tests per endpoint and error. Playwright API project, new `tests/routes/auth-flow.test.ts`: register, verify (the test writes a known code hash to the database instead of sending mail), login, `/me`, refresh, reuse rejected, logout. `playwright.yml` gets a CI-only `API_TOKEN_SECRET`.

Verify: `pnpm check`; `pnpm test:integration`; `pnpm exec playwright test tests/routes/auth-flow.test.ts`; `pnpm api:spec` leaves no diff. Preview: register a throwaway account, receive the code by mail, verify, change the password (asks the owner first).

### PR 7. Phase 4e: the welcome grant after verification for v1 registrations [B, money]

**Done before PR 6**, not after it: with this order the register endpoint defers the grant from its first deploy, and there is no hour in which a sign-up through the JSON endpoint is paid at once. Everything here is dormant until PR 6 passes a platform.

- Migration `0048_user_signup_platform.sql`, journal, snapshot, schema (P14).
- `createUser` keeps its signature (the characterization test pins its arguments). A second export, `createUserWithDeferredWelcomeGrant({ …, signupPlatform })`, creates the same account and balance row without the grant; `registerUser` picks it when it is given a `signupPlatform`. The web action passes none and is unchanged.
- `grantDeferredWelcomeBonus(userId)` in `lib/billing/balance.ts`, modelled on `grantEmailVerificationBonus`: under the balance row lock it credits only an account that has a platform, a verified email and no `welcome` transaction. For an API sign-up (`takeVerificationAttempt` now returns the account's platform) `verifyEmailCode` marks the email verified and credits the grant **in one transaction** (`markVerifiedAndGrantDeferredWelcome`): if the grant fails, the email is not verified either and the code can be entered again. Best effort would have lost the grant for good, since a verified account has no code to enter (found by the review). A website verification is unchanged; the result gains `isWelcomeGrantCredited`.
- `GET /config` already reports the bonus amounts; the register and verify descriptions in the spec say when the welcome grant arrives.

Tests: integration: a v1 registration has a zero balance and no `welcome` transaction; verification credits welcome and email bonus once each, also under two concurrent verifications; a web registration is unchanged; an old account with no `welcome` transaction and a null platform gets no welcome grant at verification.

Verify: `pnpm check`; `pnpm test:integration`. Preview: the balance of the throwaway account before and after verification.

### After the PRs

One docs PR: the roadmap's Phase 4 status line and the corrections this plan found (the cookie is cleared only by `/api/auth/session`, hence the proxy check; `password/change` answers 200; migration numbers `0048` and `0049`; Q5 as decided; what stayed in `lib/` and why; the `flags.ts` item of 4d was already settled by spike S7). This plan gets `status: done` and implementation notes. The Linear issue is closed. The memory note on the roadmap is updated.

## Risks

| Risk | Mitigation |
|---|---|
| The version check signs users out by mistake (wrong Redis value, a failed read) | A missing claim is 0; a Redis error falls back to the database; when the database cannot be read either, the session is kept (P5). Unit tests for each path. Rollback: revert PR 4; cookies minted meanwhile carry an extra claim the old code ignores. |
| Redirect loop for a revoked cookie | P4, with a proxy test and a two-browser check on a local production build before the merge. |
| An extra Redis read on every authenticated web request | One `GET`; measured after PR 4 against the +20 ms budget. If over, the value is cached in the function instance for a few seconds, at the price of that much revocation delay (owner decision at that point). |
| The move breaks an import the codemod does not see | `tsc`, the `mock-specifier` rule and `next build` fail on a dead path; `proxy.ts` and path strings are in the hand list of PR 2. |
| The service extraction changes web behaviour | The two characterization suites pass with a specifier-only diff, checked in CI without the bypass label. |
| A hand-written migration is wrong | It runs on the preview's own Neon branch before the merge; `pnpm test:integration` applies it locally. A migration file is never edited after its preview build; a fix is a new migration. |
| Refresh rotation races | Row lock on the session, P11, and the parallel-refresh integration test on real Postgres. |
| `API_TOKEN_SECRET` is missing in production | P15: token endpoints fail closed, the web is unaffected; the owner sets it before PR 5 is checked. |
| Scripted sign-ups farm the grant through the JSON endpoint | P13 and P14: no money before a verified mailbox; the existing per-IP limit and the disposable-domain list apply through `registerUser`. |
| The mobile client cannot reach `/api/v1` | Still open from Phase 3: the Vercel Firewall answers some non-browser requests with a challenge. Owner, before the first mobile request. Does not block these PRs. |

## Verification (whole phase)

- Every PR: `pnpm check` green locally and in CI; `pnpm test:integration` for PRs 2 and 4 to 7.
- `pnpm vitest run server/api server/modules tests/architecture tests/characterization`.
- `pnpm api:spec` leaves the snapshot unchanged after PRs 5 and 6.
- `pnpm exec playwright test tests/e2e/login.test.ts tests/routes/auth-flow.test.ts`.
- The preview checks listed per PR, from the browser pane. Any step that creates an account or types a password on a preview is confirmed with the owner at that moment.
- After each merge: the production deployment is READY, the runtime log has no errors in the following hour, `/api/health` answers 200, and signing in on `gipiti.ru` works (the owner's own browser session is enough: it must survive every deploy of this phase).
- Rollback: revert the single PR. Migrations `0047` and `0048` are additive and stay.

## Implementation notes (2026-11-22)

Done: PR #301 (preparation and this plan), #302 (4a: the auth module, user queries and email in `server/`), #303 (4b: auth services), #304 (4c: token version, migration `0047`), #305 (4d-1: tokens, sessions, the bearer principal, six endpoints), #306 (4e: the deferred welcome grant, migration `0048`), #307 (4d-2: six account endpoints, the Playwright API flow). GIPITI-263. The owner approved the plan and the merge of #301, then asked for the remaining PRs to be prepared and merged when green while he was away; each was merged after CI, the `review` agent's findings and its own checks.

Where the work departed from this plan (each is also noted in place above):

- **Order: 4e before 4d-2.** With the deferred grant merged first, the register endpoint defers from its first deploy, and there was no hour in which the JSON endpoint paid at once.
- **PR 1, geo.** `getRegistrationGeoFromHeaders` takes the function that yields the headers, not the headers: it stays asynchronous as the characterization test mocks it, and its fallback on a failed read stays.
- **PR 3, one intended change of behaviour.** A UTM cookie with a literal `%` in a value made sign-up answer "failed" (a second `decodeURIComponent` threw). It is read as it is now. Found by the review; everything else in that PR is pinned by the unchanged characterization suites.
- **PR 4, the version of a new session.** First read from the cache, then (review) from the database, then (review of PR 5) taken from what `authorize` read together with the password hash. The last one is what closes the race below.
- **PR 4, a failed version lookup keeps the session** (P5), instead of "treated as signed out": ending it deletes the cookie on `/api/auth/session`, so a database blip would sign out every open tab.
- **PR 5, a sign-in in flight during a password reset** could outlive the reset. Found by the review. A session, web or API, is stamped with the token version read with the credentials; `createAuthSession` locks the account's row (`FOR NO KEY UPDATE`) and refuses when the version has moved on.
- **PR 5, additions from the review**: at most 20 live API sessions per account; a used refresh token that comes back after its expiry revokes the session, and used tokens are kept as long as their session; the token secret is checked before anything is written; the cron reports the intent cleanup even when the session cleanup fails.
- **PR 7, verification and the deferred grant are one transaction.** Best effort, as planned, would have lost the grant for good on one failure, since a verified account has no code to enter. Found by the review.
- **PR 6**: `password/change` has no `revokeOtherSessions` flag and answers `{ tokens, sessionRenewed }`, never failing once the password is changed (review); `verify` answers 503 when its limit cannot be checked; `forgot` answers 202 also when the mail could not be sent.
- **Not written**: a rate limiter for refresh (P16, as planned); `guards/rate-limit.ts`, `client-version.ts`, `raw-route.ts`, `server-caller.ts` (the phases that first need them).

Checks that could not be run as planned, and what stood in for them:

- **Preview steps that create an account or type a real password** (register, the verification mail, the reset mail, the bearer flow on a preview) were not run: the owner was away, and they need his go-ahead. In their place: the Playwright API flow (`tests/routes/auth-flow.test.ts`, also green in CI), the same flow and the password change driven against a local dev server and the local database, and on each preview what needs no account (health, the made-up sign-in through `authorize`, the 401, 403 and 500 answers).
- **The preview of #307 was not opened in the browser**: the browser pane refused the new preview host, which needs the owner's approval there. Its build and CI, with the Playwright API flow, are green.
- **`API_TOKEN_SECRET` is not set in Vercel.** On Production and on previews, `POST /auth/login` with a correct password, `POST /auth/register`, `POST /auth/refresh` and any request with a `Bearer` header answer a sanitised 500 until it is. The website and the cookie path are unaffected, and no client calls these endpoints yet. Checked on the preview of #305.
- **p95 of `GET /api/history` a day before and a day after #304** needs a day to pass. Right after the deploy, five calls from the owner's signed-in browser took 99 to 237 ms after one cold call.

Verified in production after the merges: each deployment succeeded; `/api/health` reports the database and Redis up; the build applied migrations `0047` and `0048`; the owner's session, a cookie issued before the phase, kept working through every deploy (`/api/auth/session`, `/api/v1/me`, `/api/history`, `/chat`); `GET /api/v1/auth/sessions` answers 200 for that cookie; the runtime error log of the three hours of merges holds two entries, both the expected `API_TOKEN_SECRET is not set` from the check of #305's preview.

Left open:

- **`API_TOKEN_SECRET`** (owner): set it in Vercel, a different value for Production and for Preview (preview databases are branches of production, so with one shared value a production access token would be accepted by a preview). Then run the bearer flow once on a preview. Done by the owner on 2026-11-28 (separate values for Production and Preview); a deployment built before that still answers 500 until the next one.
- **The Vercel Firewall and `/api/v1/*`** (owner, from Phase 3): `curl https://gipiti.ru/api/v1/config` was answered with the 429 challenge page on 2026-11-22, so a client that is not a browser cannot reach the API yet.
- **The p95 comparison** for #304, after a day of traffic.
- **The email-confirmation bonus** is still credited best effort after verification, with no retry (older than this phase; the welcome grant of an API sign-up no longer has that weakness).
- **Pre-existing limits noted by the reviews**, shared with the website: one verification mail a minute with no daily cap; anyone can spend an address's five reset requests an hour; bcrypt reads the first 72 bytes of a password.
- ~~**`lib/email/add-contact-to-segment.ts`** moved to `server/integrations/resend/` although nothing imports it (P17): keep or delete is the owner's call.~~ Deleted on 2026-11-28 by the owner's decision, with its `RESEND_MARKETING_SEGMENT_ID` line in `.env.example`.
