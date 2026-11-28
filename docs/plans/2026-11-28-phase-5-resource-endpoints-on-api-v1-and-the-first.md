---
date: 2026-11-28
status: accepted
branch: chore/gipiti-266-api-breaking-ci
issue: GIPITI-266
session: 4693d346-d6e1-4c17-8c91-f2d2f42edc76
---

# Phase 5: Resource endpoints on /api/v1 and the first web calls to it

## Context

Phases 0 to 4 are done. `/api/v1` has five read endpoints and twelve auth operations, and nothing calls it yet: the web still uses 20 legacy routes and one server action for chats, projects, uploads, prompts, the quiz, billing and payments. Phase 5 of the roadmap (`docs/plans/2026-11-15-orpc-v1-roadmap.md`) ports those resources to v1, moves each domain's server code into `server/modules/<domain>`, and switches the web to the new endpoints.

Two things make this phase different from the earlier ones:

- **The web starts calling v1.** From the deploy of each switch, the endpoints the web uses are frozen: they may only grow (roadmap decision D22). CI starts refusing breaking changes to the committed spec.
- **It touches money on the way out**: payment intents, cancelling and resuming a subscription.

Owner decisions taken for this plan (2026-11-28):

- One plan and one Linear issue for the whole phase.
- Prompts and the quiz go first, as the pilot for the first web switch; then chats, projects and uploads, billing reads, money.
- Merges: file moves, tests, docs and endpoints nobody calls yet are merged by the agent after green CI and the `review` agent. Web switches and every PR that touches money wait for the owner's "Да, влить" (marked **[owner]** below, nine PRs).
- Preview checks of a web switch: the owner signs in on the preview in the browser pane, the agent runs the scenarios.

Research for this plan found things the roadmap does not say:

- **Uploads cannot go through a function at all** above 4.5 MB (spike S4, defect GIPITI-232). The installed `@vercel/blob@0.24.1` can sign a client token on the server (`generateClientTokenFromReadWriteToken`), and the upload is then one `PUT` to the Blob store. No package upgrade is needed.
- **The subscription widget charges a price written in client code** (`SUBSCRIPTION_SEEDS` through `payment-utils.ts`), not the amount of the intent the server created.
- **Two resume calls at once can each create a CloudPayments subscription** (`lib/subscription/resume-subscription.ts`: read, create, update, with no lock).
- **The quiz saves the answers and grants the bonus in two steps.** If the grant fails, a retry sees the saved answers and pays nothing.
- Legacy answers differ from route to route: a foreign chat is 403 on one route and 404 on another; deleting someone else's project answers 200; patching one answers 500; `limit=0` on transactions returns 20 rows.
- Of the four "cards that query the database" (roadmap F8), only `PlanCard` does.
- The chat history cursor accepts another user's chat id.
- `oasdiff` supports OpenAPI 3.1 since 1.15.0; how it reads our nullable fields (`anyOf` with a `null` branch) is not documented and is checked in the first PR.

Outcome: 22 PRs and a docs PR. After them a mobile client can do everything except send a chat turn (Phase 6), and the web no longer depends on the legacy routes of these resources, which stay only for browser tabs opened before each deploy.

## Decisions for this phase

