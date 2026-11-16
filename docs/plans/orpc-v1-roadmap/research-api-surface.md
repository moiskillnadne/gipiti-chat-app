# GIPITI server-callable surface: inventory, classification and /v1 mapping

Scope: every `app/**/route.ts` (37 files), every server action (2 `"use server"` modules + 1 inline action), and the server-side data reads done directly in pages and layouts.
Method: read-only review of the repo at branch `chore/gipiti-127-sharp-vitest-lockfile` (HEAD c9981de). Citations are `path:line`. **Observed** means I read it in the code. **Inferred** means it is my conclusion. **UNVERIFIED** means I could not confirm it from code, types or docs I had.

Library versions observed: `next` 16.4.6, `next-auth` 5.0.0-beta.32, `ai` 6.0.73, `zod` 3.25.76 (it ships the `zod/v4` subpath, which `lib/ai/tools/generate-*.ts` already import), `@vercel/blob` 0.24.1. oRPC is not installed in the app. `admin-dashboard` has `@orpc/{client,server,contract,tanstack-query}` 1.15.7 with zod 4.6.7, and no `@orpc/openapi` or `@orpc/zod`.

Classification legend:
- **(a)** mobile-facing: becomes a `/v1` procedure.
- **(b)** web-only: cookie UI preferences, NextAuth browser plumbing and similar.
- **(c)** external shape: webhooks, cron, `.well-known`, health, robots, openapi, agent markdown. URLs stay as they are.
- **(d)** streaming or special: chat turn, stream resume, stop, multipart upload.

---

## 1. Route handlers

Common facts that apply unless a row says otherwise:
- **Auth.** `auth()` from `app/(auth)/auth.ts:17-22` reads the NextAuth JWT **cookie** only. There is no bearer-token path anywhere.
- **Proxy.** `proxy.ts:158` excludes `api/` from the matcher, so every API route enforces its own auth.
- **Ownership.** Ownership checks happen inline, comparing `chat.userId` or `project.userId` with `session.user.id`.

### 1.1 Chat, history, votes

| # | Path + method | Purpose | Input + validation | Output | Auth enforcement | Side effects | Client callers | Tests | Class | Proposed /v1 |
|---|---|---|---|---|---|---|---|---|---|---|
| R1 | `POST /api/chat` (`app/(chat)/api/chat/route.ts:66`) | Run one chat turn (text/image/video) and stream it | JSON body validated by zod `postRequestBodySchema` (`app/(chat)/api/chat/schema.ts:66-84`): `id` uuid, `turnId?` uuid, `message{id,role:"user",parts[]}`, `selectedChatModel` **strict `z.enum(chatModelIds)`** (`schema.ts:37,77`), thinking/image/video settings, `previousGenerationId?`, `selectedProjectId?`, `webSearchEnabled?`. Over-length text gives a custom 400 (`_lib/parse-request.ts:24-41`) | SSE UI-message-stream (`JsonToSseTransformStream`, `route.ts:302`). Extra data parts `data-modelId` and transient `data-turnId` (`route.ts:244-251`). With Redis it is wrapped as a resumable stream (`route.ts:308-313`) | `auth()` gives 401 `unauthorized:chat` (`route.ts:78-81`). Chat ownership is checked inside `prepareChatTurn` (UNVERIFIED: I did not read prepare-chat-turn.ts) | Rate limit 30/min per user (`lib/rate-limit.ts:5-6,188`). Per-mode turn slot (`route.ts:95-99`). Saves the user message. **Balance gate** saves a localized assistant notice and returns 429 `quota_exceeded:chat` (`_lib/enforce-balance.ts:15-41`). Provider call. `chargeUsage` after inference. Saves the assistant message (`route.ts:284`). `recordUserActivity` (`route.ts:84`). Stop watcher in Redis | `components/chat.tsx:103-131` (`DefaultChatTransport` with `api:"/api/chat"` and a custom body in `prepareSendMessagesRequest`) | 13 unit files in `app/(chat)/api/chat/_lib/__tests__/` (balance gate, persist, stop, slots, usage, lifecycle). No test of the route handler itself | d | `POST /v1/chats/{chatId}/turns` (SSE, AI SDK protocol kept). Accept `body.id` equal to the path for compatibility |
| R2 | `DELETE /api/chat?id=` (`route.ts:331`) | Delete one chat | `id` from the query string, presence only, not checked as a uuid (`route.ts:332-337`) | Deleted chat row JSON, 200 | 401 `unauthorized:chat`. Returns 403 `forbidden:chat` when `chat?.userId !== user.id`, **including when the chat does not exist** (`route.ts:347`) | Deletes the chat (cascade UNVERIFIED) | `components/sidebar-history.tsx:136` | none | a | `DELETE /v1/chats/{chatId}`, returning 204 or 404 |
| R3 | `GET /api/chat/[id]/stream` (`app/(chat)/api/chat/[id]/stream/route.ts:16`) | Resume an in-flight stream after reload | Path `id` only | 204 when Redis is absent. Otherwise SSE replay, an empty stream, or a single transient `data-appendMessage` with the last assistant message when it is under 15 s old (`stream/route.ts:129-160`) | 401, 404 `not_found:chat` or `not_found:stream`, 403 `forbidden:chat` | Reads Redis | Implicit. The AI SDK builds `${api}/${chatId}/stream` (`node_modules/ai/dist/index.mjs:12307`). Triggered by `resumeStream` in `hooks/use-auto-resume.ts:31` | none | d | `GET /v1/chats/{chatId}/stream`. Set it through `prepareReconnectToStreamRequest` with `api` (the override is observed at `index.mjs:12307`) |
| R4 | `POST /api/chat/[id]/stop` (`stop/route.ts:14`) | Ask the generating instance to abort a turn | zod `stopBodySchema`: `turnId` or legacy `messageId` (`_lib/stop-body.ts:8-14`) | 204 | 401, 403 when the chat exists and belongs to someone else. **A missing chat is accepted** on purpose (`stop/route.ts:39-44`) | Publishes a Redis stop marker | `hooks/use-chat-stop.ts:66` | `stop-body.test.ts`, `stop-signal.test.ts` | d | `POST /v1/chats/{chatId}/turns/{turnId}/stop` (also accept `messageId` in the body as an alias) |
| R5 | `GET /api/history` (`app/(chat)/api/history/route.ts:8`) | List the user's chats (sidebar) | Query `limit` (`parseInt`, default 10, **no upper bound and NaN not handled**, `history/route.ts:11`), `starting_after` / `ending_before` (mutually exclusive, 400) | `{chats, hasMore}` (`lib/db/query/chat/get-chats-by-user-id.ts:68-72`) | 401 `unauthorized:chat`. Validation runs before auth (`history/route.ts:15-26`) | none | `components/sidebar-history.tsx:94,103` (SWR infinite keys) | none | a | `GET /v1/chats?limit&cursor` (cursor pagination, `limit` at most 100) |
| R6 | `DELETE /api/history` (`history/route.ts:42`) | Delete all of the user's chats | none | Result JSON, 200 | 401 | Bulk delete | `components/app-sidebar.tsx:52` | none | a | `DELETE /v1/chats` (needs an explicit confirm flag, see §6) |
| R7 | `GET /api/vote?chatId=` (`app/(chat)/api/vote/route.ts:7`) | Votes for a chat | `chatId` presence only | `Vote[]` | 401 `unauthorized:vote`, 404, 403 `forbidden:vote` | none | `components/chat.tsx:243` (SWR key), `components/message-actions.tsx:101,150` (mutate) | none | a | `GET /v1/chats/{chatId}/votes` |
| R8 | `PATCH /api/vote` (`vote/route.ts:39`) | Up- or down-vote a message | **No schema**: the body is destructured from untyped JSON and only checked for truthiness (`vote/route.ts:40-52`). `type` is not checked against `up`/`down`, and `messageId` is not checked to belong to `chatId` | Plain text `"Message voted"`, 200 (`vote/route.ts:76`) | 401, 404 `not_found:vote`, 403 | Upserts `Vote_v2` | `components/message-actions.tsx:88,137` | none | a | `PUT /v1/chats/{chatId}/messages/{messageId}/vote` with `{type}`, returning 204 |

