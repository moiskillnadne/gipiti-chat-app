# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GIPITI — a Next.js 16 (App Router, Turbopack) AI chat app for the Russian market. Multi-provider LLMs (OpenAI, Google, Anthropic, xAI, DeepSeek, Perplexity, ByteDance, Kling, …) all reached through the Vercel AI Gateway, plus image/video generation, document-generation tools, web search, projects, and a public SEO marketing site. Billing is **pure pay-per-use**: users hold a money balance (RUB by default) that is charged per request. Stack: TypeScript, PostgreSQL + Drizzle ORM, NextAuth v5 beta, AI SDK v6, CloudPayments, Tavily, Resend.

## Development Commands

Standard scripts (dev, build, db:*, lint, format) are in `package.json`.

**After making changes, run `pnpm check` and fix everything it reports before calling the work done.** It runs typecheck, lint + formatting (Biome), and unit tests in parallel, then `next build` (skipped while the static checks fail). Passing steps print one line each and failing steps print their full output. It works in fresh worktrees without `.env` files: placeholder values cover the env vars the build needs, and it never touches the DB. Use `pnpm check:fast` (no build) for quick iterations, but finish with a full `pnpm check`. Formatting failures are fixed with `pnpm format`.

Non-obvious ones:

```bash
pnpm check                       # full 360° check: typecheck + lint/format + unit tests + build (~45s)
pnpm check:fast                  # same without the build (~12s)
pnpm typecheck                   # tsc --noEmit
pnpm build                       # NOTE: runs DB migrations first (tsx server/db/migrate), then next build
pnpm test:unit                   # Vitest; picks up **/__tests__/**/*.test.ts and tests/characterization/
pnpm test:integration            # Vitest against a real local Postgres (TEST_POSTGRES_URL); **/__integration__/**/*.test.ts
pnpm check:characterization-diff # fails if an existing characterization test changed beyond its import paths
pnpm api:spec                    # regenerate server/api/v1/openapi.snapshot.json from the v1 contract
pnpm vitest run lib/ai/__tests__/model-registry.test.ts   # single unit test file
pnpm test                        # Playwright E2E (starts `pnpm dev` via webServer)
pnpm exec playwright test tests/e2e/login.test.ts         # single E2E file
pnpm models:list                 # list AI Gateway models
pnpm prompts:sync                # sync prompt library from Google Sheet
npx tsx scripts/seed-subscriptions.ts   # seed Subscription catalog from lib/subscription/subscription-tiers.ts
npx tsx scripts/add-tokens.ts <userId> <amountMajor> [description]  # credit a user's top-up balance
```

CI (`.github/workflows/`) runs typecheck, lint, unit tests with coverage, the characterization diff guard, integration tests, the API breaking-change check (`api-breaking`), and Playwright.

### Test layers

- **Unit** (`**/__tests__/`): everything external mocked with `vi.mock`. Always mock by `@/` path, never by a relative one: a relative mock silently stops applying when a file moves.
- **Characterization** (`tests/characterization/`): pin the current behaviour of the money and auth entry points while code moves. They import the code under test only through `tests/characterization/targets/`. An existing test may change only in its import / `vi.mock` paths (`pnpm check:characterization-diff`, enforced in CI). A PR that changes pinned behaviour on purpose says so in its body and carries the `characterization-change` label.
- **Integration** (`**/__integration__/`, `pnpm test:integration`): real Postgres, no module-path mocks; outbound HTTP is stubbed with `vi.spyOn(globalThis, "fetch")`. Not part of `pnpm check`. `TEST_POSTGRES_URL` must be a local database whose name ends in `_test` (the tests truncate tables); it is created and migrated on the first run. Helpers live in `tests/integration/`.

### Moving files

Server code is moving to `server/` in steps (roadmap in `docs/plans/`). A move PR is `git mv` plus a scripted rewrite, with no logic edits:

```bash
pnpm exec tsx scripts/codemods/rewrite-imports.ts moves.json --dry-run   # before the move: what would change
git mv …                                                                 # the move itself
pnpm exec tsx scripts/codemods/rewrite-imports.ts moves.json             # every import, export and vi.mock specifier
pnpm format
```