| # | Decision | Reason |
|---|---|---|
| P1 | Order: foundation, 5c prompts and quiz, 5a chats, 5b projects and uploads, 5d billing reads, 5e money. The roadmap's letters are kept. | Owner decision. The shared pieces (web client, legacy counter, CI gate) are tried on the smallest domain. The mobile beta needs all five either way. |
| P2 | Each sub-phase is: **[R]** one move PR (`git mv` + `scripts/codemods/rewrite-imports.ts`, no logic edits), **[B]** endpoints with tests, **[B]** the web switch. | Roadmap. A move and a behaviour change are never in one PR. |
| P3 | A file that client code imports at runtime does not move to `server/modules`: it stays in `lib/` until Phase 11. Known so far: `lib/quiz/types.ts`, `lib/prompts/prompt-meta.ts`, `lib/billing/{money,constants}.ts`, `lib/subscription/{subscription-state,cancellation-reasons}.ts`, `lib/attachments/{attachment-limits,attachment-display}.ts`, `lib/payments/cloudpayments-widget.ts`, `lib/chat/input-draft.ts`. The move PR's dry run settles the rest. | Same rule as Phase 4 (its P2). `tests/architecture` refuses a client runtime import of `server/modules`. Nothing moves to `core/` unless a contract file has to import it. |
| P4 | The web client is born in its final place: `client/shared/api/{contract,orpc-client,errors}.ts` (`OpenAPILink` over the v1 contract, no response validation). Components call it through SWR as plain fetchers. | Roadmap D7, D18. `client/shared/api/contract.ts` is the one allowed edge from `client/` to `server/` (already in `tests/architecture/rules.ts`). Cost per spike S2: 9.5 KB gzip for oRPC, plus 18 KB for `zod/v4` on pages that do not ship it yet (`/chat` already does). |
| P5 | Legacy routes are not rewritten. Their imports follow the moves, and from the switch PR each one calls `recordLegacyHit(name)`. | The less a legacy route changes, the less can break for an old tab. The roadmap's "thin wrapper" would be a rewrite of code that is about to be deleted. |
| P6 | Legacy hits are counted in Postgres: table `LegacyHit (name, day, count)`, one upsert per hit inside `after()`. Migration `0049`. | The Phase 12 gate ("zero hits for 14 days") must be readable. The agent and `admin-dashboard` can read Postgres; nobody can read production Redis from outside. Hits fall to near zero after each switch, so the write is cheap. |
| P7 | CI job `api-breaking`: `oasdiff breaking --fail-on WARN` on the snapshot of the base commit against the PR's. With the label `api-unreleased-change` the findings are printed and do not fail the job, for endpoints no shipped client calls yet. | Roadmap D22 and spike S11. Until the mobile app ships, "frozen" means "the web calls it"; the PR body says which endpoints a labelled change touches. |
| P8 | Lists a user cannot grow large are returned whole as `{ items }`: prompts, favourite prompts, projects, project files, votes. Cursor pagination (`_kit/pagination.ts`: `limit` 1..100, default 20, opaque `cursor` of `(createdAt, id)`) is for chats, transactions and card payments. | A page size or an ordering cannot change once frozen, so pagination is added only where a list is unbounded. |
| P9 | `GET /chats/{chatId}/messages` moves to Phase 6c. In Phase 5 `chat/[id]/page.tsx` keeps reading the module directly. | The roadmap lists the endpoint in 5a but designs its `MessagePart` schema in 6c, together with the stream's golden test. Freezing a message shape before that work is the riskiest shortcut in the phase. |
| P10 | No `GET /me/billing/overview` and no `/usage-summary`. The pages make three or four in-process calls in parallel; the summary holds only the balance, which `/me/billing/balance` already returns. | Fewer frozen shapes. `getUsageSummary` returns `{ balance, currencyCode }` and nothing else. |
| P11 | Transactions keep their "1 to 20 of N" pager: the answer is `{ items, nextCursor, totalCount }`. | The page shows a total today (`components/token-history-table.tsx`). Dropping it would be a visible change nobody asked for. |
| P12 | Uploads go straight to the Blob store. The server answers `POST /uploads` with **the request to make** (`upload: { method, url, headers }`); the client sends the bytes there, then calls `POST /uploads/{uploadId}/complete`. A table `Upload` records each one. Migration `0050`. | S4. Blob's client protocol is private (`x-api-version: 7` read from the SDK source); returned by the server, it can change without an app release. The table gives ownership (the client never names a pathname), an idempotent `complete`, the rule Phase 6 needs ("a file URL in a turn is one of the caller's ready uploads"), and something to clean up. |
| P13 | Pathnames are `u/<userId>/<uploadId>/<ascii-safe name>`, with no random suffix. The token limits size, type and lifetime (15 minutes). `complete` checks the stored blob again, and re-encodes a chat text attachment to UTF-8 under a new pathname. | Roadmap D19 and M6. A new pathname, because the store's URLs are cached for a year. |
| P14 | No multipart upload endpoint in v1, and no `handleUpload` route. | A second frozen protocol for files under 4.5 MB only; `handleUpload` speaks the SDK's own exchange, not our envelope, and depends on a callback that cannot reach localhost. |
| P15 | `POST /payment-intents` requires an `Idempotency-Key` header. It is stored in `PaymentIntent.idempotency_key` with a unique index on `(user_id, idempotency_key)`. Migration `0051`. A replay with the same body returns the same intent; with another body, 409. | Roadmap m8. One row is the one source of truth; legacy rows carry `NULL`. |
| P16 | **Departure from the roadmap:** an open intent with the same kind and amount is not reused. | The pay webhook acknowledges a second charge against an already succeeded top-up intent and credits nothing (`handlers/pay.ts`). Reuse would turn a second click after a redirect into a charge without a credit. The key already covers retries and double clicks. |
| P17 | The intent response carries a `cloudpayments` object the client passes to the widget unchanged: `{ publicId, accountId, email, description, amount, currency, data }`, built on the server from the catalogue price, including the receipt and the recurrent block. | The web stops pricing a subscription from client constants; a WebView needs nothing else (roadmap Q12). `data` is exactly what the webhook reads today, so the webhook does not change. |
| P18 | At most 20 intents per user per rolling hour, counted in the database inside the insert transaction. | No limit exists today. A database count has no fail-open gap and is testable on Postgres. |
| P19 | Cancel and resume run under `SELECT … FOR UPDATE` on the user's subscription row, held across the CloudPayments calls (each with a 10-second timeout). Resume looks for an existing active CloudPayments subscription and adopts it before creating one. | Closes the double-create. Adoption also heals "CloudPayments succeeded, our write failed". Both operations are rare, so holding one pool connection for seconds is acceptable. |
| P20 | Ownership failures answer 404 on every v1 endpoint. The legacy routes keep their own codes. | Roadmap convention. |
| P21 | RSC pages read through an in-process client, `server/api/_kit/server-caller.ts`, first used in 5b. | Roadmap D14: page props become the DTOs a mobile client receives, and the client components stop importing database row types. |
| P22 | No new rate limiter except: upload starts (60 per 10 minutes per user) and the intent limit of P18. The payment-status limit is keyed by user id on v1, not by IP. | Parity with the legacy routes, which have none. Bearer callers behind one NAT must not share a bucket. |