### 1.2 Files and projects

| # | Path + method | Purpose | Input + validation | Output | Auth | Side effects | Client callers | Tests | Class | Proposed /v1 |
|---|---|---|---|---|---|---|---|---|---|---|
| R9 | `POST /api/files/upload` (`app/(chat)/api/files/upload/route.ts:77`) | Upload a chat attachment | multipart `file`. Size at most `MAX_ATTACHMENT_BYTES`. MIME allow-list for binaries, extension for text (`upload/route.ts:15-50,96-113`) | `PutBlobResult` plus `isTruncated`. Errors are `{error, code}` with code in `file_too_large`, `unsupported_type`, `upload_failed` (`upload/route.ts:22-39`), except the "No file" and outer catch paths, which return `{error}` with no code (`upload/route.ts:93,134-137`) | `if (!session)`: 401 `{error:"Unauthorized"}`. **It checks `session`, not `session.user.id`** (`upload/route.ts:80`) | Public Vercel Blob `put`. Text is re-encoded to UTF-8 (`upload/route.ts:63-75`). `addRandomSuffix` defaults to true in @vercel/blob 0.24.1 (`node_modules/@vercel/blob/dist/create-folder-Oa5wYhFM.d.ts:19-23`) | `components/multimodal-input.tsx:199`. The component also **imports types from the route file** (`multimodal-input.tsx:21`) | `lib/ai/__tests__/text-attachments.test.ts` covers the helpers only | d | `POST /v1/uploads` (multipart) |
| R10 | `GET /api/projects` (`app/(chat)/api/projects/route.ts:30`) | List projects | none | `Project[]` | 401 `unauthorized:chat` | none | `contexts/project-context.tsx:51` (SWR) | none | a | `GET /v1/projects` |
| R11 | `POST /api/projects` (`projects/route.ts:45`) | Create a project | zod `createSchema` (`projects/route.ts:12-18`) | Created row, 201 | 401 | Insert | `components/styles-projects/editor-v1.tsx:88` (endpoint passed in from `components/project-manager.tsx:74`) | none | a | `POST /v1/projects` |
| R12 | `PATCH /api/projects` (`projects/route.ts:78`) | Update a project. **The id travels in the body** | zod `updateSchema` (`projects/route.ts:20-28`) | Updated row | 401. Ownership is enforced in `updateProject({id,userId})` (inferred) | Update | `editor-v1.tsx:88` (same fetch, method chosen at runtime, UNVERIFIED) | none | a | `PATCH /v1/projects/{projectId}` |
| R13 | `DELETE /api/projects?id=` (`projects/route.ts:113`) | Delete a project | `id` presence only, not a uuid | `{success:true}` | 401 | Delete | `editor-v1.tsx:174` | none | a | `DELETE /v1/projects/{projectId}`, returning 204 |
| R14 | `GET /api/projects/[id]/files` (`app/(chat)/api/projects/[id]/files/route.ts:38`) | List project files | Path `id` | `ProjectFile[]` | 401. 404 when the project is not owned (`files/route.ts:50-53`) | none | none found. The page passes `initialFiles` from SSR (see P5) | none | a | `GET /v1/projects/{projectId}/files` |
| R15 | `POST /api/projects/[id]/files` (`files/route.ts:59`) | Upload a project file | multipart `file`, 25 MB, PDF/DOC/DOCX/TXT/MD/CSV (`files/route.ts:12-36`). Uses zod 3 `error.errors` (`files/route.ts:92`) | Created row, 201. Errors are `{error}` | 401, 404 | Public blob at `projects/{id}/{ts}-{filename}`. DB insert | `editor-v1.tsx:195` | none | d | `POST /v1/projects/{projectId}/files` (multipart) |
| R16 | `DELETE /api/projects/[id]/files/[fileId]` (`[fileId]/route.ts:8`) | Delete a project file | Path params | `{success:true}` | 401, 404 | Best-effort blob `del` that **silently swallows errors** (`[fileId]/route.ts:29-33`), then the DB delete | `editor-v1.tsx:221` | none | a | `DELETE /v1/projects/{projectId}/files/{fileId}`, returning 204 |

### 1.3 Prompts and the quiz