`moves.json` maps old paths to new ones (files or folders). A folder entry counts as moved only when the old folder is gone: after moving its files one by one, remove the empty folder, or the codemod refuses to run. The codemod covers `*.ts` and `*.tsx` only: paths in `package.json` scripts, configs and docs are changed by hand. Imports in `tests/characterization/` are deliberately not sorted by Biome, so that a move changes nothing there but the specifiers.

Moved so far: the database layer is `server/db/` (connection, schema, migrations, `migrate.ts`); the Redis client is `server/integrations/redis/client.ts`; rate limits, the client IP and `handleRouteError` are in `server/http/`; flags are `server/flags.ts`; the cron guard is `server/cron/`; the env booleans (`isProductionEnvironment`, …) are `server/env.ts`. The auth module is `server/modules/auth/` (NextAuth as `next-auth.ts` and `next-auth.config.ts`, email normalisation, reset tokens, the disposable-domain list, registration geo); the user queries are `server/modules/users/queries/`; the email senders and templates are `server/modules/email/`; the Resend client is `server/integrations/resend/`. The prompt queries, the prompt sync (`prompt-seed`, `prompt-sheet`, `prompt-sync`) and the quiz queries and registry are `server/modules/prompts/` and `server/modules/quiz/`; `lib/prompts/prompt-meta.ts` and `lib/quiz/types.ts` stay in `lib/` because client code imports them. The chat queries, `delete-trailing-messages` and `to-ui-messages` are in `server/modules/chat/` (`lib/chat/input-draft.ts` stays in `lib/` because client code imports it). The project queries are `server/modules/projects/queries/`, and the attachment fetch policy (`attachment-fetch-policy.ts`) is `server/modules/uploads/` (`lib/attachments/attachment-limits.ts` and `attachment-display.ts` stay in `lib/` because client code imports them). The other queries (`activity`, `document`, `subscription`) are still in `lib/db/query/` and move later, each with its domain. Still in `lib/` because client code imports them: `lib/auth/safe-redirect-path.ts`, `lib/utm/constants.ts`, `lib/validation/password.ts`.

Legacy routes and server actions stay alive for browser tabs opened before a deploy. Once the web has switched away from one, it calls `recordLegacyHit(name)` (`server/http/legacy-hit.ts`), which upserts a per-UTC-day counter in the `LegacyHit` table inside `after()` and never throws. Name it `"<METHOD> <path>"` for a route (`"GET /api/prompts"`) and `"action <name>"` for a server action. A legacy route may be deleted when its name has no hits for 14 days.

Code under `server/modules/` may not import `next` (`next/headers`, `next/server`, …), `@orpc/*` or `server/api/` (`tests/architecture`). `next-auth` is allowed.

## Architecture Overview

### Route groups

- `app/(chat)` — the authenticated app (chat, projects, prompt library) and its APIs under `app/(chat)/api/*`
- `app/(auth)` — login/register/reset pages and their server actions, the NextAuth route (the config itself is `server/modules/auth/next-auth.ts`), manage-subscription + payment hook
- `app/(marketing)` — public landing, `/models` catalog + per-model landings (data in `lib/marketing/`), blog (`content/blog/*.md`)
- `app/subscription` — balance/usage dashboard, email verification
- `app/api` — cron, webhooks (CloudPayments, Resend), payment/top-up intents, health, log, agent-markdown
- `proxy.ts` — Next 16's middleware: redirects for `PROTECTED_ROUTE_PATTERNS` (new authenticated pages must be added there; everything else falls through so unknown paths 404), signup gating via the `isSignupEnabled` flag, `Accept: text/markdown` rewrites

### AI integration

- Model registry: `lib/ai/models.ts` — every model's capabilities (attachments, `pdfAttachments`, `toolCalling`, thinking config, image/video gen configs, `isVisibleInUI`) plus helpers (`isImageGenerationModel`, `isVideoGenerationModel`, `supportsToolCalling`, gateway-id maps…). UI visibility list in `lib/ai/entitlements.ts`. `lib/ai/__tests__/model-registry.test.ts` guards registry consistency.
- Providers: `lib/ai/providers.ts`; system prompts: `lib/ai/prompts.ts`; tools: `lib/ai/tools/` (web search, URL extract, calculator, generateImage, generatePdf/Docx/Markdown/Txt/Csv).
- Recipes for adding a model, a tool, or changing the DB schema: `repo-recipes` skill (`.claude/skills/repo-recipes/SKILL.md`).