## Order of work

One Linear issue in team `GIPITI`, created when this plan is approved; every commit and PR title carries its id. Each PR is from `origin/main` with base `main`, opened after the previous one merged. `pnpm check` before each; `pnpm test:integration` when a query or a migration is touched. The `review` agent reads every [B] PR before it is merged or offered for merging. A PR that adds or changes an endpoint runs `pnpm api:spec`.

Every v1 endpoint below needs a signed-in caller (bearer or cookie) unless it says "public", and declares `UNAUTHORIZED`. Tests per endpoint: happy path, 401, foreign id → 404, validation, each declared error; one HTTP test per resource.

### Foundation

**F1 [B: CI].** Job `api-breaking` in `.github/workflows/ci.yml` (P7). In-phase spike S11 on a throwaway branch: a removed field, a field made nullable and a removed endpoint each fail the job; the label turns the failure into a warning. The result, and how `oasdiff` reads our `anyOf` nullables, goes into `spike-findings.md`. If `oasdiff` cannot read the 3.1.1 snapshot, the owner is told before anything else is built on it.

**F1b [B].** The OpenAPI document gets a per-operation `security` entry for the procedures that require a signed-in caller (set from the contract, emitted by `server/api/_kit/openapi.ts`), so that a change in who may call an endpoint shows up in the snapshot and in `api-breaking`. Found by the review of F1.

**F2 [B].** `client/shared/api/contract.ts` (re-export), `orpc-client.ts` (`api`), `errors.ts` (`isApiError`, code and reason readers, the mapping from a wire error to a key in `messages/ru.errors.json`). `server/http/legacy-hit.ts` with migration `0049_legacy_hit.sql`, journal, snapshot, schema. Tests: the client against the real route handler through a stubbed `fetch` (a 200, a typed error, a 404); `recordLegacyHit` on Postgres (two hits on one day make `count = 2`; a failure never throws).

### 5c. Prompts and the quiz

| Method + path | 2xx | Errors (`code` / `data.reason`) |
|---|---|---|
| `GET /prompts` (public, reads no credentials) | 200 `{ items: [{ id, key, category, modelId, title, body, tags }] }`, active only, catalogue order | none |
| `GET /me/favorite-prompts` | 200 `{ items: [{ promptId }] }` | |
| `PUT /me/favorite-prompts/{promptId}` | 204, idempotent | `NOT_FOUND` |
| `DELETE /me/favorite-prompts/{promptId}` | 204, idempotent | |
| `GET /me/quizzes/{quizKey}` | 200 `{ completed }` | `NOT_FOUND` (unknown quiz) |
| `PUT /me/quizzes/{quizKey}` `{ answers }` | 200 `{ completed, bonusGranted, bonus: Money \| null }` | `NOT_FOUND`, `BAD_REQUEST/invalid_answers`, `FORBIDDEN/email_not_verified` |