| # | Path + method | Purpose | Input + validation | Output | Auth | Side effects | Client callers | Tests | Class | Proposed /v1 |
|---|---|---|---|---|---|---|---|---|---|---|
| R17 | `GET /api/prompts` (`app/(chat)/api/prompts/route.ts:6`) | Prompt library plus the user's favourites | none | `PromptsResponse {prompts, favoriteIds}` | **Optional.** Anonymous callers get `favoriteIds: []` (`prompts/route.ts:9-14`) | none | `components/prompt-library/prompt-library.tsx:29` (SWR) | `lib/prompts/__tests__/prompt-sync.test.ts` (sync only) | a | `GET /v1/prompts` (public) and `GET /v1/me/favorite-prompts` (ids) |
| R18 | `POST /api/prompts/favorite` (`favorite/route.ts:11`) | Add a favourite | zod `{promptId: uuid}` | `{success:true}`, 201 | 401 `unauthorized:chat` | Insert. Non-zod errors are rethrown, which gives an unstructured 500 (`favorite/route.ts:32`) | `prompt-library.tsx:137` | none | a | `PUT /v1/me/favorite-prompts/{promptId}`, returning 204 (idempotent) |
| R19 | `DELETE /api/prompts/favorite?promptId=` (`favorite/route.ts:36`) | Remove a favourite | `promptId` presence only, not a uuid | `{success:true}` | 401 | Delete | `prompt-library.tsx:142` | none | a | `DELETE /v1/me/favorite-prompts/{promptId}`, returning 204 |
| R20 | `GET /api/quiz/[key]` (`app/(chat)/api/quiz/[key]/route.ts:13`) | Whether the user completed the quiz | Path `key`, **not checked against the registry** | `{completed}` | 401 `unauthorized:chat` | none | none found. The subscription page reads it in SSR (P7) | none for GET | a | `GET /v1/me/quizzes/{quizKey}` |
| R21 | `POST /api/quiz/[key]` (`quiz/[key]/route.ts:28`) | Submit the quiz and earn the bonus | `definition.schema.parse(body.answers)` (`quiz/[key]/route.ts:45-46`) | `{completed:true}` | 401. 403 `forbidden:auth` with a **localized** message when the email is not verified, read from the DB (`quiz/[key]/route.ts:59-67`) | Inserts the quiz response, then `grantQuizBonus` (**billing**). Idempotent on an existing response | `app/subscription/_components/quiz-reward-banner.tsx:25` | `app/(chat)/api/quiz/[key]/__tests__/route.test.ts` (3 cases) | a | `PUT /v1/me/quizzes/{quizKey}` with `{answers}` |

### 1.4 Billing, usage and subscription

| # | Path + method | Purpose | Input + validation | Output | Auth | Side effects | Client callers | Tests | Class | Proposed /v1 |
|---|---|---|---|---|---|---|---|---|---|---|
| R22 | `GET /api/usage` (`app/(chat)/api/usage/route.ts:8`) | Balance, active subscription and spend progress | none | `{balance{currencyCode,subscriptionAmount,topupAmount,total,formatted}, subscription, spend}`, or nulls when there is no balance | plain-text 401 `"Unauthorized"` | none | `components/elements/usage-hint.tsx:74`, `hooks/use-spend-banner.ts:58` (SWR), `components/chat.tsx:167` (mutate) | none | a | `GET /v1/me/balance` (the balance object plus spend). Drop server-side `formatted` from v1 or return it alongside the raw minor units |
| R23 | `GET /api/transactions` (`app/(chat)/api/transactions/route.ts:7`) | Usage ledger plus summary | `limit` capped at 50, default 20. `offset` default 0, **negative values allowed** (`transactions/route.ts:15-16`) | `{transactions,total,hasMore,summary}` | plain-text 401 | none | `components/token-history-table.tsx:64`, `components/token-usage-summary.tsx:37` (uses `limit=0` to fetch only the summary) | none | a | `GET /v1/me/transactions?limit&cursor` and `GET /v1/me/usage-summary` (split them) |
| R24 | `GET /api/subscription` (`app/(chat)/api/subscription/route.ts:32`) | Active subscription plus raw balance | none | `{subscription, balance}` | plain-text 401 | none | **No caller found** | `__tests__/route.test.ts` (export shape only) | a | `GET /v1/me/subscription` |
| R25 | `DELETE /api/subscription` (`subscription/route.ts:61`) | Soft-cancel. Sets `cancelAtPeriodEnd` | Optional JSON `{feedback{reasons[],additionalFeedback?}}`, validated by hand, with invalid codes filtered out (`subscription/route.ts:69-95`) | `{success,message}` or `{error}` with 404, 502 or 500 | plain-text 401 | Calls CloudPayments `cancelSubscription` and `getSubscription`. **If the CloudPayments call throws, the error is logged and the local cancel still proceeds** (`subscription/route.ts:154-156`). Saves feedback. Updates `userSubscription`. Raw drizzle runs in the route (`subscription/route.ts:98-126,193-199`) | `app/subscription/manage/_components/cancel-flow-dialog.tsx:69` (no body). `lib/subscription/use-cancel-subscription.ts:63` is **unreferenced** | `__tests__/route.test.ts` (exports only) | a | `POST /v1/me/subscription/cancel` (an action, not a DELETE: the row survives) |
| R26 | `POST /api/subscription/resume` (`resume/route.ts:9`) | Re-enable auto-renewal | none | `{success, alreadyActive}`, 410 `subscription_expired` or 502 | plain-text 401 | CloudPayments call and a DB update (in `lib/subscription/resume-subscription`) | `app/subscription/manage/_components/resume-dialog.tsx:72` | none | a | `POST /v1/me/subscription/resume` |
| R27 | `POST /api/subscription/cancellation-feedback` (`cancellation-feedback/route.ts:39`) | Post-cancel survey | zod: `reason?` in the code list, `additionalFeedback?` 1-2000 chars, at least one of the two (`cancellation-feedback/route.ts:13-32`) | `{success}` or `{error}` with 400, 404 or 500 | plain-text 401 | Insert | `cancel-flow-dialog.tsx:88` | none | a | `POST /v1/me/subscription/cancellation-feedback` |
| R28 | `POST /api/payment/create-intent` (`app/api/payment/create-intent/route.ts:25`) | Start a subscription purchase | zod `createSubscriptionIntentRequestSchema` (`{planName}`) | `PaymentIntentResponse {sessionId, expiresAt}` | plain-text 401. Tester-only plan check reads the DB (`create-intent/route.ts:56-65`) | Inserts `PaymentIntent` (30 min) with IP and UA metadata | `app/(auth)/manage-subscription/hooks/use-payment.ts:313` | `__tests__/route.test.ts` (6 cases) | a | `POST /v1/payment-intents` with `{kind:"subscription", planCode}` |
| R29 | `POST /api/topup/create-intent` (`app/api/topup/create-intent/route.ts:33`) | Start a top-up | zod `createTopupIntentRequestSchema(min)`. The minimum depends on the tester flag read from the DB. Note `request.json()` runs inside the try block, so malformed JSON returns 500, not 400 (`topup/route.ts:53-55,114`) | `TopupIntentResponse` | plain-text 401. Flag `isTopupEnabled` gives 403. Requires a subscription, else 403 | Insert intent. `ensureBalance` may create a Balance row (`topup/route.ts:76`) | `app/subscription/_components/top-up-dialog.tsx:191` | none | a | `POST /v1/payment-intents` with `{kind:"topup", amountMajor}` |
| R30 | `GET /api/payment/status?sessionId=` (`app/api/payment/status/route.ts:13`) | Poll the intent outcome | `sessionId` presence only | `PaymentStatusResponse` (status, hasActivity, and subscription or topup detail) | plain-text 401. The intent is scoped to the user | **A GET that writes**: marks the intent `expired` (`payment/status/route.ts:79-86`). Rate limit 120/min **keyed by the raw `x-forwarded-for`** (`payment/status/route.ts:31-36`) | `use-payment.ts:107,231`, `top-up-dialog.tsx:122` | none | a | `GET /v1/payment-intents/{sessionId}`. Move the expiry write to the cron or compute expiry on read |
| R31 | `GET /api/me` (`app/api/me/route.ts:8`) | Current user profile plus balance | none | `{id,email,emailVerified,isTester,hasActiveSubscription,balance{currencyCode,total,formatted}}` | plain-text 401, 404 | none | **No caller found** (grep of app, components, hooks, contexts, lib, tests and scripts) | none | a | `GET /v1/me` (keep this as the mobile bootstrap call; it reads the DB, not the JWT snapshot) |