### Chat request flow (`POST /api/chat`, `app/(chat)/api/chat/route.ts`, 800s max)

The route is a thin orchestrator; logic lives in `app/(chat)/api/chat/_lib/`:
1. `parse-request.ts` validates the body (`schema.ts`)
2. `prepare-chat-turn.ts` builds a `ChatTurnContext` and saves the user message (`Message_v2`)
3. `enforce-balance.ts` — if no spendable balance, persists a localized assistant notice and returns `quota_exceeded:chat`
4. `resolve-mode.ts` picks a handler from `handlers/`: `text-chat.ts` (`streamText` + tools, `stopWhen: stepCountIs(stepLimit)`), `image-generation.ts` (dedicated/multimodal image models, provider adapters in `image/`), `video-generation.ts`
5. Handlers charge cost after inference via `charge.ts` → `lib/billing/balance.ts#chargeUsage`; `usage.ts` computes USD cost (TokenLens catalog + merged tool costs such as in-chat image generation)
6. `persist-assistant-turn.ts` saves the assistant message on stream finish
7. Stream is wrapped with `resumable-stream` when Redis is configured; `GET /api/chat/[id]/stream` resumes, falling back to a 15s DB replay

### Billing (`lib/billing/`)

- `Balance` row per user with two pools — `subscription` and `topup` — in minor units of the user's currency. `chargeUsage` converts provider USD cost × `USAGE_MARKUP` via the cached FX rate (`fx.ts`, refreshed hourly by cron), drains the subscription pool first, floors at zero, writes a `Transaction` row.
- Subscription catalog lives in the DB (`Subscription` + `SubscriptionPrice`); `lib/subscription/subscription-tiers.ts` is **seed-only** — runtime reads via `lib/billing/subscriptions.ts`.
- Free start = welcome grant + email-confirm bonus + onboarding-quiz bonus (constants in `lib/billing/constants.ts`). A website sign-up gets the welcome grant in the transaction that creates the account (`createUser`). A sign-up through the API (`POST /api/v1/auth/register`, `User.signup_platform` set) gets it only when the email is verified, in one transaction with the verification (`markVerifiedAndGrantDeferredWelcome`, `grantDeferredWelcomeBonus`): the JSON endpoint is easy to script and must not pay before a mailbox is proven to be read. The quiz bonus is granted in one transaction with saving the answers (`submitQuiz`, `server/modules/quiz/`), so a failed grant leaves no answers and a retry pays.
- Web search is billed per call (`SEARCH_COST_USD`), not quota-counted.

### Authentication