- **C1 [R].** `lib/db/query/{prompt,quiz}` → `server/modules/{prompts,quiz}/queries`; `lib/prompts/{prompt-seed,prompt-sheet,prompt-sync}.ts` → `server/modules/prompts/`; `lib/quiz/registry.ts` → `server/modules/quiz/`.
- **C2 [B] [owner].** The endpoints, and a service `submitQuiz` that saves the answers and grants the bonus in one transaction (`grantQuizBonus` takes an executor, like `grantDeferredWelcomeBonus`). The legacy quiz route calls the same service. Integration test: a grant that throws leaves no answers row, and a retry pays once; two concurrent submits pay once.
- **C3 [B] [owner].** `components/prompt-library/prompt-library.tsx` (two SWR reads; the optimistic favourite toggle stays), `app/subscription/_components/quiz-reward-banner.tsx`. The legacy routes get the hit counter. A Playwright spec for the prompt library (list, favourite, reload).

### 5a. Chats

| Method + path | 2xx | Errors |
|---|---|---|
| `GET /chats?limit&cursor` | 200 `{ items: [{ id, title, createdAt }], nextCursor }`, newest first | `BAD_REQUEST` (bad cursor) |
| `GET /chats/{chatId}` | 200 `{ id, title, createdAt }` | `NOT_FOUND` |
| `DELETE /chats/{chatId}` | 204 | `NOT_FOUND` |
| `DELETE /chats?confirm=true` | 204 | `BAD_REQUEST` without `confirm` |
| `GET /chats/{chatId}/votes` | 200 `{ items: [{ messageId, isUpvoted }] }` | `NOT_FOUND` |
| `PUT /chats/{chatId}/messages/{messageId}/vote` `{ isUpvoted }` | 204 | `NOT_FOUND` (chat, or message not in it) |
| `DELETE /chats/{chatId}/messages?fromMessageId=` | 204; also when the message is already gone | `NOT_FOUND` (chat) |

- **A1 [B, behaviour-neutral].** `convertToUIMessages` leaves `lib/utils.ts` for `server/modules/chat/to-ui-messages.ts`; the five exports nobody imports and `getLatestUserMessageByChatId` are deleted. `cn`, `fetcher` and the uuid helpers stay until Phase 11 (the roadmap wanted the whole split now; that is 66 importers of `cn` moved for nothing this phase needs).
- **A2 [R].** `lib/db/query/chat` (15 files) → `server/modules/chat/queries`; `lib/chat/delete-trailing-messages.ts` → `server/modules/chat/`. The chat turn's imports follow.
- **A3 [B].** `_kit/pagination.ts`; the endpoints; services that delete a chat, all chats and trailing messages in one transaction each; a cursor that is scoped to the caller. Integration test for the cursor on Postgres (three pages, equal timestamps, a foreign id as cursor).
- **A4 [B] [owner].** `components/sidebar-history.tsx` (`useSWRInfinite` on the cursor), `app-sidebar.tsx`, `chat.tsx` (votes key and the keys it revalidates after a turn), `message-actions.tsx` (its hard-coded English error strings move to `messages/ru.json`), `message-editor.tsx`. The `deleteTrailingMessages` action and the legacy routes get the hit counter. A failed delete now shows an error: today `toast.promise(fetch(…))` reports success on a 500. Playwright spec with chats seeded in the database: list, load more, delete one, delete all.

### 5b. Projects and uploads