### 1.5 Logging, auth plumbing and external-shape routes

| # | Path + method | Purpose | Input + validation | Output | Auth | Side effects | Client callers | Tests | Class | Proposed /v1 |
|---|---|---|---|---|---|---|---|---|---|---|
| R32 | `POST /api/log` (`app/api/log/route.ts:18`) | Client log sink | zod `{level,message<=2000,context?}` | `{ok}` | **None.** Bypassed in the proxy (`proxy.ts:91`) | `console.*` | `lib/client-logger.ts:3-9` (`sendBeacon`) | `lib/__tests__/client-diagnostics.test.ts` (client side) | b (optionally a later) | Keep it. If mobile wants it later, use `POST /v1/client-logs` with auth and a rate limit |
| R33 | `GET,POST /api/auth/[...nextauth]` (`app/(auth)/api/auth/[...nextauth]/route.ts:2`) | NextAuth browser endpoints (session, csrf, signout, callback/credentials) | NextAuth | NextAuth | cookie and CSRF | Sets and clears the session cookie | Implicit through `next-auth/react`: `SessionProvider` (`app/(chat)/layout.tsx:95`, `app/(auth)/layout.tsx:1`, `app/subscription/layout.tsx:1`), `signOut` (`components/sidebar-user-nav.tsx:46`), `update()` (`app/subscription/verify-email/_components/verify-email-client.tsx:108`), `useSession` in 7 files | E2E `tests/e2e/login.test.ts` (UI only) | b | Keep it for web. Mobile uses `/v1/auth/*` tokens (§4) |
| R34 | `POST /api/webhooks/cloudpayments?type=` (`app/api/webhooks/cloudpayments/route.ts:55`) | CloudPayments check, pay, fail, recurrent, cancel and refund | HMAC-SHA256 on the raw body (`Content-HMAC`), form or JSON body (`cloudpayments/route.ts:24-37,67-87`). Payloads are cast, not validated, except `recurrent` | CloudPayments `{code}` | HMAC. **The compare is a string `===`, not `timingSafeEqual`** (`cloudpayments/route.ts:36`) | Credits pools, activates subscriptions, refunds | CloudPayments | `lib/handlers/__tests__/tester-plan.test.ts`, `lib/billing/__tests__/refund.test.ts` | c | unchanged |
| R35 | `POST /api/webhooks/resend` (`app/api/webhooks/resend/route.ts:99`) | Inbound email forwarding | Svix verification. **Verification is skipped when `RESEND_WEBHOOK_SECRET` is unset** (`resend/route.ts:37-41`) | JSON | Svix | Forwards the email | Resend | none | c | unchanged |
| R36 | `GET /api/cron/{reset-quotas,cleanup-cancelled,cleanup-payment-intents,refresh-fx-rates}` | Scheduled jobs | `Authorization: Bearer ${CRON_SECRET}`. **The compare is against a template string, so an unset secret makes the expected header `"Bearer undefined"`** (for example `app/api/cron/refresh-fx-rates/route.ts:9-11`) | JSON | bearer | Billing period renewals, pool resets, expiries, FX cache | Vercel cron (`vercel.json`). **`cleanup-payment-intents` is not scheduled in `vercel.json`**, which contradicts CLAUDE.md | `app/api/cron/reset-quotas/__tests__/route.test.ts` (4 cases) | c | unchanged |
| R37 | `GET /api/health` (`app/api/health/route.ts:113`) | Liveness plus DB, Redis and env checks | none | `HealthResponse`, 503 when unhealthy. **Exposes env var names and raw DB error messages to anonymous callers** (`health/route.ts:40-44,70-92`) | none | DB `SELECT 1`, Redis ping | external monitors; documented in `/openapi.json` | `lib/agent-discovery/__tests__/agent-discovery.test.ts` (spec only, inferred) | c | Keep it. Optionally alias it as `GET /v1/health` |
| R38 | `GET /openapi.json`, `/.well-known/api-catalog`, `/.well-known/agent-skills/index.json`, `/.well-known/agent-skills/[skill]/SKILL.md`, `/robots.txt`, `/api/agent-markdown/[[...path]]` | Agent-discovery surface | static | static | none | none | agents. `proxy.ts:59` rewrites to agent-markdown | `agent-discovery.test.ts` | c | The `/openapi.json` content must later **merge** the oRPC-generated v1 spec or link to it (see §6) |
| R39 | `GET /.well-known/vercel/flags` (`app/.well-known/vercel/flags/route.ts:5`) | Vercel Flags discovery | flags SDK | flags SDK | flags SDK signature (UNVERIFIED) | none | Vercel Toolbar | none | c | unchanged |