- NextAuth v5 Credentials (email/password), bcrypt-ts, dummy-password compare to prevent user enumeration; emails normalized (`server/modules/auth/normalize-email.ts`), unique on `lower(email)`. `auth`, `signIn` and `signOut` come from `@/server/modules/auth/next-auth`.
- JWT callbacks add `id`, `type`, `emailVerified`, `hasActiveSubscription`, `isTester` — these are **login-time snapshots**; read the DB for runtime tier decisions.
- Registration → 6-digit email verification code via Resend; signup can be disabled by the `isSignupEnabled` Vercel Flag (`server/flags.ts`).
- A verification code is checked only against the account with the submitted email and dies after 5 checks (`server/modules/users/queries/take-verification-attempt.ts`); a new code resets the counter.
- Rate limits are in `server/http/rate-limit.ts` (Upstash). The auth limiters (password reset, code resend, code check, login, sign-up) refuse the request in production when Upstash cannot be checked; chat and payment status let it through. The login and sign-up limits apply only when `VERCEL_ENV` is `production` or `preview`, because the e2e suite signs in with wrong passwords on purpose. Login limits live in `authorize` (`server/modules/auth/next-auth.ts`).
- **Ending sessions.** `User.token_version` is the one number that ends every session of an account. The web cookie carries it as the `ver` claim (a cookie without it counts as 0) and each API access token as `ver`; the `jwt` callback, `proxy.ts` and `resolveBearerSession` refuse a session whose number is not the account's. A password reset and `POST /auth/logout-all` raise it. The current number is cached in Redis (`server/modules/auth/token-version.ts`: `tv:<userId>`, written through on a bump, 10-minute expiry; a new session always reads the database). `auth()` in a page cannot delete a cookie, so `proxy.ts` deletes a stale one, or the visitor would loop between `/login` and `/chat`.
- **API sessions** (`server/modules/auth/sessions.ts`, tables `AuthSession` and `RefreshToken`): a 15-minute access token (JWS HS256, `server/modules/auth/access-token.ts`, secret `API_TOKEN_SECRET`, never `AUTH_SECRET`) and a refresh token stored as its SHA-256, replaced on every use. A used refresh token presented again within 30 seconds gets a sibling pair (twice at most); later it revokes the session. The session row is read on every bearer request, so a logout takes effect at once. A session, web or API, is stamped with the token version that was read **together with the password hash that was checked** (`Account.tokenVersion`), and `createAuthSession` opens one only under a lock on the account's row and only if the version is still that one: a sign-in in flight during a password reset must not outlive the reset. An account keeps at most 20 live API sessions; the one unused the longest is deleted. The numbers are in `server/modules/auth/session-policy.ts`.
- The rules of sign-in, sign-up, verification and password reset live in services in `server/modules/auth/` (`authenticateCredentials`, `registerUser`, …), which return a result union and never read `headers()` or `cookies()` (`changePassword` and the session functions in `sessions.ts` are API-only so far). The server actions in `app/(auth)/actions.ts` and the `/api/v1/auth` routers are their two callers; change a rule in the service.
- Sign-up refuses throwaway mailboxes (`server/modules/auth/disposable-email-domains.json`, a vendored list; delete a line to allow a domain).

### Client state

Chat layout providers: `SessionProvider → DataStreamProvider → ModelProvider → ProjectProvider → WebSearchProvider → SidebarProvider`. Model/thinking/media settings and project selection persist in cookies (update through server actions in `app/(chat)/actions.ts`). `DataStreamProvider` pipes `useChat()` stream parts so `useAutoResume()` can resume after reload. Data fetching uses SWR.

### Web API client (`client/shared/api/`)

- The web calls v1 through `api` from `client/shared/api/orpc-client.ts` (`OpenAPILink` over the v1 contract, same-origin, no response validation, base URL read at call time so it is safe to import in a client component rendered on the server).
- A failed call is handled through `client/shared/api/errors.ts`: `isApiError`, `getApiErrorCode`, `getApiErrorReason`, and `getApiErrorMessageKey` (a key of the `errors` namespace under `api.*` in `messages/ru.errors.json`, for a toast). Codes are an open set; an unknown one maps to `api.unknown`, a failed `fetch` to `api.network`.
- `client/shared/api/contract.ts` is the only file in `client/` that may import `server/`.

### API v1 (`server/api/`, served at `/api/v1/*`)

The REST API for first-party clients, built with oRPC, contract first. Live so far: `GET /config`, `/models`, `/plans`, `/me`, `/openapi.json`; `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`; `GET /auth/sessions`, `DELETE /auth/sessions/{sessionId}`; `POST /auth/email-verification/{send,verify}`; `POST /auth/password/{forgot,reset,change}`; `GET /prompts`; `GET /me/favorite-prompts` (active prompts only), `PUT`/`DELETE /me/favorite-prompts/{promptId}`; `GET`/`PUT /me/quizzes/{quizKey}`; `GET /chats?limit&cursor` (newest first, a page `{ items, nextCursor }`), `GET`/`DELETE /chats/{chatId}`, `DELETE /chats?confirm=true`, `GET /chats/{chatId}/votes`, `PUT /chats/{chatId}/messages/{messageId}/vote`, `DELETE /chats/{chatId}/messages?fromMessageId=` (that message and every later one). A chat that is missing or another user's is 404 on all of them. The two DELETE routes that take a query declare `inputStructure: "detailed"` (`{ params, query }`): oRPC's default reads a DELETE's non-path input from the body. The web app does not call it yet.