| Method + path | 2xx | Errors |
|---|---|---|
| `GET /projects` | 200 `{ items: Project[] }` | |
| `POST /projects` | 201 `Project` | `BAD_REQUEST` |
| `GET /projects/{projectId}` | 200 `Project` | `NOT_FOUND` |
| `PATCH /projects/{projectId}` | 200 `Project` | `NOT_FOUND`, `BAD_REQUEST` |
| `DELETE /projects/{projectId}` | 204 | `NOT_FOUND` |
| `GET /projects/{projectId}/files` | 200 `{ items: ProjectFile[] }` | `NOT_FOUND` |
| `POST /projects/{projectId}/files` `{ uploadId }` | 201 `ProjectFile`; a replay returns the same row | `NOT_FOUND`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `CONFLICT/upload_not_found` |
| `DELETE /projects/{projectId}/files/{fileId}` | 204 | `NOT_FOUND` |
| `POST /uploads` `{ purpose: "chat_attachment" \| "project_file", filename, sizeBytes, mediaType? }` | 201 `{ id, status, mediaType, maxSizeBytes, expiresAt, upload: { method, url, headers } }` | `PAYLOAD_TOO_LARGE/file_too_large` (+ `data.maxSizeBytes`), `UNSUPPORTED_MEDIA_TYPE/unsupported_type`, `TOO_MANY_REQUESTS` |
| `POST /uploads/{uploadId}/complete` | 200 `{ id, status, url, name, mediaType, sizeBytes, isTruncated }`; idempotent | `NOT_FOUND`, `CONFLICT/upload_not_found` (bytes not there yet), `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `UPSTREAM_ERROR` |

`Project` is `{ id, name, description, swatch, contextEntries, isDefault, pinned, usageCount, createdAt, updatedAt }`; `ProjectFile` is `{ id, name, sizeBytes, mediaType, url, createdAt }`. `swatch`, upload `status` and `purpose` in outputs are open enums. Limits stay 10 MB for a chat attachment and 25 MB for a project file, and with this change they become reachable.

- **B1 [R].** `lib/db/query/project` → `server/modules/projects/queries`; `lib/attachments/attachment-fetch-policy.ts` → `server/modules/uploads/`.
- **B2 [B].** Project endpoints; `_kit/server-caller.ts`; the default-project switch in one transaction; `getDefaultProject` (no importer) deleted.
- **Spike before B3** (recorded in `spike-findings.md`): with a token signed locally, one `PUT` by `curl` and one from a browser page. It settles whether the store enforces the token's size, type, pathname and lifetime, which headers are required, and that CORS allows a plain `fetch`. It writes a few test files under `spike/` in the Blob store and deletes them; **the owner is asked before it runs**, because it writes to the store.
- **B3 [B].** Migration `0050_uploads.sql` (`Upload`; `ProjectFile.upload_id`, unique, nullable); `server/modules/uploads` (`initiateUpload`, `completeUpload`, the per-purpose type and size policy built on `resolveTextAttachmentMediaType` and `decodeTextFile` from `lib/ai/text-attachments.ts`); the upload and project-file endpoints; the limiter of P22; the hourly `cleanup-payment-intents` cron also deletes `pending` and `rejected` uploads older than a day, with their blobs. Integration tests with the Blob calls stubbed at `fetch`: another user's upload id is 404; `complete` twice returns the same answer; an oversized blob is deleted and refused.
- **B4 [B] [owner].** `contexts/project-context.tsx`, `components/entity-gallery.tsx`, `components/styles-projects/editor-v1.tsx`, `components/multimodal-input.tsx` (it stops importing types from a route file), `app/(chat)/projects/[id]/page.tsx` through the server caller. Preview check with a 9 MB PDF and a Windows-1251 text file. Closes GIPITI-232. Playwright spec: create, rename, pin, delete a project.

The legacy upload routes stay as they are and keep working below 4.5 MB.

### 5d. Billing reads

| Method + path | 2xx |
|---|---|
| `GET /me/billing/balance` | 200 `{ balance: { subscription, topup, total } \| null, spend: { spentPercent, epochKey } \| null }` |
| `GET /me/billing/transactions?limit&cursor` | 200 `{ items, nextCursor, totalCount }` |
| `GET /me/billing/spend-history?limit` | 200 `{ items, recentSpend }` (per-chat spend, and the last seven days) |
| `GET /me/billing/payments?limit&cursor` | 200 `{ items, nextCursor }` (card charges) |
| `GET /me/subscription` | 200 `{ subscription: { … } \| null }`: plan, status, period end, cancel flags, price, next payment, card mask |

Money is `{ amountMinor, currencyCode }` everywhere; no formatted strings. Transaction `type` and `pool`, payment `type` and subscription `status` are open enums. The item fields are fixed in D2 from `TransactionWithChat`, `ChatSpendRow`, `CardPayment` and `LatestSubscription`, without `userId` or raw `metadata`. `GET /me` gains the caller's top-up bounds (additive), which is what `PlanCard` queries the database for today.

- **D1 [R].** Server files of `lib/billing/**` and `lib/subscription/**` → `server/modules/{billing,subscription}`; `lib/db/query/subscription`, `lib/db/queries-transactions.ts` → their `queries/`; `lib/activity` → `server/modules/activity`; `subscription-tiers.ts` → `server/modules/subscription/seed/` once 5e removes its client import (until then it stays). About 35 importers of `balance.ts` alone; the characterization guard must show specifier-only diffs.
- **D2 [B].** The endpoints. The two functions both named `getActiveUserSubscription` (one checks the period end, one does not) get distinct names, with no change in what each caller receives. Integration test for the transactions cursor and `totalCount`.
- **D3 [B] [owner].** `hooks/use-spend-banner.ts`, `components/token-usage-summary.tsx`, `components/token-history-table.tsx` (cursor stack behind the same pager), `chat.tsx` (the key it revalidates), `app/subscription/page.tsx` and `manage/page.tsx` through the server caller, `PlanCard` without its own query. Money is formatted in the page from the DTOs with `formatCurrency`. Playwright spec with a seeded subscription and transactions: balance page, usage table paging, manage page.

### 5e. Money mutations

| Method + path | 2xx | Errors |
|---|---|---|
| `POST /payment-intents` + `Idempotency-Key`; body `{ kind: "subscription", planCode }` or `{ kind: "topup", amountMinor }` | 201 `{ id, kind, status, amount, planCode, expiresAt, provider, cloudpayments: { … } }` | `BAD_REQUEST/{idempotency_key_required,invalid_amount,invalid_plan}`, `FORBIDDEN/{plan_not_available,topup_unavailable,subscription_required}`, `CONFLICT/{idempotency_key_mismatch,idempotency_key_spent}`, `TOO_MANY_REQUESTS` |
| `GET /payment-intents/{intentId}` | 200 `{ id, kind, status, hasActivity, amount, expiresAt, failureReason, subscription, balance }`; `expired` is computed, nothing is written | `NOT_FOUND`, `TOO_MANY_REQUESTS` |
| `POST /me/subscription/cancel` `{ feedback? }` | 200 `{ subscription }`; a repeat makes no CloudPayments call | `NOT_FOUND/no_active_subscription`, `UPSTREAM_ERROR/payment_provider_error` (nothing changed) |
| `POST /me/subscription/resume` | 200 `{ outcome, subscription }` | `CONFLICT/subscription_expired`, `UPSTREAM_ERROR/payment_provider_error` |
| `POST /me/subscription/cancellation-feedback` `{ reason?, additionalFeedback? }` | 204 | `BAD_REQUEST`, `NOT_FOUND/no_subscription` |

Before E2 starts, this section is read again against the code as it then stands, and any departure is brought to the owner.

- **E1 [R].** `lib/payments/{cloudpayments,cloudpayments-config,cloudpayments-types}.ts` → `server/integrations/cloudpayments/`; `app/api/webhooks/cloudpayments/lib/**` → `server/webhooks/cloudpayments/`. The route file stays and re-exports.
- **E2 [B, money] [owner].** Migration `0051_payment_intent_idempotency_key.sql`; `server/modules/payments` (`createPaymentIntent`, `getPaymentIntentStatus`, the widget payload builder); the two endpoints. The three legacy intent routes and the webhook get no diff. Integration tests: ten concurrent requests with one key make one row; mismatch; spent; the 21st intent in an hour; signed `check` and `pay` webhooks built from the returned `data` credit a top-up and activate a subscription; an expired intent stays `pending` in the table.
- **E3 [B, money] [owner].** `withLockedActiveSubscription`; timeouts and `X-Request-ID` on the CloudPayments client; adopt-before-create in `resumeSubscription` (the legacy resume route gains it too); the three subscription endpoints. Integration tests with CloudPayments stubbed at `fetch`: two concurrent resumes make one create call; a failed write after a create is adopted on the next call; a repeated cancel makes one cancel call.
- **E4 [B, money] [owner].** `cancel-flow-dialog.tsx`, `resume-dialog.tsx`.
- **E5 [B, money] [owner].** `use-payment.ts`, `top-up-dialog.tsx` (a fresh key per click; the widget gets `intent.cloudpayments`; polling by intent id); the client-side price functions in `payment-utils.ts` are deleted. On a preview, with the owner's go-ahead at that moment: a test-mode subscription, a top-up, a cancel and a resume, then a reconciliation query (every paid intent has its webhook transaction).

### After the PRs

One docs PR: the roadmap's Phase 5 status line and its corrections (P5, P9, P10, P11, P12 to P17, A1, migration numbers `0049` to `0051`, account deletion becomes `0052`), `CLAUDE.md` (the new endpoints, the upload flow, what moved), this plan's `status: done` with implementation notes. The Linear issue is closed and the memory note updated.

## Found, and not fixed in this phase

Each is a separate task; the owner decides whether and when.

1. **Project files never reach the model.** `prepare-chat-turn.ts` passes only a project's name and context entries to the prompt. The upload UI stores files nothing reads. They are ported as they are.
2. **A second charge against a succeeded top-up intent is acknowledged and not credited** (`handlers/pay.ts`, the "already succeeded" branch). Whether that is a duplicate webhook or a real second payment is not distinguished by transaction id.
3. **A late cancel webhook can flag a resumed subscription as cancelled again** (`handlers/cancel.ts` updates by row id without checking the external id still matches).
4. The check webhook validates a subscription against the catalogue price but not against an existing, unexpired intent.
5. Deleting a chat or a project leaves its blobs in the store; generated media is stored at the store root, outside any user prefix (Phase 6 has to allow for it).
6. `isReadonly` in `chat/[id]/page.tsx` is always false.

## Risks

| Risk | Mitigation |
|---|---|
| A shape frozen by a web switch turns out wrong | Each contract is reviewed in its endpoint PR, before any caller exists; the switch PR is the owner's to merge; lists carry `items` so fields can be added; values that may grow are open enums. |
| A web switch breaks a screen | Playwright spec per switch, written against seeded data; the preview check with the owner signed in; rollback is a revert of the switch PR alone, because the legacy routes still serve. |
| Old tabs after a deploy | Legacy routes are untouched (P5); hits are counted (P6) for the Phase 12 gate. |
| The Blob store does not enforce the token as assumed, or refuses a plain browser `PUT` | The spike before B3. `complete` re-checks size and type from the stored blob in any case. If a browser `fetch` is refused, the web uses the SDK's `put` with the same token, and the contract does not change. |
| Blob's private protocol changes | The server returns the request to make (P12); only `initiateUpload` changes. |
| The double-charge of finding 2 is made easier | P16: no intent reuse. |
| A lock held across CloudPayments calls exhausts the pool | 10-second timeouts; cancel and resume are rare; the lock is on one user's row. |
| CloudPayments does not behave as assumed (`find` consistency, repeated cancel, `X-Request-ID`) | Checked in test mode on the E5 preview before the money switches are merged; the integration tests pin our side. |
| A payment in flight during the E5 deploy | The webhook completes it regardless; only the "verifying" dialog of that one tab is lost. |
| A move breaks an import the codemod does not see | `tsc`, the `mock-specifier` rule and `next build`; path strings in `package.json`, configs and docs are changed by hand in the same commit. |
| `oasdiff` misreads the 3.1.1 snapshot | F1 finds out first; the snapshot test in `pnpm check` keeps every contract change visible meanwhile. |
| A hand-written migration is wrong | It runs on the preview's own Neon branch before the merge and locally under `pnpm test:integration`; it is never edited after its preview build. |

## Verification (whole phase)

- Every PR: `pnpm check` green locally and in CI, the characterization guard without its label, `pnpm test:integration` when the database is touched, `pnpm api:spec` leaving no diff after it is committed.
- `pnpm vitest run server/api server/modules client tests/architecture tests/characterization`.
- Each web switch: its Playwright spec; the scenarios on a local production build against the local database; the same on the preview after the owner signs in there. The result is attached to the request for the merge.
- After each merge: the production deployment is ready, `/api/health` answers 200, the runtime log has no new errors in the following hour, and for a switch the switched screen is opened once on `gipiti.ru` in the owner's session.
- 5e: the test-mode run and the reconciliation query described under E5.
- Legacy counters: one week after the last switch, `SELECT name, day, count FROM "LegacyHit"` shows which legacy routes old tabs still reach.
- Rollback: revert the single PR. Migrations `0049` to `0051` are additive and stay.