---

## 2. Server actions

| # | Action (file:line) | Purpose | Input + validation | Output | Auth | Side effects | Callers | Tests | Class | Proposed /v1 |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | `login` (`app/(auth)/actions.ts:61`) | Credentials sign-in | `FormData` checked with zod `{email, password min 1}` (`actions.ts:37-40`) | `{status: success\|failed\|invalid_data}` | public | `signIn("credentials",{redirect:false})` sets the **session cookie**. Credential check with a dummy-hash compare (`app/(auth)/auth.ts:43-61`) | `app/(auth)/login/login-page-client.tsx:53` (`useActionState`), `AuthForm action` at `:133` | E2E `tests/e2e/login.test.ts` | a | `POST /v1/auth/sessions` returning `{accessToken, refreshToken, expiresAt, user}` |
| A2 | `register` (`actions.ts:102`) | Sign-up | zod email plus strong password with English messages (`actions.ts:43-55`). Optional `language` field (`actions.ts:133`) | `{status: success\|failed\|user_exists\|invalid_data}`. **Signup disabled also returns `failed`** (`actions.ts:108-110`) | public. Flag `isSignupEnabled` | `createUser` (welcome grant UNVERIFIED, inside createUser or the billing code). Reads and **deletes the UTM cookie** (`actions.ts:124-145`). Reads Vercel geo headers through `headers()` (`lib/geo/registration-geo.ts:47`). Sends the verification email (inferred from CLAUDE.md, not read). Auto sign-in sets the cookie | `app/(auth)/register/register-page-client.tsx:51,104` | none | a | `POST /v1/auth/registrations` (UTM and language as optional body fields, since mobile has no UTM cookie). Map "signup disabled" to a distinct error code |
| A3 | `verifyEmail` (`actions.ts:191`) | Confirm the 6-digit code | zod `{email, code len 6}` | `{status: success\|invalid_code\|expired_code\|already_verified\|failed\|invalid_data}`. `expired_code` is declared but never returned (inferred) | **Public. No session is required**; the code is looked up by hash (`actions.ts:202-221`) | `markEmailAsVerified`, `grantEmailVerificationBonus` (**billing**, best effort). The client then calls `useSession().update()` to refresh the JWT (`verify-email-client.tsx:108`) | `app/subscription/verify-email/_components/verify-email-client.tsx:64` | none | a | `POST /v1/auth/email-verification` (require auth on v1 and take the email from the token) |
| A4 | `resendVerificationCode` (`actions.ts:261`) | Resend the code | zod `{email}`. Rate limit 1 per 60 s per email (`lib/rate-limit.ts:29-34`) | `{status, cooldownSeconds?}`. Anti-enumeration: always `success` (`actions.ts:284-287`) | public | Resend email | `verify-email-client.tsx:68`, `app/subscription/_components/reward-banner.tsx:26,67` | none | a | `POST /v1/auth/email-verification/resend`, returning 429 with `Retry-After` |
| A5 | `requestPasswordReset` (`actions.ts:326`) | Email a reset link | zod `{email}`. Rate limit 5/h per email | `{status, resetMinutes?}`. Anti-enumeration | public | Stores the hashed token. Resend email **with a web link** (UNVERIFIED: link format in `lib/email/send-password-reset`) | `app/(auth)/forgot-password/page.tsx:46-49,100` | none | a | `POST /v1/auth/password-resets`. The mobile deep link needs a separate design |
| A6 | `resetPassword` (`actions.ts:412`) | Set a new password with a token | zod `{token, strong password}` | `{status: success\|invalid_token\|failed\|invalid_data}` | public (token) | `updateUserPassword`, "password changed" email. **Existing sessions are not revoked**, since the JWT is stateless (inferred) | `app/(auth)/reset-password/page.tsx:61,127` | none | a | `POST /v1/auth/password-resets/confirm` (and revoke refresh tokens) |
| A7 | `saveChatModelAsCookie`, `saveThinkingSettingAsCookie`, `saveImageQualityAsCookie`, `saveImageAspectAsCookie`, `saveImageStyleAsCookie`, `saveVideoAspectAsCookie`, `saveVideoDurationAsCookie`, `saveVideoResolutionAsCookie`, `saveVideoModeAsCookie`, `saveWebSearchEnabledAsCookie`, `saveProjectAsCookie` (`app/(chat)/actions.ts:19-85`) | Persist UI preferences as cookies `chat-model`, `${PREFIX}-${modelId}`, `web-search-enabled`, `chat-project` | **No validation and no auth.** Arbitrary strings are written to cookies (`actions.ts:19-85`). Values are re-validated when `app/(chat)/layout.tsx:46-92` reads them | void | none | Sets cookies only | `contexts/model-context.tsx:159-299` (about 20 call sites), `contexts/web-search-context.tsx:38,46`, `contexts/project-context.tsx:60,70` | none | b | none. The chat POST already carries every setting in its body (`schema.ts:77-83`); the chat route reads no cookies (grep: `cookies()` appears only in the actions and the layout). Optional later: `PUT /v1/me/preferences` |
| A8 | `deleteTrailingMessages` (`app/(chat)/actions.ts:89`) | Edit-and-resend: delete the message and everything after it | zod uuid on `id` | void, or throws `ChatSDKError` | `auth()` gives `unauthorized:chat`. Ownership is checked in `lib/chat/delete-trailing-messages.ts:26-34` | Deletes `Message_v2` rows at or after the timestamp (`delete-trailing-messages.ts:36`) | `components/message-editor.tsx:87` | `lib/chat/__tests__/delete-trailing-messages.test.ts` | a | `DELETE /v1/chats/{chatId}/messages?fromMessageId={id}` (inclusive). Or fold it into the turn POST as `{truncateFrom}` |
| A9 | inline `signOut` action in `components/sign-out-form.tsx:8-14` | Sign out | none | redirect | cookie | Clears the cookie | **Unreferenced** (grep finds only its definition) | none | b (dead code) | Delete it. Mobile uses `DELETE /v1/auth/sessions/current` |