- `server/api/v1/<resource>/contract.ts` declares the route and its shapes (`oc` from `@orpc/contract`, schemas in `v1/_schemas/`, `zod/v4`); `router.ts` implements it with `v1` from `v1/implementer.ts`; `v1/contract.ts` and `v1/router.ts` aggregate. Contract files import only `zod`, `@orpc/contract` and other contract files (enforced by `tests/architecture`).
- Every procedure states who may call it with `spec: callerAccess("required" | "optional" | "none")` in its `.route({...})` (`server/api/_kit/caller-access.ts`): `required` for a router that uses `requireAuth`, `optional` for `withPrincipal`, `none` for neither. The generator writes it as the operation's `security`, so a change in who may call an endpoint changes the snapshot. Two tests guard it: `openapi-snapshot.test.ts` fails for an operation without a `security` array, and `caller-access-http.test.ts` sends two requests to every operation (anonymous, and with a bad bearer token) and fails when the router's behaviour does not match the declared level: `required` answers the first with 401 `not_authenticated`, `required` and `optional` answer the second with 401 `invalid_token`, `none` answers neither; a 400 or 404 fails too. Input is validated before the auth middleware, so an operation that takes a body needs a valid one in that test's table.
- `server/api/_kit/`: `create-handler.ts` (oRPC → the Next catch-all `app/api/v1/[[...rest]]/route.ts`, writes the 404 itself), `middleware.ts` (`handleErrors` on every procedure, `withPrincipal`, `requireAuth`), `guards/principal.ts` (who is calling) and `guards/csrf.ts`, `errors.ts` (the one table from `ChatSDKError` to wire errors), `open-enum.ts`.
- `server/api/_kit/pagination.ts` (contract zone, `zod` only) is cursor pagination: `pageQuerySchema` (`limit` 1..100, default 20, read from one to three decimal digits only (`1e1`, `0x10`, ` 5`, `limit[]=5` are 400) while the spec stays `integer`; optional `cursor`), `pageOutputSchema(item)` (`{ items, nextCursor: string | null }`) and `encodeCursor`/`decodeCursor`. The cursor is opaque (base64url of `(createdAt, id)`, `createdAt` as `to_char(..., 'YYYY-MM-DD HH24:MI:SS.US')` text, microseconds kept and independent of the session's `DateStyle`, never a JS `Date`) and only a position: a service never looks it up as a row and always filters by the caller. `decodeCursor` never throws; the router answers `invalid` with 400 `data.reason: invalid_cursor`. A plain validation 400 is not declared per operation (no existing operation does); declare `BAD_REQUEST` (`badRequestError` or one with a `data.reason`) only where the contract names it. Use it only for lists that can grow without bound (chats, later transactions and card payments); every other list returns `{ items }` whole.
- Every error is `{ defined, code, status, message, data? }` with the matching HTTP status. Money is `{ amountMinor, currencyCode }`. A response field whose values may grow is `openEnum(...)`, never `z.enum`: generated native clients cannot decode an unknown enum value.
- Auth: an access token (`Authorization: Bearer …`) or the session cookie. A request with an `Authorization` header is judged by that header alone: a bad token is 401 (`data.reason: invalid_token`), never a fallback to the cookie. A cookie caller on a method other than GET/HEAD must show the request comes from a page of this site (`Sec-Fetch-Site: same-origin`, or an `Origin` of the same host), otherwise 403; the check is inside `withPrincipal`/`requireAuth`, so a procedure cannot forget it, and bearer callers skip it. A procedure that identifies nobody (`/config`, `/models`, `/openapi.json`, `/auth/login`, `/auth/refresh`) reads no credentials at all, so a client with a stale token can still fetch its config. `server/` may not import `app/`; the cookie session is read through `server/modules/auth/cookie-session.ts`.
- A 401 of the auth endpoints says why in `data.reason` (`invalid_credentials`, `refresh_invalid`, `refresh_expired`, `session_revoked`, `refresh_reused`, `bearer_required`, …). Add a reason to `KNOWN_UNAUTHORIZED_REASONS` in `v1/_schemas/auth.ts`; it is an open enum.
- After changing a contract run `pnpm api:spec`; it rewrites `server/api/v1/openapi.snapshot.json`, and a unit test fails while the file is out of date.
- An endpoint may only grow once a shipped client calls it (the web counts). CI job `api-breaking` runs `oasdiff breaking` on the base branch's snapshot against the PR's and fails on an error or a warning. A PR that changes an endpoint no client calls yet names it in its body and carries the label `api-unreleased-change`: the findings are still printed, but they do not fail the job. The job sees only what the spec says: it cannot see a default applied in a handler or an ordering, so a contract or router change still needs a reviewer's eye.
- Verified facts about the oRPC version in use (error encoding, routing next to raw route files, what the generator emits): `docs/plans/orpc-v1-roadmap/spike-findings.md`. orpc.dev documents 2.0; read the installed type declarations instead.

### Errors

`ChatSDKError` (`lib/errors.ts`) with codes `"{type}:{surface}"` (e.g. `quota_exceeded:chat`, `unauthorized:api`); `.toResponse()` maps to HTTP status. Database errors are logged, not exposed.

### Payments (CloudPayments)

- Webhook `/api/webhooks/cloudpayments/` (HMAC-SHA256 validated): check, pay, fail, recurrent, cancel, refund. Branches on `data.kind` (`subscription` vs `topup`); top-up crediting is idempotent per intent. Refunds (`lib/billing/refund.ts`) debit the pool the original payment credited (floored at zero), idempotent per refund id; a fully refunded subscription is cancelled immediately.
- `PaymentIntent` table, 30-minute expiry. Client widget flow in `app/(auth)/manage-subscription/hooks/use-payment.ts`.
- Docs links + key files: `.cursor/rules/cloudpayments.mdc`, `cloudpayments-documentation.en.md`.

### Agent Discovery

Machine-readable surface for AI agents, all under `lib/agent-discovery/` — see `docs/agent-discovery.md` for the full map and for what is deliberately *not* published.

- `Link` headers (RFC 8288) on every HTML page, configured in `next.config.ts`
- `/.well-known/api-catalog` (RFC 9727) + `/openapi.json` — the public API surface only (`/api/health`); the session-authenticated chat APIs are intentionally undocumented
- `/.well-known/agent-skills/index.json` + `SKILL.md` documents, digests computed from the served bytes
- `/robots.txt` is a route handler (not `app/robots.ts`) so it can carry `Content-Signal` directives
- **Markdown negotiation**: `Accept: text/markdown` on a public page is rewritten by `proxy.ts` to `/api/agent-markdown/*` (rewrites drop query params — encode state in the path). Markdown is generated from the same modules the React pages render, so the two views cannot drift
- **WebMCP**: read-only catalog/pricing tools registered from the marketing layout, feature-detected

### Cron jobs (`app/api/cron/`, scheduled in `vercel.json`)

All require `Authorization: Bearer ${CRON_SECRET}`: `reset-quotas` (every 10 minutes; renew billing periods / reset subscription pool), `cleanup-cancelled` (every 10 minutes), `refresh-fx-rates` (hourly, at :00), `cleanup-payment-intents` (hourly, at :15). The last one marks overdue pending intents `expired` and deletes intents older than 30 days only when they have no `externalTransactionId` and are `failed`, or `expired` with no `failureReason`. It also deletes API sessions a week past their absolute end and refresh tokens a week past their expiry. Succeeded intents are never deleted: the refund webhook finds the payment through them.

## Conventions

### Linting and formatting (ultracite / Biome — `.cursor/rules/ultracite.mdc`)
- `pnpm lint` to check, `pnpm format` to fix
- `type`, not `interface` (`useConsistentTypeDefinitions`); no enums; `import type`
- No `any` (use `biome-ignore` with a reason when unavoidable); no bare `public` on class members
- No `console.log` in client code (client logging goes through `/api/log`)
- React: no index keys, functional components; Next.js: `<Image>` not `<img>`, semantic HTML/ARIA
- Named exports, components < 200 lines, business logic in `lib/` not components

### Plans (`docs/plans/`)
- For any task that touches more than 2 files, start with a plan (plan mode).
- A plan must cover: goal, files that change, order of work, risks, and verification (which tests / commands). Start it with a `# <Title>` heading — the filename slug comes from it.
- Approved plans are saved automatically by a `PostToolUse` hook on `ExitPlanMode` (`.claude/settings.json` → `scripts/hooks/save-plan.ts`) to `docs/plans/YYYY-MM-DD-<slug>.md`; the hook reports the path back. Don't save a second copy.
- If a plan was agreed in chat without plan mode (no hook fired), save it there yourself before any code changes, same format.
- If the implementation departs from the plan, update the plan file in the same commit. When the work is done, set `status: done` in its frontmatter.

### i18n
- No next-intl — a small in-house shim in `lib/i18n/translate.ts` exposes `useTranslations(ns)` / `await getTranslations(ns)` with the same shape.
- Russian only: strings in `messages/ru.json`; the `errors` namespace lives in `messages/ru.errors.json` (loaded separately by root error boundaries).
- Never hardcode UI strings.

## Environment Variables

See `.env.example` (`AUTH_SECRET`, `AI_GATEWAY_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `POSTGRES_URL`, `REDIS_URL`, Resend vars, `NEXT_PUBLIC_APP_URL`, `FLAGS`/`FLAGS_SECRET`, `TAVILY_API_KEY`, `PROMPTS_SHEET_*`, `BLOG_PREVIEW_KEY`). `API_TOKEN_SECRET` (at least 32 characters; optional `API_TOKEN_SECRET_PREVIOUS` while rotating) signs API access tokens: outside production a built-in development value is used when it is unset, in production the token endpoints and bearer requests answer 500 without it while the website keeps working. Also needed but missing from the example: `CLOUDPAYMENTS_PUBLIC_ID`, `CLOUDPAYMENTS_API_SECRET`, `CRON_SECRET`. Redis (`server/integrations/redis/client.ts`) accepts either `REDIS_URL` (+`REDIS_TOKEN`) or Upstash `KV_REST_API_URL` + `KV_REST_API_TOKEN`; without it resumable streams are disabled.

## Common Gotchas

1. **Message schema**: use `Message_v2` / `Vote_v2`, not the deprecated tables. `Vote_v2` PK is (chatId, messageId); `Document` PK is (id, createdAt).
2. **Document table** only stores generated tool output (`kind` = image | video | pdf | docx | markdown | txt | csv). `kind` is a TS-only varchar enum — adding a kind needs no migration.
3. **Migrations**: SQL files in `server/db/migrations/`, applied by `pnpm db:migrate`. `pnpm db:generate` is currently broken (drizzle-kit 0.25 vs drizzle-orm 0.45) — hand-write migrations + journal entries. Drizzle puts Postgres SQLSTATE on `error.cause` (see `server/db/unique-violation.ts`).
4. **Gate before inference, charge after**: balance is checked before calling the model; cost is charged afterwards. A billing failure must never break the stream (`chargeUsageSafe`).
5. **Gateway provider metadata**: Google models report under `providerMetadata.vertex`, not `google`. The gateway silently drops unknown image/video params — verify a new param actually changes output.
6. **Reasoning**: some models need `extractReasoningMiddleware` for `<think>` tags — check `usesReasoningTagMiddleware()` in `models.ts`; native-reasoning models must not be wrapped.
7. **Text attachments**: `.md`/`.txt`/`.csv`/`.tsv`/code uploads are validated by extension (browser MIME is unreliable), normalised to UTF-8 on upload (BOM stripped, Windows-1251 re-encoded), and inlined as text for the model by `lib/ai/text-attachments.ts` (`.docx` via `docx-extract.ts`) — providers only accept images/PDFs as file parts. Some models reject PDFs (`pdfAttachments: false`).
8. **Provider SDKs**: all models go through `@ai-sdk/gateway`; `@ai-sdk/google` is imported only for provider-option types.
9. **SVG imports**: a Turbopack SVGR rule in `next.config.ts` turns **every** `.svg` import into a React component.
10. **Static assets**: files in `public/` are served from `/`, never `/public/...`.
11. **Hidden deps**: `redis` and `@opentelemetry/api-logs` look unused but are required transitively — don't remove.
12. **Page translators**: Chrome/Yandex Translate swap React text nodes for `<font>` wrappers, and React then throws `removeChild`/`insertBefore` errors when it removes them (GIPITI-101). `components/dom-mutation-guard.tsx` (mounted in the root layout) patches `Node.prototype` to absorb these errors. Don't remove it as dead code. When UI text swaps between variants, wrap each variant in its own element instead of mixing bare text with siblings.


## Agent skills

### Issue tracker

Issues live in Linear (team key `GIPITI`, e.g. GIPITI-98), via the Linear MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