Note: `lib/ai/generate-chat-title.ts:5` is deliberately **not** a server action (observed comment).

---

## 3. Server-side data reads in pages and layouts (mobile needs endpoints for these)

| # | Page or layout | Data read on the server | Today's endpoint equivalent | Proposed /v1 |
|---|---|---|---|---|
| P1 | `app/(chat)/layout.tsx:36-92` | `auth()`, **all preference cookies**, `recordUserActivity` (a DB write, `layout.tsx:39-41`), model validation against `chatModelIds` and `isVisibleInUI` | none | `GET /v1/models` (catalog plus capabilities and defaults). Activity is recorded server-side from any authenticated v1 call, or from the chat POST as today (`route.ts:84`) |
| P2 | `app/(chat)/chat/[id]/page.tsx:16-40` | `getChatById`, `getMessagesByChatId`, `convertToUIMessages`, `chat.lastContext` | **none**: there is no GET for one chat or its messages | `GET /v1/chats/{chatId}` (including `lastContext`) and `GET /v1/chats/{chatId}/messages?cursor` (UI-message shape) |
| P3 | `app/(chat)/chat/page.tsx:7`, `projects/page.tsx:7`, `prompts/page.tsx:7`, `subscription/usage/page.tsx:12`, `(auth)/manage-subscription/page.tsx:7` | auth guard only | n/a | n/a |
| P4 | `app/(chat)/projects/[id]/page.tsx:26-35` | `getProjectById`, `getProjectFiles` | files: R14. Project: **none** | `GET /v1/projects/{projectId}` |
| P5 | `app/subscription/page.tsx:64-79` and following | `getLatestSubscription`, `getBalance`, `getChatSpendHistory`, `getRecentSpendMinor`, `getQuizResponse`, `priceForCurrency`, `deriveSubscriptionUiState` / `deriveBalanceViewState`, `getMinorUnits`, plus bonus and welcome constants. Banner logic uses the JWT `emailVerified` snapshot | partial (R22, R20) | `GET /v1/me/billing-overview` (computed state machine: `uiState`, `balanceViewState`, period, plan price, next payment, card mask, banner eligibility) and `GET /v1/me/spend-history` |
| P6 | `app/subscription/manage/page.tsx:51-140` | `getLatestSubscription`, `getBalance`, `getCardPayments({limit:10})`, `priceForCurrency` | **none** for card payments | `GET /v1/me/subscription` (R24 enriched) and `GET /v1/me/payments?limit&cursor` |
| P7 | `app/subscription/verify-email/page.tsx:10-32` | `getBalance`, `EMAIL_CONFIRM_BONUS_MAJOR_UNITS` | none | Bonus amounts belong in `GET /v1/config` or `GET /v1/me/billing-overview` |
| P8 | `app/(auth)/login/page.tsx:1`, `register/page.tsx:2` | `isSignupEnabled()` flag | none | `GET /v1/config` (public: `isSignupEnabled`, `isTopupEnabled`, `minSupportedClientVersion`, bonus amounts, top-up minimums) |
| P9 | `app/(auth)/manage-subscription/utils/payment-utils.ts:1-40` (client) | Plan prices come from the **seed file** `lib/subscription/subscription-tiers.ts`, contradicting "seed-only, runtime reads via `lib/billing/subscriptions.ts`" | none | `GET /v1/plans` (DB catalog: code, displayName, period, prices, tester-only filtered per user) |
| P10 | marketing, blog and legal pages | Static modules (`lib/marketing`, `content/blog`) | n/a | out of scope (web and SEO only) |

Model catalog: `lib/ai/models.ts` is imported straight into client components (`components/model-badge.tsx:4`, `components/message.tsx:8`, `components/multimodal-input.tsx:26`). A native app cannot do this, so `GET /v1/models` is required (P1).

---

## 4. Auth: what mobile is missing (observed facts and recommendation)

Observed:
- NextAuth v5 Credentials provider with a JWT session in a cookie (`app/(auth)/auth.ts:17-78`).
- The JWT carries **login-time snapshots** `emailVerified`, `hasActiveSubscription` and `isTester` (`auth.ts:80-131`). They are refreshed only on `trigger === "update"`.
- Every route uses `auth()`, which is cookie-bound. The proxy reads the token with `getToken({req, secureCookie})` (`proxy.ts:111-115`).
- The `jwt` and `session` callbacks call `console.log` with session data **on every session read** (`auth.ts:92-128,141`), which is log noise and possible PII.

Recommendation (design, not verified against NextAuth internals):
- Add a v1 auth module that issues its **own** short-lived access JWT plus a rotating opaque refresh token stored hashed in a new table.
- Reuse the existing password check: extract the body of `authorize` (`auth.ts:43-76`) into `lib/auth/verify-credentials.ts`.
- The oRPC context resolves the user from `Authorization: Bearer` **or** the NextAuth cookie, so web and mobile share the same procedures.
- Runtime tier decisions keep reading the DB, as today (`create-intent/route.ts:55`, `topup/route.ts:46-48`, `quiz/[key]/route.ts:59`).
- UNVERIFIED: whether NextAuth v5 beta.32 can mint or verify bearer tokens for non-browser clients. I did not find or read an API for it, so assume it cannot.
- CSRF: bearer-only requests need no CSRF. Cookie-authenticated v1 mutations from the web need an Origin check, or must stay same-site; the CSRF protection of server actions is lost on migration (inferred).

---

## 5. Inconsistencies in today's API

1. **At least six error body shapes.**
   - ChatSDKError `{code,message,cause}` (`lib/errors.ts:75`).
   - Plain text `"Unauthorized"` (R22-R31, cron).
   - `{error:string}` (R25-R30, R15).
   - `{error,code}` (R9).
   - Plain text `"Message voted"` (R8).
   - CloudPayments `{code:13}` (R34).
   - The shared SWR `fetcher` assumes JSON on error (`lib/utils.ts:21-23`), so a plain-text 401 turns into a JSON parse error on the client.
2. **The error surface is misused.** `unauthorized:chat` is returned by projects, prompts, the quiz and project files, and `unauthorized:vote` by votes. Surfaces encode the caller, not the domain.
3. **Pagination comes in three styles.**
   - History uses cursor pagination with `starting_after` / `ending_before`, `limit` unbounded (`history/route.ts:11`), and returns `{chats,hasMore}`.
   - Transactions use offset pagination capped at 50, return `{…,total,hasMore,summary}`, and rely on a `limit=0` hack to fetch only the summary (`token-usage-summary.tsx:37`).
   - Projects, files, votes and prompts are unpaginated.
4. **Identifiers are placed inconsistently**: in the query string (R2, R7, R13, R19), in the body (R12), or in the path (R3, R4, R14-R16, R20).
5. **Status codes.**
   - A missing chat on DELETE returns 403 (R2).
   - `quota_exceeded` returns 429, the same status as the rate limit (`lib/errors.ts:133-136`), so clients cannot tell "top up" from "slow down" without reading the code.
   - POST favourite returns 201 for an idempotent toggle.
   - Mixed 200 `{success:true}` and 204 on deletes.
   - Resume uses 410 (R26).
6. **Validation gaps**:
   - R8 has no schema and no messageId-belongs-to-chat check.
   - R5 has no limit bound.
   - R13 and R19 do not check uuids.
   - R20 does not check the key.
   - R23 allows a negative offset.
   - R25 validates by hand.
   - R29 returns 500 on malformed JSON.
   - A7 writes cookies with no validation.
7. **Side effects on GET**: R30 writes `expired`.
8. **Swallowed errors**: R16 blob delete. R25 proceeds with the local cancel after a CloudPayments exception.
9. **Rate limits fail open** when Redis is absent or erroring (`lib/rate-limit.ts:158-176,192-205`). The payment-status limit is keyed by the raw `x-forwarded-for`, which is spoofable and shared behind mobile carrier NAT.
10. **i18n**: error messages are English (`lib/errors.ts:79-120`). Only the quiz (`quiz/[key]/route.ts:61-66`) and the balance notice (`enforce-balance.ts:22-29`) localize. Password rules are English zod messages (`actions.ts:47-54`).
11. **Dead or orphaned code**:
    - `/api/me` and `GET /api/subscription` have no callers.
    - `components/usage-limits-widget.tsx:74` calls a non-existent `/api/usage-limits`, and the component is never mounted.
    - `lib/subscription/use-cancel-subscription.ts` and `components/sign-out-form.tsx` are unreferenced.
    - Cancel feedback has two paths (R25 body and R27).
12. **Client and server type coupling**: `components/multimodal-input.tsx:21` imports types from a route file.
13. **Ops**:
    - `cleanup-payment-intents` is unscheduled.
    - Cron auth accepts `Bearer undefined` when `CRON_SECRET` is unset.
    - The Resend webhook skips verification without its secret.
    - The CloudPayments HMAC compare is not constant-time.
    - Health leaks env names and error text.
14. **Versioning hazard**: `selectedChatModel` is a strict enum of the current registry (`schema.ts:37`), and the file-part `mediaType` is a strict enum (`schema.ts:16-25`). A mobile build that still sends a removed model id gets a generic 400. v1 should accept `string` and map unknown or retired ids to a fallback or a typed `MODEL_UNAVAILABLE` error.

---

## 6. Cross-cutting behaviours the new API layer must preserve

| Behaviour | Where today | Requirement for v1 |
|---|---|---|
| ChatSDKError codes `{type}:{surface}` with status mapping bad_request→400, unauthorized→401, forbidden→403, not_found→404, rate_limit→429, quota_exceeded→429, offline→503, default 500 | `lib/errors.ts:1-22,123-142` | Map them to oRPC errors in one middleware. `ORPCError` accepts any code plus an explicit `status` and serialises `{defined,code,status,message,data}` (verified in `admin-dashboard/node_modules/@orpc/client/dist/shared/client.tozIaCTt.mjs:103-140`; common codes include TOO_MANY_REQUESTS=429 and BAD_GATEWAY=502, but no PAYMENT_REQUIRED or GONE, so define custom codes with explicit status). Keep `ChatSDKError` for the AI SDK stream routes, whose client `fetchWithErrorHandlers` reads `{code,cause,message}` (`lib/utils.ts:29-48`) |
| Database errors are logged, never exposed (`visibility: "log"`) | `lib/errors.ts:26-27,62-73`, `lib/api/handle-route-error.ts:10-21` | The error middleware must sanitise unknown errors and DB errors to a generic 500 and log them with context |
| `cause` is sent to clients | `lib/errors.ts:75` | Decide per code. For v1, put structured data in `data`, never free text from internal errors |
| Balance gate before inference, charge after, billing failure never breaks the stream (`chargeUsageSafe`) | `route.ts:159-166`, `_lib/enforce-balance.ts`, CLAUDE.md gotcha 4 | Unchanged. The chat turn stays outside oRPC. The quota error must stay distinguishable (proposal: v1 code `INSUFFICIENT_BALANCE`, status 402, documented in OpenAPI; this is a proposal, not something verified) |
| Rate limits: chat 30/min per user, password reset 5/h per email, verification resend 1/60 s per email, payment status 120/min per IP; all fail open | `lib/rate-limit.ts:4-42` | Port them as oRPC middleware with per-procedure config. Return 429 plus `Retry-After` consistently. Key by user id for authenticated calls |
| Per-user turn slots and stop markers (Redis) | `_lib/turn-slot.ts`, `_lib/stop-signal.ts` | Unchanged and shared by web and mobile |
| Anti-enumeration: dummy bcrypt compare; resend and forgot-password always succeed | `auth.ts:47-55`, `actions.ts:284-287,349-353` | Must hold on v1 auth procedures. Keep the response shape and timing equal |
| Email normalisation and the unique `lower(email)` | CLAUDE.md, `lib/auth/__tests__/normalize-email.test.ts` | Reuse the same query functions |
| Runtime tier decisions read the DB, not the JWT | `create-intent/route.ts:55`, `topup/route.ts:46`, `quiz/[key]/route.ts:56-60` | The v1 context must not expose JWT snapshot fields as authoritative |
| i18n: Russian UI strings come from `messages/ru.json`; the API returns English messages plus codes | `lib/i18n/translate.ts` | v1 returns stable codes plus English fallback messages. Clients localize by code. Do not localize on the server per request unless `Accept-Language` is adopted |
| Logging: `console.*` with context; Vercel request id in the chat error path; client log sink | `_lib/handle-error.ts:23-25`, `api/log/route.ts` | Add an oRPC logging interceptor carrying procedure path, user id and `x-vercel-id`. Remove the session `console.log`s (`auth.ts:92-141`) |
| Activity tracking (`recordUserActivity`) | `app/(chat)/layout.tsx:39-41`, `route.ts:84` | Mobile never renders the layout, so call it from the v1 auth middleware (deduped) or the turn POST |
| Ownership checks on every chat, project, file and vote | inline in each route | Centralise them as procedure-level helpers. Add the missing messageId-in-chat check (R8) |
| Feature flags `isSignupEnabled`, `isTopupEnabled` | `lib/flags.ts`, `actions.ts:108`, `topup/route.ts:41` | The flags SDK resolves them per request, possibly from cookies or headers (UNVERIFIED for non-browser callers). Expose them via `GET /v1/config` |
| Signup gating, UTM attribution and registration geo | `actions.ts:107-140`, `lib/geo/registration-geo.ts:47` | Accept UTM and language in the registration body. Geo headers come from the Vercel edge and work for any client (inferred) |
| `maxDuration` 800 for the chat and stream routes, 25 for the CloudPayments webhook | `route.ts:45`, `stream/route.ts:14`, `cloudpayments/route.ts:20` | Moved routes must re-export `maxDuration` |
| Public agent-discovery spec | `app/openapi.json/route.ts`, `lib/agent-discovery/openapi.ts`, `docs/agent-discovery.md` | The v1 OpenAPI spec is a **separate** document (for example `/v1/openapi.json`). `docs/agent-discovery.md` deliberately leaves the session APIs out of the public spec; this needs an explicit owner decision |

---

## 7. Proposed /v1 resource map (all (a) and (d) items)

| Method + path | Replaces | Kind |
|---|---|---|
| `POST /v1/auth/registrations` | A2 | a |
| `POST /v1/auth/sessions` | A1 | a |
| `POST /v1/auth/sessions/refresh` | new | a |
| `DELETE /v1/auth/sessions/current` | `signOut` | a |
| `POST /v1/auth/email-verification` / `POST /v1/auth/email-verification/resend` | A3, A4 | a |
| `POST /v1/auth/password-resets` / `POST /v1/auth/password-resets/confirm` | A5, A6 | a |
| `GET /v1/config` (public) | P8, P7 constants | a |
| `GET /v1/models` (public) | P1, client imports | a |
| `GET /v1/plans` | P9 | a |
| `GET /v1/me` | R31 | a |
| `GET /v1/me/balance` | R22 | a |
| `GET /v1/me/billing-overview` | P5 | a |
| `GET /v1/me/spend-history` | P5 | a |
| `GET /v1/me/transactions` / `GET /v1/me/usage-summary` | R23 | a |
| `GET /v1/me/payments` | P6 | a |
| `GET /v1/me/subscription` | R24, P6 | a |
| `POST /v1/me/subscription/cancel` / `resume` / `cancellation-feedback` | R25, R26, R27 | a |
| `POST /v1/payment-intents` / `GET /v1/payment-intents/{sessionId}` | R28, R29, R30 | a |
| `GET /v1/me/quizzes/{quizKey}` / `PUT /v1/me/quizzes/{quizKey}` | R20, R21 | a |
| `GET /v1/prompts` | R17 | a |
| `PUT` / `DELETE /v1/me/favorite-prompts/{promptId}` | R18, R19 | a |
| `GET /v1/chats` / `DELETE /v1/chats` | R5, R6 | a |
| `GET /v1/chats/{chatId}` / `DELETE /v1/chats/{chatId}` | P2, R2 | a |
| `GET /v1/chats/{chatId}/messages` / `DELETE /v1/chats/{chatId}/messages?fromMessageId=` | P2, A8 | a |
| `GET /v1/chats/{chatId}/votes` / `PUT /v1/chats/{chatId}/messages/{messageId}/vote` | R7, R8 | a |
| `POST /v1/chats/{chatId}/turns` (SSE) | R1 | d |
| `GET /v1/chats/{chatId}/stream` (SSE resume) | R3 | d |
| `POST /v1/chats/{chatId}/turns/{turnId}/stop` | R4 | d |
| `POST /v1/uploads` (multipart) | R9 | d |
| `GET` / `POST /v1/projects`, `GET` / `PATCH` / `DELETE /v1/projects/{projectId}` | R10-R13, P4 | a |
| `GET` / `POST /v1/projects/{projectId}/files`, `DELETE /v1/projects/{projectId}/files/{fileId}` | R14-R16 | a, with d for the multipart POST |

Naming note: the owner's example `/v1/chat/history` maps here to `GET /v1/chats`. In REST, "history" is the chats collection; a `history` segment would be a verb-ish noun beside `chats/{id}`. If the owner prefers the literal path, nothing else in the map changes.

---

## 8. Existing test coverage of the surface

| Covered | Not covered |
|---|---|
| Chat `_lib` units (13 files); quiz POST (3 cases); payment create-intent (6 cases); reset-quotas cron (4 cases); subscription route exports only; CloudPayments tester-plan handler; refund, charge, balance and turn-slot billing units; `deleteTrailingMessagesForUser`; e2e: login UI and chat input | All 6 auth server actions; the cookie actions; history; votes; projects and project files; uploads; prompts and favourites; transactions; usage; me; payment status; top-up intent; the subscription cancel and resume behaviour; cancellation feedback; the stream resume route; the stop route handler; the Resend webhook; CloudPayments pay, recurrent, cancel and fail handlers (beyond tester-plan and refund); health |

Vitest picks up only `**/__tests__/**/*.test.ts` (`vitest.config.ts:8`). New contract tests must follow that layout or the config must change.
