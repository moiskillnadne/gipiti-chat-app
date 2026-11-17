---
date: 2026-11-15
status: accepted
---

# oRPC v1 API, mobile auth and client/server restructure

Umbrella roadmap written on 2026-11-15 by a team of Opus agents: five researchers, an architect and two critics (risk; pragmatism). Markers: **[OBS]** = observed in the repo or in an installed or published package (cited `path:line`); **[INF]** = inference; **UNVERIFIED** = an explicit spike task (S-numbers, Phase 2 or in-phase).

Supporting material lives in `docs/plans/orpc-v1-roadmap/`: the five research reports (`research-*.md`), which this plan cites by file name and section, and the two critiques (`critique-*.md`), summarised under "Review notes".

Accepting this roadmap does not start implementation. Each phase gets its own short plan file and its own Linear issue (team `GIPITI`), so the per-phase plan files can reach `status: done` (see the CLAUDE.md "Plans" rules). The roadmap changes only when a decision changes.

### Evidence re-checked for this revision (all [OBS])

| Fact | Evidence |
|---|---|
| `@orpc/*` npm `latest` = `1.16.2` (`beta` = `2.0.0-beta.50`) | npm registry dist-tags for `@orpc/zod` |
| `@orpc/zod@1.16.2` peer `zod >=3.25.0`; its `./zod4` entry imports `zod/v4/core`, which the app's `zod@3.25.76` ships | npm `@orpc/zod@1.16.2/package.json`, `dist/zod4/index.mjs`; `node_modules/zod/v4/core/` |
| `@orpc/zod/zod4` exports `ZodToJsonSchemaConverter`, `JSON_SCHEMA_OUTPUT_REGISTRY`, `experimental_ZodSmartCoercionPlugin` | `@orpc/zod@1.16.2/dist/zod4/index.d.mts:62,313` |
| `@orpc/openapi@1.16.2` exports `OpenAPIGenerator` (root) and `OpenAPIHandler` (`./fetch`) | `@orpc/openapi@1.16.2/dist/index.d.mts`, `dist/adapters/fetch/index.d.mts` |
| `@orpc/contract@1.16.2` ships `RequestValidationPlugin` and `ResponseValidationPlugin` (client link plugins) | `@orpc/contract@1.16.2/dist/plugins/index.d.mts:17,32` |
| `prepareSendMessagesRequest` receives `trigger` and `messageId` and may return `api`; reconnect defaults to `${api}/${chatId}/stream` | `node_modules/ai/dist/index.mjs:12243-12256,12307` |
| The web transport does **not** forward `trigger`; it sends `id, turnId, message, selectedChatModel, …` | `components/chat.tsx:106-131` |
| Re-POSTing a stored user message id runs (and bills) inference again | `app/(chat)/api/chat/_lib/prepare-chat-turn.ts:262-289` |
| Foreign chat → `forbidden:chat` (403) | `prepare-chat-turn.ts:232-233` |
| Chat body parsed with `request.json()` regardless of content type | `app/(chat)/api/chat/_lib/parse-request.ts:19` |
| File-part `url` is any URL; text attachments are fetched unbounded | `app/(chat)/api/chat/schema.ts:32`, `lib/ai/text-attachments.ts:154-160` |
| Uploads are stored under the bare filename (not user-scoped) | `app/(chat)/api/files/upload/route.ts:124` |
| NextAuth `jwt` callback runs on every `auth()`; returning `null` clears the session cookies | `app/(auth)/auth.ts:80-131`; `@auth/core@0.41.3/lib/actions/session.js:34,53-55` |
| `jwt` `update` trigger lets the client set `emailVerified` / `hasActiveSubscription` | `app/(auth)/auth.ts:115-126` |
| Limiters are no-ops when no Upstash REST client exists (TCP `REDIS_URL` yields none) | `lib/rate-limit.ts:14,63`, `lib/redis.ts:10-40` |
| Production build runs migrations from a hard-coded path, with no environment guard | `package.json:7`, `lib/db/migrate.ts:10-24` |
| CloudPayments HMAC compared with `===` | `app/api/webhooks/cloudpayments/route.ts:25-37` |
| Tracing-includes keys are picomatch globs; the docs escape `[[...slug]]` (`:105`) but show unescaped `'/products/[id]'` (`:114`) | `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/output.md:93-114` |
| Tracing includes keyed `"/api/chat"` (fonts + watermark) | `next.config.ts:87-93` |
| Cookie preference actions set plain, non-httpOnly cookies; the chat layout reads them with `cookies()` | `app/(chat)/actions.ts:19-85`, `app/(chat)/layout.tsx:36-90` |
| Four nested Server Components query the DB | `app/subscription/_components/{plan-card,transaction-history-card}.tsx`, `app/subscription/manage/_components/{tariff-card,payment-history-card}.tsx` |
| Alias `@/*` → `./*`; no root `server/`, `client/`, `core/` folders exist | `tsconfig.json:22-24`; `ls` |
| 37 `route.ts` files; 6 auth actions + 12 chat actions | `find app -name route.ts`; `app/(auth)/actions.ts`, `app/(chat)/actions.ts` |
| `server-only` already a dependency | `package.json:73` |
| `feat/gipiti-28-mcp-integrations-cw6f0r` has 18 commits not in `origin/main` | `git cherry origin/main <branch>` |
| Latest migration `0045_user_activity_day.sql` | `lib/db/migrations/` |

---

## Goal

1. Ship a typed, versioned REST API (`/api/v1`, OpenAPI 3.x) built on oRPC that a native or React Native client can consume from the OpenAPI document alone.
2. Make every capability the mobile app needs reachable over that API with bearer tokens: auth, chats, chat turns and streaming, projects, uploads, prompts, billing reads, subscription actions, payment intents and account deletion. Nothing the mobile app needs may depend on cookie-only sessions or on server actions. The web stops using server actions entirely.
3. Design versioning before the first mobile build ships: change rules, how v2 coexists with v1, forced upgrade, and CI enforcement.
4. Make client and server code visibly separate: `app/` (Next routing only), `client/` (Feature-Sliced Design), `server/` (API mirrored by URL path, plus domain modules), `core/` (isomorphic). **Each file moves once**, straight to its final home.
5. Deliver the work as small PRs, each green on `pnpm check`. Money and security paths get tests before they are touched.

## Non-goals

- Building the mobile app or choosing its stack. Mobile payments (CloudPayments native SDK, App Store / Google Play digital-goods rules) are out of scope too: v1 returns payment-intent payloads complete enough for a WebView.
- Rewriting the chat turn as an oRPC procedure. It stays on the AI SDK UI-message-stream protocol.
- Replacing NextAuth for the web.
- Changing webhook or cron URLs or payload shapes.
- Migrating the web from SWR to TanStack Query.
- oRPC 2.x (beta).
- DB-synced user preferences (D15). They can be added later as an additive endpoint.
- Device attestation (App Attest / Play Integrity). This is a later abuse control (see M5).
- Universal / app links for password-reset emails.
- Splitting `lib/ai/models.ts` (2,252 lines) or `components/icons.tsx` (1,256 lines) beyond moving them.
- A full Zod 4 upgrade of the existing code. Not required (D12); optional Phase 13.

---

## Key decisions

| # | Decision | Main alternative | Why |
|---|---|---|---|
| D1 | **Top-level `app/` (Next routing only), `client/` (FSD), `server/`, `core/`; no `src/`.** The alias `@/*` → `./*` stays unchanged. `public/ content/ assets/ tests/ scripts/ docs/ types/ prompt-templates/` and config stay at the root. Legacy `lib/ components/ hooks/ contexts/ messages/` empty out over time. Phase 13 may later wrap everything into `src/` in one atomic commit; because every import is `@/…`, that only changes the alias. | Draft D1: atomic `src/` move first, then a second move of each file to its final home. | Each file moves once (pragmatist F1/F2). The migrations folder moves once. No alias change, no `proxy.ts`/`instrumentation.ts` move, no "Next ignores `src/app` when root `app/` exists" hazard. It matches the owner's literal "`server/` folder". The only cost is no visual match with `admin-dashboard`'s `src/` until the optional Phase 13 (Q1). |
| D2 | **FSD layers keep canonical names in `client/`** (`app pages widgets features entities shared`). Features start coarse (F10). | `_app` / `_pages`. | Next special-cases only root `app/`, `pages/` and `src/app`, `src/pages` [INF], so `client/pages` cannot be a Pages Router; S9 confirms it in a build. The fallback rename is mechanical. |
| D3 | **`server/api/<version>/` mirrors versioned URLs at resource level.** There is one folder per resource node (`/api/v1/chats/{chatId}/messages` ↔ `server/api/v1/chats/[chatId]/messages/`). Its `contract.ts` + `router.ts` cover every method on that path and on its leaf sub-paths that have no children of their own. Version-scoped DTOs live in `server/api/v1/_schemas/`, shared mappers in `v1/_mappers/`. Everything that is not a versioned URL (`modules`, `db`, `integrations`, `webhooks`, `cron`) is organised by role. | One folder and three files per endpoint (draft); URL-mirrored folders that hold the logic. | About 25 resource folders instead of about 50 endpoint folders (F7). DTOs have one versioned home, which is where v2 diverges. Logic in `server/modules` is version-independent and testable without oRPC. |
| D4 | **Contract-first oRPC.** `contract.ts` files use only `@orpc/contract`, `zod/v4`, `core/*`, `v1/_schemas`, `_kit/common-errors`, `_kit/pagination` and `_kit/open-enum`. `implement(contract)` lives in `router.ts`. The client reaches the contract only through `client/shared/api/contract.ts`, which re-exports `@/server/api/v1/contract`. That is the single allowlisted client→server edge (F11). | Router-first (dashboard style) with a type-only `RouterClient` import. | A contract can be published as an Expo/TS package later and can be bundled for `OpenAPILink` with runtime metadata. The spec is generated from an artefact free of drizzle, NextAuth and AI SDK. Router-first would also work; contract-first is chosen for the Expo package (F7), not for bundle leakage. |
| D5 | **Prefix `/api/v1`.** | Root `/v1`. | The proxy matcher excludes `api/` (`proxy.ts:158`), `next.config.ts:21` keeps HTML `Link` headers off `api/`, and robots already disallows `/api/`. |
| D6 | **One `OpenAPIHandler` (`@orpc/openapi/fetch`) catch-all** at `app/api/v1/[[...rest]]/route.ts`. Raw route files exist only for the turn POST and stream resume (`maxDuration` 800) and, if S4 requires it, for multipart uploads. | One `route.ts` per endpoint. | oRPC is the router; `maxDuration` is per route file. Precedence is spike S3. |
| D7 | **The web uses the same REST surface** via `OpenAPILink` + contract. No `RPCHandler`. v1 schemas use JSON-native types only (ISO-8601 strings, integer minor units). `ResponseValidationPlugin` is banned on clients (architecture test). | `RPCHandler` for the web. | One surface to test, and every web E2E test exercises the mobile API. Banning response validation keeps stale tabs tolerant of additive changes (M7). |
| D8 | **Chat turn and resume stay raw AI SDK routes** under v1 (`POST /chats/{chatId}/turns`, `GET /chats/{chatId}/stream`). Every raw v1 route is wrapped in `withV1Raw()` (`server/api/_kit/raw-route.ts`), which runs the same guard functions as the oRPC middleware: principal, CSRF, client version, rate limit, the ownership → 404 rule and the error envelope (M1). Stop is an oRPC procedure. | oRPC event-iterator procedure. | The route needs `after()`, resumable streams, Redis turn slots, `maxDuration` 800 and tracing includes. Sharing plain guard functions closes the "money route outside the middleware chain" gap. |
| D9 | **Auth: NextAuth stays for the web cookie; first-party tokens for mobile.** Access token: 15-min HS256 JWS with `kid` and claims `sub`, `sid`, `ver`, `aud`. Refresh token: opaque, stored SHA-256-hashed, rotated on use, with family revocation on reuse and sibling tolerance for parallel refreshes (M3). One `resolvePrincipal(request)`: bearer first, cookie only if no `Authorization` header. `token_version` is checked in the **NextAuth `jwt` callback**, so every `auth()` site honours revocation (M2). | better-auth; NextAuth JWE as bearer. | Zero web disruption, immediate revocation, and a token contract we own. |
| D10 | **Web login/logout use NextAuth's own endpoints** (`next-auth/react` `signIn("credentials", { redirect: false })` / `signOut()`). `authorize` calls the shared `authenticateCredentials()`. The rest of web auth calls `/api/v1/auth/*`. | Web calls `/api/v1/auth/login` in a cookie-minting mode. | No new cookie-minting code; both paths share one credential function. |
| D11 | **One error envelope**: oRPC `ORPCError` JSON `{ defined, code, status, message, data }`, with the exact HTTP encoding confirmed in S1. A single table maps `ChatSDKError` and domain errors. Clients localize by `code`. `INSUFFICIENT_BALANCE` (402) is separate from `TOO_MANY_REQUESTS` (429). In the spec `code` is a plain string with known values listed. | Keep `ChatSDKError` bodies. | Today there are six error shapes (`research-api-surface.md` §5.1). |
| D12 | **No Zod 4 upgrade on the critical path.** New contracts and v1 schemas import `zod/v4` from the installed `zod@3.25.76`, and the spec uses `@orpc/zod/zod4` `ZodToJsonSchemaConverter`. The peer range `>=3.25.0` and the `zod/v4/core` import were verified. S1 confirms it at runtime; the full upgrade is optional Phase 13. | Draft: upgrade 26 files to Zod 4 first. | Takes a 26-file migration off the mobile path (pragmatist "unverified assumptions"). Legacy and v1 schemas are separate objects, so mixing is safe [INF]. |
| D13 | **Pin `@orpc/{contract,server,client,openapi,openapi-client,zod}` to exact `1.16.2`.** Verify APIs against the installed `.d.mts`, never orpc.dev (which documents 2.0-beta). | 1.15.7 (dashboard). | Current stable; has `./zod4`. |
| D14 | **RSC pages load data through an in-process oRPC client** (`server/api/_kit/server-caller.ts`, `createRouterClient(v1Router, { context })`, `transport: "in-process"`). Every guard declares its transport policy, so in-process calls skip CSRF, rate limit, client version and activity (F12). | Pages call modules directly. | Page props become the DTOs mobile receives, which removes the client imports of `lib/db/schema` row types. Spike S5. |
| D15 | **Preference cookie actions become client-side cookie writes** (`client/shared/lib/preferences-cookie.ts`, same cookie names, same zod validation, `path=/`). The layout keeps reading `cookies()`. Mobile stores preferences on the device. | Draft: `GET/PATCH /me/preferences` in DB (`User.preferences jsonb`). | The chat POST already carries every setting and reads no cookies (`research-api-surface.md` decision 5), so mobile needs nothing here (F6). It removes migration 0048, the merge semantics, the cookie import (a write on GET, m9) and a behaviour change. The cookies are already non-httpOnly (`actions.ts:19-85`), and `sidebar_state` is already handled this way. Q4. |
| D16 | **Boundaries**: a vitest architecture test (`tests/architecture/boundaries.test.ts`, `ts.preProcessFile`, shrinking allowlist) is the source of truth. It also bans `ResponseValidationPlugin` on clients and checks that every `vi.mock` specifier resolves. Biome `noRestrictedImports` overrides give editor feedback (S8), and `import "server-only"` goes in server entry modules. | dependency-cruiser / Steiger gate. | No new tool. Steiger is beta (optional non-blocking job). |
| D17 | **Safety net = slim characterization + real-DB integration tests for money.** Characterization (mocked) covers only the CloudPayments webhook, the auth actions, chat POST guards/charging and payment intents. The real-Postgres integration suite (its own config, `vitest.integration.config.ts`) starts in Phase 0 for webhook idempotency, refunds and `chargeUsage`; it does not mock module paths, so moves cannot break it. In move PRs a characterization diff may contain **only** import / `vi.mock` specifier lines, enforced by `scripts/check-characterization-diff.ts` (M9/F3). Every other area gets v1 procedure/HTTP tests when it is ported (F4). | Draft: 15-area characterization, "byte-identical" files. | `vi.mock` is hoisted and takes literal specifiers (`node_modules/vitest/dist/index.d.ts:422-423`), so byte-identical files cannot survive moves. Tests written against v1 outlive the legacy code. |
| D18 | **SWR stays**; typed client calls become fetchers. | `@orpc/tanstack-query`. | Less churn, no mobile benefit to switching. |
| D19 | **Uploads multipart for v1 parity** (`POST /api/v1/uploads`). Blob pathnames become user-scoped (`u/<userId>/<uuid>-<name>`). Direct-to-Blob (`@vercel/blob` `handleUpload`, present in 0.24.1) is a later additive endpoint. | Direct-to-Blob now. | Parity first; S4 measures the platform body limit. User-scoped paths enable the SSRF fix (M6). |
| D20 | **Separate v1 spec** at `GET /api/v1/openapi.json`, committed at `server/api/v1/openapi.snapshot.json`. `/openapi.json` (agent discovery) is unchanged. | Merge into `/openapi.json`. | `docs/agent-discovery.md:76-85` keeps session APIs out of the public document (Q3). |
| D21 | **Web chat transport switch behind a Vercel Flag** (`isChatV1TransportEnabled`, `lib/flags.ts` pattern), ramped testers → 10% → 100% (M10). | Revert-by-deploy. | The money path can be rolled back without a deploy. |
| D22 | **Additive-only from first client use.** An endpoint becomes frozen the day any shipped client (web included) calls it, not at mobile GA (m10). `oasdiff breaking` runs in CI from Phase 5 against the `origin/main` snapshot. The hand-written frozen-surface comparer is dropped (F14). | Draft: draft-until-GA + custom comparer + oasdiff later. | Stale web tabs are clients too; one mechanism instead of three. |

---

## Target structure

### Repository root (end state)

```
.github/ .claude/ .cursor/ docs/ scripts/ tests/ public/ content/ assets/ prompt-templates/ types/
app/      Next.js App Router files only
client/   FSD (browser + shared React)
server/   API, domain modules, db, integrations, webhooks, cron
core/     isomorphic, framework-free code
proxy.ts  instrumentation.ts  next.config.ts  package.json  tsconfig.json  vitest.config.ts  biome.jsonc
components.json  drizzle.config.ts  playwright.config.ts  postcss.config.mjs  vercel.json  CLAUDE.md
```
`database.dbml`, `gipiti.drawio.png`, `cloudpayments-documentation.en.md` and `vercel-template.json` move to `docs/` in a pure-move PR after a reference grep (Phase 11).

### Dependency rules (enforced by `tests/architecture/boundaries.test.ts`)

| From \ may import | `app` | `client` | `server` | `core` |
|---|---|---|---|---|
| `app/**` (composition root) | yes | yes | yes | yes |
| `client/**` | no | FSD rule (layer down; no same-layer cross-slice) | only `client/shared/api/contract.ts` may import `@/server/api/v1/contract` (and `v2`) | yes |
| `server/api/**/contract.ts`, `v1/_schemas/**`, `_kit/{common-errors,pagination,open-enum}.ts` | no | no | only each other | yes |
| `server/modules/**` | no | no | not `server/api/**`; no `@orpc/*`, no `next/*` | yes |
| `server/**` (rest) | no | no | yes | yes |
| `core/**` | no | no | no | yes (`zod` only external) |
| legacy `lib/ components/ hooks/ contexts/` | allowlisted edges only; the allowlist may only shrink | | | |

### `server/`

```
server/
  api/
    _kit/                         version-agnostic transport
      context.ts                  InitialContext = { request; resHeaders; transport: "http" | "in-process"; requestId }
      base.ts                     os.$context<InitialContext>() + error interceptor + request log
      errors.ts                   ChatSDKError / domain error -> ORPCError (single table)
      common-errors.ts            ISOMORPHIC ErrorMap fragments (UNAUTHORIZED, NOT_FOUND, INSUFFICIENT_BALANCE, MODEL_UNAVAILABLE,
                                  CLIENT_UPGRADE_REQUIRED, TURN_ALREADY_EXISTS, …)
      pagination.ts               ISOMORPHIC cursor input/output schemas
      open-enum.ts                ISOMORPHIC openEnum(values): z.string() + JSON_SCHEMA_OUTPUT_REGISTRY entry (S1)
      guards/                     plain functions (request, principal, policy) => Response-like error | null
        principal.ts  require-auth.ts  csrf.ts  client-version.ts  rate-limit.ts  activity.ts  transport-policy.ts
      middleware.ts               oRPC middleware wrappers over guards/*
      raw-route.ts                withV1Raw(handler, policy) for raw route handlers (D8)
      create-handler.ts           (router, prefix) -> Next GET/POST/PUT/PATCH/DELETE/HEAD
      server-caller.ts            createRouterClient for RSC (D14)
      openapi.ts                  OpenAPIGenerator factory, bearer securityScheme, raw-route path objects generated
                                  from the same zod schemas (m11)
      __tests__/
    v1/
      contract.ts  router.ts  openapi.snapshot.json
      _schemas/                   chat.ts message.ts (MessagePart union + unknown fallback, M8) money.ts me.ts project.ts
                                  prompt.ts billing.ts subscription.ts payment-intent.ts auth.ts config.ts model.ts
      _mappers/                   domain row -> v1 DTO
      __tests__/                  openapi-snapshot.test.ts  http.test.ts  golden-stream.test.ts
      config/                     GET /config
      models/                     GET /models
      plans/                      GET /plans
      prompts/                    GET /prompts
      auth/                       register login refresh logout logout-all (leaf sub-paths)
        sessions/                 GET /auth/sessions, DELETE /auth/sessions/{sessionId}
        email-verification/       POST send, POST verify
        password/                 POST forgot, reset, change
      me/                         GET /me, POST /me/deletion
        billing/                  GET balance overview spend-history transactions usage-summary payments
        subscription/             GET; POST cancel resume cancellation-feedback
        quizzes/                  GET/PUT /me/quizzes/{quizKey}
        favorite-prompts/         GET; PUT/DELETE /me/favorite-prompts/{promptId}
      chats/                      GET, DELETE (collection)
        [chatId]/                 GET, DELETE; GET votes
          messages/               GET list, DELETE ?fromMessageId=, PUT {messageId}/vote
          turns/                  contract.ts (POST {turnId}/stop) + turn-handler.ts (raw POST SSE)
          stream/                 stream-handler.ts (raw GET SSE resume)
      projects/                   GET, POST
        [projectId]/              GET, PATCH, DELETE
          files/                  GET, POST (multipart), DELETE {fileId}
      uploads/                    POST (multipart)
      payment-intents/            POST (Idempotency-Key), GET {intentId}
    v2/                           only when needed: contract.ts/router.ts spread v1 and override keys (S6)
  modules/                        version-independent domain; no oRPC, no Request/Response
    auth/  users/  activity/  billing/  subscription/  payments/  account-deletion/
    chat/        queries/ delete-trailing-messages.ts to-ui-messages.ts
    chat-turn/   from app/(chat)/api/chat/_lib/** (prepare, enforce-balance, resolve-mode, handlers/, image/, charge, usage, persist,
                 turn-slot, stop-signal, attachment-url-policy.ts)
    ai/          prompts tools/ generate-* docx/pdf/markdown watermark media-upload text-attachments message-validator step-calculator
    projects/  prompts/  quiz/  uploads/  email/  blog/
    <module>/queries/*.ts  <module>/__tests__/  <module>/__integration__/
  db/            schema.ts connection.ts migrate.ts migrations/ utils.ts unique-violation.ts
  integrations/  ai-gateway/ cloudpayments/ resend/ tavily/ recraft/ redis/ blob/
  webhooks/      cloudpayments/ (handler.ts + handlers/)  resend/
  cron/          cron-auth.ts reset-quotas/ cleanup-cancelled/ cleanup-payment-intents/ refresh-fx-rates/
  http/          handle-route-error.ts rate-limit.ts legacy-hit.ts (shared by legacy routes during transition)
  agent-discovery/  (markdown/paths.ts stays edge-safe for proxy.ts)
  flags.ts  env.ts
```
Router keys follow folders in camelCase (`chats.byId.messages.list`) and become `operationId`s.

### `client/` (FSD)

```
client/
  app/        providers/ (chat-providers.tsx, session-provider.tsx), styles/globals.css, analytics/, error-logger.tsx,
              dom-mutation-guard.tsx (CLAUDE.md gotcha 12 — keep), webmcp/
  pages/      landing models-catalog model-landing blog-index blog-post blog-preview legal login register forgot-password
              reset-password verify-email chat projects project-detail prompts balance subscription-manage usage plans not-found
  widgets/    sidebar chat-window message-list composer marketing-shell account-nav auth-layout usage-report billing-cards
  features/   auth chat-composer (send, attach, stop, resume, model/media/web-search/project select) message-actions
              projects prompts billing-actions (top-up, subscribe, cancel, resume) onboarding-quiz claim-reward
  entities/   model chat message project prompt user balance subscription transaction blog-post
  shared/     ui/ (shadcn flat, ai-elements/, icons/, toast, …)  lib/ (cn.ts, download.ts, logger/, url.ts, dom/, hooks/,
              preferences-cookie.ts)  api/ (contract.ts re-export, orpc-client.ts, swr.ts, errors.ts)  config/
```
Slice segments: `ui/ model/ api/ lib/ config/`, plus `index.ts` with named re-exports only. Whether slices have an `index.ts` at all is decided by spike S13 **before** Phase 11a (F9); the fallback is "import from the segment". Features start coarse and split only when a slice gets a second consumer (F10). The file-level mapping is `research-client-fsd.md` §3.3, coarsened as above.

**Nested data-fetching Server Components (F8)**: client slices may not import `server/`. The four DB-querying cards are lifted in **Phase 5d as [B]** with tests: `page.tsx` loads through the server caller and passes DTOs down. Where per-card streaming is wanted, the card's loader stays in `app/**` as a small async server component that wraps `<Suspense>` and the pure client card.

### `app/` (Next routing layer)

```
app/
  layout.tsx error.tsx global-error.tsx not-found.tsx manifest.ts sitemap.ts opengraph-image.tsx icon.png apple-icon.png
  (marketing)/ (legal)/ (auth)/ (chat)/ subscription/     page.tsx = guard + load (server caller) + <XPage {...props}/>
  api/
    v1/[[...rest]]/route.ts                   createHandler(v1Router, "/api/v1"); maxDuration 60
    v1/chats/[chatId]/turns/route.ts          export { POST } from turn-handler; maxDuration 800
    v1/chats/[chatId]/stream/route.ts         export { GET } from stream-handler; maxDuration 800
    v1/uploads/route.ts, v1/projects/[projectId]/files/route.ts   only if S4 forces raw multipart
    auth/[...nextauth]/route.ts               NextAuth (web cookie), URL kept
    webhooks/{cloudpayments,resend}/route.ts  URLs kept; bodies in server/webhooks
    cron/<job>/route.ts                       URLs kept; bodies in server/cron
    health/ log/ agent-markdown/[[...path]]/  kept
    legacy (deleted in Phase 12): chat/ history/ vote/ files/upload/ projects/ prompts/ quiz/ subscription/ transactions/
    usage/ payment/ topup/
  .well-known/…  openapi.json/  robots.txt/   unchanged URLs
```
Route groups' `api` folders (`app/(chat)/api`, `app/(auth)/api`) stay where they are until each legacy route is deleted. URLs never change.

### `core/` (isomorphic)

```
core/
  ai/          models.ts model-capability.ts model-speed.ts entitlements.ts (if the server gates on it)
  billing/     money.ts constants.ts format-billing.ts
  i18n/        dictionary.ts format.ts translate.ts errors.ts messages/ru.json messages/ru.errors.json
  attachments/ attachment-limits.ts     validation/password.ts     quiz/     subscription/ cancellation-reasons.ts subscription-state.ts
  marketing/   landing-content models-catalog model-landings/     blog/ schema frontmatter reading-time
  utm/constants.ts   errors/chat-sdk-error.ts   lib/uuid.ts
```

### Folder-level old → new mapping (each row is one move, in the phase that ports the domain)

| Old | New | Phase |
|---|---|---|
| `lib/db/**` (incl. migrations) | `server/db/**`; `lib/db/query/<d>` → `server/modules/<d>/queries` | 3a (owner runs the migrations `git mv`) |
| `lib/{redis,rate-limit,api/handle-route-error,flags,constants(server part)}.ts` | `server/{integrations/redis,http,flags.ts,env.ts}` | 3a |
| `lib/i18n`, `messages/`, `lib/ai/models.ts`, `lib/billing/{money,constants}`, `lib/errors.ts`, `lib/attachments/attachment-limits`, `lib/validation/password` | `core/*` | 3a (needed by v1 schemas) |
| `app/(auth)/{auth,auth.config}.ts`, `lib/auth/**`, `lib/geo`, `lib/utm/parse-utm-cookie` | `server/modules/auth/**` (`next-auth.ts`, `next-auth.config.ts`); the `[...nextauth]` route re-exports | 4a |
| `lib/email/**` | `server/modules/email`, `server/integrations/resend` | 4a |
| `lib/chat/delete-trailing-messages`, chat queries | `server/modules/chat` | 5a |
| `lib/projects`, upload helpers | `server/modules/{projects,uploads}` | 5b |
| `lib/prompts` (server), `lib/quiz` (server) | `server/modules/{prompts,quiz}`; quiz registry → `core/quiz` | 5c |
| `lib/billing/**`, `lib/subscription/**`, `lib/activity` | `server/modules/{billing,subscription,activity}`; `subscription-tiers.ts` → `server/modules/subscription/seed/` | 5d |
| `lib/payments/**` (server), `app/api/webhooks/cloudpayments/lib/**` | `server/{modules/payments,integrations/cloudpayments,webhooks/cloudpayments}` | 5e |
| `app/(chat)/api/chat/_lib/**`, `lib/ai/**` (server) | `server/modules/{chat-turn,ai}`, `server/integrations/{ai-gateway,recraft,tavily}` | 6a |
| `app/api/cron/*` bodies | `server/cron/*` | 1c (with the cron-auth fix: move PR first, then fix PR) |
| `lib/agent-discovery/**` | `server/agent-discovery/**` | 11 (off-path) |
| `components/ui/*` (shadcn) | `client/shared/ui/*` | 11a |
| `components/**` (rest), `hooks/*`, `contexts/*`, `app/**/_components`, `*-page-client.tsx`, client `lib/*` (`client-logger`, `download`, `url`, `dom`, `media`, `messages`, `chat/input-draft`, `styles-projects`, `payments/cloudpayments-widget`, …) | `client/{shared,entities,features,widgets,pages,app}` | 11b-11f |
| `lib/utils.ts` | split: `client/shared/lib/cn.ts`, `core/lib/uuid.ts`, `server/modules/chat/to-ui-messages.ts` | 5a (behaviour-neutral refactor PR, separate from moves) |
| `lib/types.ts` (`ChatMessage`) | replaced by `v1/_schemas/message.ts` types re-exported via `client/entities/message` | 6c |
| `types/*.d.ts` | stay at `types/` | — |

---

## API design

### Conventions

| Topic | Rule |
|---|---|
| Base URL | `https://gipiti.ru/api/v1` |
| Resources | Plural nouns, ids in the path, `me/` for the current user's sub-resources. Verbs only for non-CRUD actions (`/subscription/cancel`, `/turns/{turnId}/stop`, `/auth/*`, `/me/deletion`). |
| Formats | JSON; ISO-8601 UTC dates; money `{ amountMinor: integer, currencyCode: string }`. A `formatted` string may sit beside the value, never replace it. |
| Inputs | `compact` structure (path params merged with query/body). Query numbers `z.coerce.number()`, booleans `z.stringbool()`. Unknown keys stripped. `selectedChatModel` and file `mediaType` are `string`; unknown **or hidden** models → `MODEL_UNAVAILABLE` with `data.suggestedModelId` (m3; the legacy route keeps its silent swap, `resolve-mode.ts:11-15`). |
| Outputs that may grow | `openEnum()` (`_kit/open-enum.ts`): spec type `string` with known values in `description`; TS type `Known \| (string & {})`. Closed `z.enum` only for inputs and values that can never grow. Error `code` is also an open string (M7). |
| Pagination | Cursor input `{ limit?: 1..100 = 20, cursor?: string }`, output `{ items, nextCursor: string \| null }`; opaque base64url of `(createdAt, id)`. |
| Success status | 200 reads; 201 creates; 202 accepted async work; 204 deletes / idempotent PUTs. |
| Error envelope | `{ defined, code, status, message, data?: { reason?, … } }`. Codes: `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `TURN_ALREADY_EXISTS` 409, `TOO_MANY_REQUESTS` 429 (+`Retry-After`, `data.retryAfterSeconds`), `INSUFFICIENT_BALANCE` 402, `MODEL_UNAVAILABLE` 422, `CLIENT_UPGRADE_REQUIRED` 426, `UPSTREAM_ERROR` 502, `INTERNAL_SERVER_ERROR` 500 (sanitised; logged with `requestId`). Ownership failures → 404, including on raw routes. |
| Auth | `Authorization: Bearer <JWS>` or the NextAuth cookie. `securitySchemes.bearerAuth = { type: http, scheme: bearer, bearerFormat: JWT }`. Cookie-principal non-GET calls pass CSRF: `Origin` host in the allow-list or `Sec-Fetch-Site: same-origin`; `Content-Type: application/json`, except `multipart/form-data` on upload routes only. |
| CORS | None by default. A configured origin allow-list may be added later; never `Access-Control-Allow-Credentials` with a wildcard (m12). HTTP test asserts no ACAO header on a foreign `Origin`. |
| Client headers | Mobile sends `X-Client-Platform: ios\|android` and `X-Client-Version: <semver>` from build 1; the web sends neither. |
| Request id | `X-Request-Id` response header (from `x-vercel-id` when present). |
| Idempotency | `POST /payment-intents` takes an `Idempotency-Key` header (unique per user + key, 30 min) and reuses an open pending intent with the same kind and amount (m8). `POST /turns` with `trigger: "submit"` on an existing message id → 409 `TURN_ALREADY_EXISTS` with `data.streamId` (M4). |
| Mobile retry rule (README) | Network loss during a turn → `GET /chats/{chatId}/stream` (resume), never re-POST. Refreshes are single-flight on the client. |

### Endpoint table (every current route handler and server action)

Legend: **v1** = new endpoint; the legacy URL becomes a thin wrapper with a hit counter until Phase 12. **stays** = URL and shape kept. **web-only** = not part of v1. **deleted** = dead code.

| Current | Disposition | v1 endpoint | Phase |
|---|---|---|---|
| `POST /api/chat` | v1 raw SSE | `POST /api/v1/chats/{chatId}/turns` — today's body minus `id`, plus `trigger: "submit" \| "regenerate"`; file parts limited to the user's Blob uploads (M6) | 6 |
| `DELETE /api/chat?id=` | v1 | `DELETE /api/v1/chats/{chatId}` → 204 / 404 | 5a |
| `GET /api/chat/[id]/stream` | v1 raw SSE | `GET /api/v1/chats/{chatId}/stream` | 6 |
| `POST /api/chat/[id]/stop` | v1 | `POST /api/v1/chats/{chatId}/turns/{turnId}/stop` → 204 | 6 |
| `GET /api/history` | v1 | `GET /api/v1/chats?limit&cursor` | 5a |
| `DELETE /api/history` | v1 | `DELETE /api/v1/chats?confirm=true` → 204 (blob cleanup in `after()`, m14) | 5a |
| `GET /api/vote?chatId=` | v1 | `GET /api/v1/chats/{chatId}/votes` | 5a |
| `PATCH /api/vote` | v1 (validated; message must belong to chat) | `PUT /api/v1/chats/{chatId}/messages/{messageId}/vote` → 204 | 1h, 5a |
| (page read `chat/[id]/page.tsx`) | new | `GET /api/v1/chats/{chatId}`, `GET /api/v1/chats/{chatId}/messages?limit&cursor` (`MessagePart` union, M8) | 5a |
| `deleteTrailingMessages` action | v1 | `DELETE /api/v1/chats/{chatId}/messages?fromMessageId=` → 204 | 5a |
| `POST /api/files/upload` | v1 multipart, user-scoped pathname | `POST /api/v1/uploads` | 5b |
| `GET/POST/PATCH/DELETE /api/projects` | v1 | `GET/POST /api/v1/projects`, `GET/PATCH/DELETE /api/v1/projects/{projectId}` | 5b |
| `GET/POST /api/projects/[id]/files` | v1 | `GET/POST /api/v1/projects/{projectId}/files` | 5b |
| `DELETE /api/projects/[id]/files/[fileId]` | v1 | `DELETE /api/v1/projects/{projectId}/files/{fileId}` → 204 | 5b |
| `GET /api/prompts` | v1 | `GET /api/v1/prompts` (public) + `GET /api/v1/me/favorite-prompts` | 5c |
| `POST/DELETE /api/prompts/favorite` | v1 | `PUT/DELETE /api/v1/me/favorite-prompts/{promptId}` → 204 | 5c |
| `GET/POST /api/quiz/[key]` | v1 (key validated) | `GET/PUT /api/v1/me/quizzes/{quizKey}` | 5c |
| `GET /api/usage` | v1 | `GET /api/v1/me/billing/balance` | 5d |
| `GET /api/transactions` | v1 (split) | `GET /api/v1/me/billing/transactions?limit&cursor`, `GET /api/v1/me/billing/usage-summary` | 5d |
| (page reads `subscription/page.tsx`, `manage/page.tsx`, 4 DB cards) | new | `GET /api/v1/me/billing/overview`, `/me/billing/spend-history`, `/me/billing/payments?limit&cursor` | 5d |
| `GET /api/subscription` | deleted (no caller) | `GET /api/v1/me/subscription` | 1a, 5d |
| `DELETE /api/subscription` | v1 (no local cancel on CloudPayments failure) | `POST /api/v1/me/subscription/cancel` `{ feedback? }` | 1h, 5e |
| `POST /api/subscription/resume` | v1 | `POST /api/v1/me/subscription/resume` | 5e |
| `POST /api/subscription/cancellation-feedback` | v1 | `POST /api/v1/me/subscription/cancellation-feedback` | 5e |
| `POST /api/payment/create-intent` | v1 | `POST /api/v1/payment-intents` `{ kind: "subscription", planCode }` → `{ publicId, accountId, email, amount, currency, description, data, receipt, sessionId, intentId, expiresAt }` | 5e |
| `POST /api/topup/create-intent` | v1 | `POST /api/v1/payment-intents` `{ kind: "topup", amountMinor }` | 5e |
| `GET /api/payment/status?sessionId=` | v1 (no write on GET) | `GET /api/v1/payment-intents/{intentId}` | 1h, 5e |
| `GET /api/me` | deleted (no caller) | `GET /api/v1/me` | 1a, 3b |
| (client import of seed tiers) | new | `GET /api/v1/plans` | 3b |
| (client import of model registry) | new | `GET /api/v1/models` | 3b |
| (flags, bonuses, min client version) | new | `GET /api/v1/config` | 3b |
| `login` action | web → NextAuth `signIn`; mobile v1 | `POST /api/v1/auth/login` | 4, 7 |
| `register` action | v1 | `POST /api/v1/auth/register` | 4, 7 |
| `verifyEmail` action | v1 (authed, user-scoped, capped) | `POST /api/v1/auth/email-verification/verify` | 1f, 4, 7 |
| `resendVerificationCode` action | v1 (authed) | `POST /api/v1/auth/email-verification/send` | 4, 7 |
| `requestPasswordReset` action | v1 | `POST /api/v1/auth/password/forgot` → 202 | 4, 7 |
| `resetPassword` action | v1 (+ `token_version` bump) | `POST /api/v1/auth/password/reset` → 204 | 4, 7 |
| (new) | v1 | `POST /auth/refresh`, `/auth/logout`, `/auth/logout-all`; `GET /auth/sessions`; `DELETE /auth/sessions/{sessionId}`; `POST /auth/password/change` | 4 |
| (new, store requirement) | v1 | `POST /api/v1/me/deletion` → 202 (M12) | 9 |
| 11 `save*AsCookie` actions | web-only, client-side cookie writes (D15) | — | 8 |
| inline `signOut` (`components/sign-out-form.tsx`) | deleted (orphan) | — | 1a |
| `components/usage-limits-widget.tsx` → `/api/usage-limits` (no route) | deleted (orphan) | — | 1a |
| `GET,POST /api/auth/[...nextauth]` | stays (web-only) | — | — |
| `POST /api/log` | stays (web-only) | — | — |
| `POST /api/webhooks/cloudpayments` | stays (length-checked `timingSafeEqual`; `?type=` routing untouched) | — | 1d |
| `POST /api/webhooks/resend` | stays (rejects when secret unset) | — | 1d |
| `GET /api/cron/{reset-quotas,cleanup-cancelled,refresh-fx-rates,cleanup-payment-intents}` | stays (rejects when `CRON_SECRET` unset; schedule cleanup) | — | 1c |
| `GET /api/health` | stays (redacted; reports limiter presence) | — | 1e |
| `/openapi.json`, `/.well-known/{api-catalog,agent-skills/**,vercel/flags}`, `/robots.txt`, `/api/agent-markdown/[[...path]]` | stays | `GET /api/v1/openapi.json` added separately | 3b |

---

## Auth design

### Token model

| Item | Value |
|---|---|
| Access token | JWS HS256 via `jose` (direct dependency, exact version = the transitive `6.2.17`), header `kid`, 15 min, claims `sub`, `sid`, `ver`, `iss`="gipiti", `aud`="gipiti-api", `iat`, `exp`. Secrets `API_TOKEN_SECRET` (current) and `API_TOKEN_SECRET_PREVIOUS` (optional; verify only), so the key can rotate without logging users out (m13). Never `AUTH_SECRET`. No entitlement claims. |
| Refresh token | 32 random bytes base64url, stored SHA-256 (reuse `hashToken`, `lib/auth/reset-token.ts`), rotated on every refresh; 60-day sliding, 180-day absolute (Q7). |
| Parallel refresh (M3) | Within 30 s of a rotation, presenting the just-rotated token mints a **sibling** pair in the same session (at most 2 siblings per rotation). No plaintext is stored. After 30 s, presenting a used token = reuse → revoke the session (`revoked_reason='refresh_reused'`). The client must refresh single-flight (README). |
| Per-request check (bearer) | Verify JWS → load `AuthSession` by `sid` + `User.token_version` → reject if revoked, expired or `ver` differs. No TTL cache (m6). `last_used_at` written at most every 5 min. |
| Cookie path (M2, F13) | The NextAuth `jwt` callback reads the user's `token_version` on every `auth()` and returns `null` on mismatch, which clears the cookie (`session.js:53-55`). A missing `ver` claim on existing cookies counts as `0`, so no current user is logged out. The read goes through `server/modules/auth/token-version.ts`: Redis `GET tv:<userId>` with explicit `DEL` on every bump (write-through), DB fallback when Redis is absent. This is an extra lookup per authenticated web request; measure p95 in Phase 4 (Verification). |
| Principal | `type Principal = { userId: string; sessionId: string \| null; via: "bearer" \| "cookie" \| "in-process" }`. Entitlements are read from the DB where needed. |
| Resolution | `Authorization` header present → bearer only (invalid → 401, never fall back to cookie). Otherwise `auth()` (cookie). |
| NextAuth changes | `jwt` adds `ver` and checks it. The client-controlled `update` overrides (`auth.ts:115-126`) and all `console.log`s go (Phase 1b). `authorize` calls `authenticateCredentials()` and gets the IP from its `request` argument (`@auth/core@0.41.3 providers/credentials.d.ts:45,53`). |
| Flags | `server/flags.ts` `identify` accepts an explicit principal for API calls (S7). |

### DB changes (hand-written; `pnpm db:generate` is broken)

| Migration | Content | Phase |
|---|---|---|
| `0046_email_verification_attempts.sql` | `User.email_verification_attempts integer NOT NULL DEFAULT 0` | 1f |
| `0047_auth_sessions.sql` | `User.token_version integer NOT NULL DEFAULT 0`; `AuthSession` (id uuid pk, user_id fk cascade, client_kind, device_name, platform, app_version, created_ip, created_at, last_used_at, absolute_expires_at, revoked_at, revoked_reason; partial index on user_id where revoked_at is null); `RefreshToken` (id, session_id fk cascade, token_hash varchar(64) unique, parent_id, created_at, expires_at, used_at) — DDL per `research-auth.md` §2, plus `parent_id` for siblings | 4c |
| `0048_account_deletion.sql` | `User.deleted_at timestamptz NULL`, `User.deletion_requested_at timestamptz NULL` | 9 |

Every migration gets its `meta/_journal.json` entry and schema types in the same PR. Rule: **a migration file is never edited after its PR has had a preview build** (M11). The `cleanup-payment-intents` cron also deletes refresh tokens expired more than 7 days ago.

### Endpoints

| Method + path | Auth | Request | 2xx | Errors (`code` / `data.reason`) |
|---|---|---|---|---|
| `POST /auth/register` | none | `{ email, password, language?, utm?, client: { platform, deviceName?, appVersion? } }` | 201 `{ user: Me, tokens: TokenPair \| null }` (null for web) | `FORBIDDEN/signup_disabled`, `CONFLICT/email_taken` (Q6), `BAD_REQUEST/{invalid_input,disposable_email}`, `TOO_MANY_REQUESTS` |
| `POST /auth/login` | none | `{ email, password, client }` | 200 `{ user, tokens }` | `UNAUTHORIZED/invalid_credentials` (dummy compare kept), `TOO_MANY_REQUESTS` |
| `POST /auth/refresh` | refresh token | `{ refreshToken }` | 200 `{ tokens }` | `UNAUTHORIZED/{refresh_invalid,refresh_expired,session_revoked,refresh_reused}` |
| `POST /auth/logout` | bearer | `{}` | 204 | idempotent |
| `POST /auth/logout-all` | bearer or cookie | `{}` | 204 | revokes all sessions and bumps `token_version`; a cookie caller is signed out too (documented, m7) |
| `GET /auth/sessions`, `DELETE /auth/sessions/{sessionId}` | bearer or cookie | — | 200 / 204 | `NOT_FOUND`. Lists mobile sessions only; web cookies are revoked only as a group (m7) |
| `POST /auth/email-verification/send` | bearer or cookie | `{}` | 202 `{ cooldownSeconds }` | `CONFLICT/already_verified`, `TOO_MANY_REQUESTS` (per user + per IP; email from principal only) |
| `POST /auth/email-verification/verify` | bearer or cookie | `{ code: /^\d{6}$/ }` | 200 `{ emailVerified, bonusGranted }` | `BAD_REQUEST/{invalid_code (data.attemptsLeft),expired_code}`, `TOO_MANY_REQUESTS/too_many_attempts`, `CONFLICT/already_verified` |
| `POST /auth/password/forgot` | none | `{ email }` | 202 always | `TOO_MANY_REQUESTS` |
| `POST /auth/password/reset` | none | `{ token, password }` | 204 (revokes sessions, bumps `token_version`) | `BAD_REQUEST/{invalid_token,weak_password}` |
| `POST /auth/password/change` | bearer or cookie | `{ currentPassword, newPassword, revokeOtherSessions? }` | 204; with revoke, a cookie caller gets a fresh NextAuth session (re-`signIn`), a bearer caller a new pair | `UNAUTHORIZED/invalid_credentials`, `BAD_REQUEST/weak_password` |
| `GET /me` | bearer or cookie | — | `{ id, email, emailVerified, isTester, hasActiveSubscription, balance }` (DB-fresh) | `UNAUTHORIZED` |
| `POST /me/deletion` | bearer or cookie | `{ password }` | 202 `{ scheduledAt }` | `UNAUTHORIZED/invalid_credentials` |

### How the web keeps working

1. Nothing changes for the web until Phase 7. Server actions call the same `server/modules/auth` services from Phase 4.
2. v1 procedures accept the cookie principal as each endpoint lands.
3. In Phase 7, login goes through `signIn("credentials", { redirect: false })`; register goes through v1 and then `signIn`; verify, resend, forgot and reset go through v1; `useSession().update()` sends no payload.
4. Payments take `accountId` and `email` from the payment-intent response (Phase 5e).

### Security considerations

| Risk | Mitigation |
|---|---|
| CSRF on cookie v1 mutations, including raw routes | Shared `guards/csrf.ts` used by the oRPC middleware **and** `withV1Raw` (M1). HTTP tests on the turn, stream, upload and one oRPC mutation. |
| Revoked cookies still served by legacy `auth()` sites | `ver` check inside the NextAuth `jwt` callback (M2). Test: bump the version → legacy route 401 and page redirect. |
| Bearer/cookie confusion | Bearer header wins; tested. |
| Token theft | 15-min access, rotation, reuse detection, session listing and revocation, `logout-all`. |
| Limiters silently absent (no Upstash REST) | `server/http/rate-limit.ts` reports `isConfigured`. `/api/health` shows `checks.rateLimiting.enabled: false` (the field that shipped in PR #265; an earlier version of this line named it `rateLimiter: "missing"`). In production the auth endpoints (login, register, verify, send, forgot) **fail closed** with 503 when the limiter is missing or erroring (M5, Q8). Owner check in Phase 0 that Production has Upstash REST. |
| Login lockout of a victim | Limit on (email, IP) 10/15 min; per-IP 60/15 min with IPv6 keyed by /64; per-email ceiling 50/h as progressive delay, not a block (m2). |
| Grant farming via scripted register | (email, IP) and /64 limits, a disposable-domain blocklist (`core/validation/disposable-domains.ts`), welcome grant deferred until email verification for `client.platform ∈ {ios, android}` (Q5), and a "grants per hour" query in `admin-dashboard` (read-only) checked weekly during the beta. Device attestation is a later step. |
| Mail abuse via `email-verification/send` | Requires a principal; sends only to the principal's own email; per-user and per-IP limits. |
| Verification-code brute force | Phase 1f: lookup scoped to the user, 5 attempts per code, then the code is invalidated. |
| SSRF / memory exhaustion via file-part URLs (M6) | Phase 1: `attachment-url-policy.ts` allows only the Blob store host, with a 10 MiB / 10 s fetch cap, for legacy and v1 alike. v1: a URL must also have the `u/<principal.userId>/` prefix, or appear in that chat's stored messages (edit/regenerate of older uploads). Test: a foreign URL gets 400. |
| Enumeration | Dummy compare; forgot and send always 2xx; `email_taken` per Q6. |
| Secret rotation | `kid` + previous secret (m13). |
| PII in logs | Session `console.log`s removed (1b); the interceptor logs `userId`, path and `requestId`, never bodies. |
| Preview builds migrating production (M11) | Resolved without code: every preview deployment gets its own Neon branch (`preview/<git-branch>`, parented from `main`) through the Neon integration, and the build migrates that branch. No `migrate.ts` guard is added; a guard keyed on `VERCEL_ENV=preview` would block the migrations those branches need. The rule "never edit a migration after its PR has had a preview build" stays. |

---

## Versioning policy

1. **Mechanism**: URL major version (`/api/v1`, `/api/v2`), one catch-all and one OpenAPI document per version. Contract paths are relative; the prefix comes from the handler.
2. **Stability**: an endpoint is **frozen** (additive-only) from the first deploy in which any client calls it, the web included (D22). An endpoint no client calls yet may change; the PR must carry the label `api-unreleased-change`, which lets the `api-breaking` CI job pass.
3. **Breaking (forbidden when frozen)**: removing or renaming an endpoint, method, field, query param or header; changing a type, unit, format or meaning; making an input required or tightening validation; removing an input enum value; removing an output field or making it nullable; changing a success status, an error's status, auth requirements, default ordering or page size; **renaming a tool or AI SDK message/data part, or changing a part's required fields** (M8).
4. **Additive (allowed)**: new endpoints, optional inputs, widened validation, new output fields, new `openEnum` values, new error codes, new message-part types (clients render unknown parts as the `unknown` fallback).
5. **Stream protocol**: v1 turns/resume are pinned to AI SDK UI-message stream `v1` (`x-vercel-ai-ui-message-stream: v1`, per the risk critique, `ai/dist/index.mjs:4706`). `golden-stream.test.ts` (`MockLanguageModelV3`) snapshots the SSE part types and shapes of a text, a tool and a data-part turn. An AI SDK major upgrade that changes the snapshot needs an adapter in `turn-handler.ts` or a v2 endpoint.
6. **v2**: `server/api/v2/` holds only changed resources; contract and router spread v1 and override keys (S6). At most two live versions.
7. **Deprecation**: `Route.deprecated: true` plus `Deprecation` / `Sunset` headers. `_kit/deprecation.ts` is built with the first deprecation (F14); header formats are verified against RFC 9745 / RFC 8594 then (S12).
8. **Forced upgrade** (before the first store submission): `GET /api/v1/config` returns `{ clients: { ios: { minSupportedVersion, latestVersion, updateUrl }, android: {…} }, features, bonuses, topupMinimums }`. `guards/client-version.ts` returns 426 `CLIENT_UPGRADE_REQUIRED` with `data.updateUrl` (web and in-process calls are exempt). Values come from Vercel Flags.
9. **Retirement**: a version is removed only when `minSupportedVersion` excludes every build that uses it and there has been no traffic for 30 days (DB counter, F15).
10. **Enforcement**: `pnpm api:spec` regenerates the sorted snapshot; `openapi-snapshot.test.ts` (in `pnpm check`) fails on drift; `golden-stream.test.ts` (in `pnpm check`); CI job `api-breaking` runs `oasdiff breaking` on the `origin/main` snapshot vs the PR snapshot from Phase 5 (S11). Native-client tolerance of `openEnum` is checked once in S14.

---

## Server actions migration

| Action | Endpoint | Web caller afterwards | Phase (wrapper → delete) |
|---|---|---|---|
| `login` | NextAuth `/api/auth/callback/credentials` (web); `POST /api/v1/auth/login` (mobile) | `client/features/auth`: `signIn("credentials", { redirect: false })` | 7 → 12 |
| `register` | `POST /api/v1/auth/register` | `features/auth`: `api.auth.register(…)` then `signIn` | 7 → 12 |
| `verifyEmail` | `POST /api/v1/auth/email-verification/verify` | `pages/verify-email` | 7 → 12 |
| `resendVerificationCode` | `POST /api/v1/auth/email-verification/send` | `features/auth`, `features/claim-reward` | 7 → 12 |
| `requestPasswordReset` | `POST /api/v1/auth/password/forgot` | `pages/forgot-password` | 7 → 12 |
| `resetPassword` | `POST /api/v1/auth/password/reset` | `pages/reset-password` | 7 → 12 |
| 11 `save*AsCookie` (`saveChatModelAsCookie`, `saveThinkingSettingAsCookie`, `saveImage{Quality,Aspect,Style}AsCookie`, `saveVideo{Aspect,Duration,Resolution,Mode}AsCookie`, `saveWebSearchEnabledAsCookie`, `saveProjectAsCookie`) | none (web-only device preferences, D15) | `client/shared/lib/preferences-cookie.ts` (`setPreferenceCookie(name, value)` with the same names, prefixes from `core/ai/models.ts`, zod-validated values, `path=/; max-age=1y; SameSite=Lax`) | 8 → 12 |
| `deleteTrailingMessages` | `DELETE /api/v1/chats/{chatId}/messages?fromMessageId=` | `features/message-actions` (edit) | 5a → 12 |
| `sign-out-form.tsx` inline action | — (orphan) | — | deleted in 1a |

**Stale-tab handling (m1)**: Next rotates action ids per build and drops unused actions, so a stale tab may never reach a wrapper. The web therefore (a) catches the "failed to find server action" error in the error logger and shows a reload toast (i18n key `errors.staleClient`), and (b) relies on Skew Protection (Q9). Phase 12 is gated on two things: the error rate of that message in `/api/log`, and the wrapper counters. Wrappers and legacy routes increment a DB counter (`server/http/legacy-hit.ts`: `INSERT … ON CONFLICT DO UPDATE` on `(name, day)`, or Redis `INCR legacy:<name>:<yyyy-mm-dd>` when present) instead of relying on log retention (F15). The window is **14 calendar days after the web-switch PR is deployed to production**.

---

## Testing strategy

### Layers

| Layer | Tool / location | In `pnpm check`? | What it proves |
|---|---|---|---|
| Static | `tsc`, Biome (+ boundary overrides), `tests/architecture/boundaries.test.ts` (allowlist only shrinks; bans `ResponseValidationPlugin`; every `vi.mock` specifier resolves), `server-only` | yes | Layer and client/server rules; mocks still bind after moves |
| Characterization (slim) | `tests/characterization/{cloudpayments-webhook,auth-actions,auth-authorize,chat-post,payment-intents}.test.ts` + `targets/*.ts` (one re-export module per area) | yes | Money and security behaviour preserved; diff guard `scripts/check-characterization-diff.ts` in CI |
| Domain unit | `server/modules/**/__tests__/*.test.ts` (`vi.mock("@/…")` style) | yes | Billing, tokens, rotation, policies, mappers |
| Procedure | `server/api/v1/**/__tests__/*.test.ts` via `call(procedure, input, { context })` / `createRouterClient` (`@orpc/server`, `index.d.mts:787,797` in 1.15.7; re-check in 1.16.2) | yes | Auth required, 404 ownership, validation, every declared error |
| HTTP contract | `server/api/_kit/__tests__/http.test.ts`, `v1/__tests__/http.test.ts`: call route-module exports with `new Request(…)` | yes | Bearer/cookie/none, status codes, envelope, CSRF, CORS absence, 426, 404 JSON for unknown path, raw-route guards |
| Spec + stream | `openapi-snapshot.test.ts`, `golden-stream.test.ts` | yes | Contract and stream changes are visible |
| Integration (real Postgres) | separate config `vitest.integration.config.ts` (so `vitest run` and `pnpm check` never start a DB test), `**/__integration__/**/*.test.ts`, `TEST_POSTGRES_URL` (refuses non-local hosts and database names not ending in `_test`), migrator in `globalSetup`, `fileParallelism: false` | no (`pnpm test:integration`; CI job) | Webhook idempotency, refunds, `chargeUsage` locking, refresh rotation/siblings/reuse under concurrency, account deletion, migrations apply |
| Component | `*.test.tsx`, `// @vitest-environment jsdom`, `@testing-library/react` (versions verified at install) | yes | Composer submit/stop, auth forms, top-up stages against a mocked oRPC client |
| E2E UI | Playwright `tests/e2e` | CI | Web flows on v1 |
| E2E API | Playwright `tests/routes/*.test.ts` (project exists, `playwright.config.ts:65`) | CI | Mobile simulation: register → verify → login → me → refresh → reuse rejected → logout; turn + resume with bearer and the test model (Q10) |
| Build assertion | `scripts/check.ts` after `next build`: `.next/server/app/api/v1/chats/[chatId]/turns/route.js.nft.json` lists the 4 Roboto fonts and `icon-256.png` (F5) | yes (build step) | Tracing includes actually apply |

### What is written when

| Phase | Tests added |
|---|---|
| 0 | Slim characterization (5 files); integration suite + `cloudpayments-webhook.integration.test.ts` (pay/top-up idempotency, refund pool) + `charge-usage.integration.test.ts`; architecture test with today's allowlist; diff guard script |
| 1 | Unit per fix; characterization updated only where a fix intentionally changes pinned behaviour (stated in the PR body) |
| 3 | `_kit` guard unit tests (per-transport table), HTTP tests, error-mapping table test, procedure tests for config/models/plans/me, snapshot |
| 4 | Token/rotation/sibling/principal/`jwt`-callback unit tests; procedure tests per auth endpoint; integration: N=5 parallel refreshes, reuse → family revoked, `logout-all` → legacy route 401; Playwright `tests/routes/auth-flow.test.ts` |
| 5a-e | Per resource: procedure tests (happy, 401, foreign 404, validation, each error) + one HTTP test; 5d data-lift tests; 5e `Idempotency-Key` integration test; web-switch PRs: existing E2E + component tests where touched |
| 6 | Raw-route HTTP tests (bearer, cookie, none, CSRF, 426, foreign → 404, quota 402, `TURN_ALREADY_EXISTS`, foreign file URL 400, resume 204 without Redis); client-abort-still-charges test; golden stream; nft build assertion; Playwright API turn + resume |
| 7 | Component tests for auth forms; Playwright register/verify spec; `login.test.ts` unchanged |
| 8 | Unit test for `preferences-cookie.ts` (names, validation, path); Playwright chat-input: model persists after reload |
| 9 | Integration: deletion cancels the subscription (CloudPayments mocked at the integration boundary), anonymizes the user, keeps `Transaction` rows, revokes sessions |
| 11 | Allowlist shrinks every PR; S13 bundle comparison |
| 12 | Delete characterization tests together with the legacy code they pin (same commit) |

### Coverage expectations

- Add `@vitest/coverage-v8` (version matching vitest 4.1.x, verified at install) in Phase 0; the CI unit job runs `vitest run --coverage`, not `pnpm check`.
- Per-folder thresholds, enforced as each folder comes to exist: `server/modules/{auth,billing,payments,subscription,account-deletion}` ≥ 90% lines / 85% branches; `server/api/**` ≥ 80% lines; `server/modules/chat-turn` must not drop below its level at the Phase 6a move. No global threshold.
- Every declared error code of every procedure has at least one test (PR checklist).

### CI gates (`.github/workflows/`)

| Job | Content | Added in |
|---|---|---|
| `check-fast` | `pnpm check:fast` (CI has no typecheck today) | 0 |
| `unit` | + coverage thresholds | 0 |
| `characterization-diff` | `scripts/check-characterization-diff.ts origin/main...HEAD` | 0 |
| `integration` | postgres:16 service (copied from the Playwright job), `pnpm test:integration` | 0 |
| `playwright` | pnpm/Node aligned; `routes` project specs | 0, 4 |
| `api-breaking` | `oasdiff breaking` on the `origin/main` vs PR snapshot; bypass label `api-unreleased-change` | 5 |
| `steiger` (optional, non-blocking) | `npx steiger ./client` | 11 |

---

## Order of work

Legend: **[R]** pure move (`git mv` + scripted specifier rewrite `scripts/codemods/rewrite-imports.ts`, no logic edits); **[B]** behaviour change; **[M]** on the mobile path. Every PR is green on `pnpm check`. [R] and [B] are never in the same PR. Diffs use `origin/main...HEAD` (F16). Effort figures are rough [INF] solo-developer estimates.

**Mobile path**: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 9 → 10. **Minimum mobile beta (internal TestFlight)** = Phases 0-6 + 10 (about 7-9 weeks [INF]). **Store submission** additionally needs Phase 9. **Pure restructuring, off the mobile path**: 11 (FSD) and 13 (optional `src/` wrap). **Web-only cleanup**: 7, 8, 12. Phase 11 may run in parallel with 5-10, never in the same PR as them.

### Phase 0 — Safety net, slim [B: tests/tooling] (3-4 days)
- **Owner preconditions** (before Phase 1 merges): confirm Preview `POSTGRES_URL` is a separate Neon branch (M11); `CRON_SECRET` and `RESEND_WEBHOOK_SECRET` exist in Production (`vercel env ls`, m5); Production Redis is Upstash REST (`KV_REST_API_*` or an https `REDIS_URL`, M5); Skew Protection status (Q9); merge or park `feat/gipiti-28-mcp-integrations-cw6f0r` before Phase 3a; prune `.claude/worktrees/*` and the sibling worktrees `app-pr248` and `app-wt-activity`.
- **Precondition status (checked 2026-11-15 with `vercel env ls` and `GET https://gipiti.ru/api/health`)**: `CRON_SECRET` and `RESEND_WEBHOOK_SECRET` exist in Production and Preview. Production has `KV_REST_API_*` and reports `rateLimiting.enabled: true`. Preview database: met. The Neon integration creates a `preview/<git-branch>` database branch per preview deployment and injects its connection variables at deploy time; these overrides are not stored in the project settings, so `vercel env ls` shows only the shared project-level `POSTGRES_URL` and cannot be used to check this (corrected 2026-11-16 after the owner showed the branch list in the Neon console; an earlier version of this line wrongly reported the precondition as not met). Not checked yet: Skew Protection, the `feat/gipiti-28-mcp-integrations-cw6f0r` branch, stale worktrees.
- **Status: done (2026-11-16).** Merged as PRs #267 (0a), #268 (0b), #269 (0c), #270 (0d), #271 (0e); plan and deviations in `docs/plans/2026-11-16-phase-0-safety-net-for-the-orpc-v1-migration.md`. The Playwright flake in the login tests (two `#email-display` elements) that Phase 0 left open was an application defect, fixed in PR #274 (GIPITI-229).
- **PRs**: (0a) `vitest.config.ts` `exclude` (`**/node_modules/**`, `.claude/**`, `**/.next/**`); `tsconfig.json` exclude `.claude`; the 7 relative `vi.mock` paths → `@/`; `lib/marketing/__tests__/model-landings.test.ts:19` → `process.cwd()`. (0b) CI `check-fast`, `@vitest/coverage-v8`, align Playwright workflow. (0c) Slim characterization + `targets.ts` + diff guard. (0d) Integration project + 2 money integration tests + CI job. (0e) Architecture test with allowlist + `vi.mock`-resolves check.
- **Tests**: as listed. **Verify**: `pnpm check`; `pnpm vitest run tests/characterization tests/architecture`; `pnpm test:integration` locally (local Postgres container); CI green.
- **Rollback**: revert (no runtime effect).

### Phase 1 — Security and money fixes [B, M] (4-5 days, one small PR each)
- **Status after PR #265 (merged 2026-11-15)**: done: (1b), (1d), (1j, which also covers `fetchImageBytes` in `app/(chat)/api/chat/_lib/image/providers.ts`; the helper landed as `lib/attachments/attachment-fetch-policy.ts`). Partly done: (1c) has the auth helper `lib/cron/is-authorized-cron-request.ts` (unset secret ⇒ 401, constant-time compare), still open are the move to `server/cron/*` and the `cleanup-payment-intents` schedule; (1e) has `rateLimiting.enabled` on `/api/health` and a one-time warning, still open are the health redaction and fail-closed auth limiters (Q8). New item (1l): `lib/ai/docx-images.ts` and `lib/ai/pdf-images.ts` fetch model-written image URLs from any host and need their own fetch policy.
- **Status: done (2026-11-17).** Merged as PRs #276 (1a), #277 (1n), #278 (1h-b), #279 (1e), #281 (1f), #282 (1h-a), #283 (1k), #284 (1g), #285 (1c), #286 (1l), #287 (1o), #288 (1h-c). The cleanup cron ran in production on 2026-11-17 11:15 UTC. Deviations from the list below are in the plan's implementation notes. Left for the owner: the checks on a live environment listed there.
- **Plan (2026-11-16)**: `docs/plans/2026-11-16-phase-1-security-and-money-fixes-before-the-orpc-v.md` (GIPITI-230). It records where the work departs from the list below: the cron move to `server/cron/*` waits for Phase 3; an unset `CRON_SECRET` keeps answering 401; the cleanup cron keeps succeeded intents; health keeps `checks.rateLimiting.enabled`.
- (1a) Delete orphans: `components/sign-out-form.tsx`, `components/usage-limits-widget.tsx`, `lib/subscription/use-cancel-subscription.ts`, `app/api/me`, `GET` of `app/(chat)/api/subscription`, the dead `/api/*` branch in `proxy.ts:87-94`, and other orphans from `research-client-fsd.md` §2.6 after a string grep.
- (1b) `auth.ts`: remove the `update` overrides and the `console.log`s.
- (1c) Schedule `cleanup-payment-intents` hourly in `vercel.json` (Q11), after limiting its delete to `expired` and `failed` intents: today it deletes every intent older than 30 days, and the refund webhook needs the succeeded ones. The auth half is done (`lib/cron/is-authorized-cron-request.ts`; an unset secret answers 401, not the 500 first written here). The [R] move of the cron bodies to `server/cron/*` waits for Phase 3.
- (1d) Resend webhook rejects when its secret is unset; CloudPayments HMAC: decode both, length check, then `timingSafeEqual`; keep the `{code:13}` path; test with a short signature (m4).
- (1e) `/api/health` redaction + `rateLimiter` presence; limiter `isConfigured` + fail-closed for auth flows in production (Q8).
- (1f) Migration `0046` + user-scoped verification lookup + 5-attempt cap.
- (1g) Rate limits on login (`authorize`, keyed per m2) and register; disposable-domain blocklist.
- (1h) `PATCH /api/vote` zod + message-in-chat check; `DELETE /api/subscription` returns 502 without a local cancel when CloudPayments throws; `GET /api/payment/status` stops writing (**depends on 1c being deployed**).
- (1i) Dropped (2026-11-16): the `migrate.ts` preview guard is not needed, because preview deployments already run against their own Neon branch (M11).
- (1j) `attachment-url-policy.ts`: Blob host allow-list + fetch caps, used by `text-attachments.ts` and `docx-extract.ts` (M6, legacy too).
- (1k) Welcome grant in the same DB transaction as the user insert (own PR, own test; F17).
- (1m) Done in PR #273 (GIPITI-228). Connection-pool deadlock in billing (found in Phase 0d): `chargeUsage` looked the rate up through the global `db` inside its transaction, so each charge needed two of the 10 pool connections and ten simultaneous charges in one process never finished. The lookups now take the transaction as their executor; `charge-usage.integration.test.ts` runs more concurrent charges than the pool has connections.
- (1n) Open redirect after login (found in GIPITI-229): `getRedirectPath` in `app/(auth)/login/login-page-client.tsx` returns any `callbackUrl` that starts with `/`, so `//host/path` and `/\host` leave the site. Fix: one helper that parses the value and accepts only the same origin.
- (1o) `/register`, `/forgot-password` and `/reset-password` keep the `<Suspense>` boundary that streamed a hidden second copy of the login form (GIPITI-229). Remove it; `/reset-password` reads `token` on the server.
- **Verify**: `pnpm check`; `pnpm exec playwright test tests/e2e/login.test.ts`; on a preview, a CloudPayments test-mode payment and a cron call with and without the secret.
- **Rollback**: revert the single PR; `0046` is additive.

### Phase 2 — Dependencies and spikes [B: deps, M] (2-3 days)
- **PR 2a**: add `@orpc/{contract,server,client,openapi,openapi-client,zod}@1.16.2` (exact) and `jose@6.2.17` (exact).
- **Spikes** (throwaway branches; findings written into the Phase 3 plan file):

| Id | Question | Done when |
|---|---|---|
| S1 | `OpenAPIHandler` (`@orpc/openapi/fetch`) error body encoding; `OpenAPIGenerator` options (converters, OpenAPI version); `@orpc/zod/zod4` with `zod/v4` from `zod@3.25.76`; `openEnum` via `JSON_SCHEMA_OUTPUT_REGISTRY` | spec for 2 procedures + captured 401 body; an `openEnum` field emits `type: string` |
| S2 | `OpenAPILink` 1.16.2 constructor; browser bundle cost of the contract | a client component calls a sample procedure; size recorded |
| S3 | Precedence: catch-all + `turns/route.ts` + `stream/route.ts`; `/turns/{id}/stop` reaches the catch-all; other methods on raw paths; unknown path → 404 JSON | `next build && next start` matrix recorded; fallback stop path `POST /chats/{chatId}/stop` |
| S4 | oRPC `File` input via `OpenAPIHandler`; 6 MB and 10 MB uploads on a preview | decide oRPC vs raw multipart |
| S5 | `auth()` in an oRPC handler and in RSC via `createRouterClient`; `signIn("credentials")` from `next-auth/react` | cookie principal in both; login works |
| S6 | v2 spread-override typechecks | sample compiles |
| S7 | flags `identify` with an explicit principal; behaviour when `getToken` meets our JWS (must return null, not throw) | flag evaluates for a bearer user |
| S8 | Biome `noRestrictedImports` `patterns.group` semantics in `overrides` | sample rules fire |
| S9 | `client/pages` and `client/app` not picked up by Next | build of a stub `client/pages/x.tsx` produces no route |
| S10 | AI SDK `DefaultChatTransport` in Node with a bearer header against the raw turn route | in-phase in 6 (Playwright API test) |
| S11 | `oasdiff breaking` on the generated version (3.1 support, fail flag) | in-phase in 5: CI fails on a deliberate break |
| S12 | RFC 9745 / 8594 header formats | when the first deprecation happens |
| S13 | Turbopack tree-shaking of slice `index.ts` barrels | before 11a: one slice measured |
| S14 | A generated Swift or Kotlin client decodes an unknown `openEnum` value | in-phase in 3b: one manual run of `openapi-generator` (or `swift-openapi-generator`), result recorded |
| S15 | Edit-message flow: which `trigger` and message id it re-sends | in-phase in 6b |

- **Verify**: `pnpm check`; preview build. **Rollback**: revert 2a.

### Phase 3 — Server foundation [R then B, M] (3-4 days)
- **3a [R]** (owner runs `git mv lib/db/migrations server/db/migrations`; the protect hook blocks agents): `lib/db` → `server/db`; queries → `server/modules/*/queries`; `lib/{redis,rate-limit,api/handle-route-error,flags}` → `server/*`; core isomorphic files → `core/*` (mapping table). Same PR: `drizzle.config.ts:4-5`, `server/db/migrate.ts` folder path, `package.json:7` (`tsx server/db/migrate`), `scripts/hooks/protected-paths.mjs:32` + its test, `tests/global-setup.ts:7`, `scripts/*.ts`, `CLAUDE.md`, `.claude/agents/review.md`, `.claude/skills/*`, `.cursor/rules/*`, the owner's memory notes that name paths, `targets.ts`.
- **3b [B]** `server/api/_kit/*` (no `deprecation.ts` yet), `app/api/v1/[[...rest]]/route.ts`, `GET /config`, `/models`, `/plans` (DB catalog), `/me`, `GET /api/v1/openapi.json`, `pnpm api:spec`, snapshot test, `docs/agent-discovery.md` note. S14 run.
- **Tests**: 3a none new (characterization diff guard + integration tests green); 3b per the table.
- **Verify**: 3a `pnpm check`, preview deploy log shows migrations ran from `server/db/migrations` (against the preview's own Neon branch, M11), `pnpm test:integration`; 3b `pnpm vitest run server/api`, `curl https://<preview>/api/v1/config` and `/api/v1/does-not-exist` (404 JSON), `pnpm api:spec && git diff --exit-code server/api/v1/openapi.snapshot.json`.
- **Rollback**: 3a revert the single commit; if a production deploy fails after merge, `vercel rollback` to the previous deployment. Migration state is unchanged because 3a adds no migration. 3b: delete the catch-all.

### Phase 4 — Auth v1 [R then B, M] (6-8 days)
- **4a [R]**: `app/(auth)/{auth,auth.config}.ts`, `lib/auth`, `lib/geo`, `lib/email` → `server/modules/{auth,email}`, `server/integrations/resend`; the `[...nextauth]` route re-exports.
- **4b [B]**: auth services (`authenticateCredentials`, `registerUser`, `issueTokenPair`, `rotateRefreshToken`, `revokeSession`, `verifyEmailCode`, `sendVerificationCode`, `requestPasswordReset`, `resetPassword`, `changePassword`); actions and `authorize` call them (web behaviour unchanged).
- **4c [B]**: migration `0047`; `token-version.ts`; `jwt` callback `ver` check (M2).
- **4d [B]**: bearer path in `guards/principal.ts`; `/api/v1/auth/*`; `flags.ts` identify; `API_TOKEN_SECRET(_PREVIOUS)` in `.env.example` and the `scripts/check.ts` placeholder; owner sets the Vercel env.
- **4e [B]**: grant deferral for mobile registrations (Q5).
- **Verify**: `pnpm check`; `pnpm test:integration`; `pnpm exec playwright test tests/routes/auth-flow.test.ts`; preview: curl login → me → refresh ×2 in parallel → reuse (401); web login still works; p95 of `/api/history` before and after 4c (Vercel observability) within +20 ms.
- **Rollback**: endpoints and `0047` are additive; reverting 4c restores the old `jwt` callback.

### Phase 5 — Resource endpoints [R + B, M] (8-12 days)
Each sub-phase: **(i) [R]** move the domain's legacy `lib/*` once into `server/modules/<d>`; **(ii) [B]** v1 endpoints + tests; **(iii) [B]** web switches its callers (legacy route → module wrapper + `legacy-hit`). From the first (iii) deploy, those endpoints are frozen (D22) and `api-breaking` is enforced.

| Sub | Endpoints | Web callers switched |
|---|---|---|
| 5a chats | `/chats`, `/chats/{chatId}`, `/messages`, votes, trailing delete; `lib/utils.ts` split (separate behaviour-neutral PR) | `sidebar-history.tsx`, `app-sidebar.tsx`, `chat.tsx` (votes), `message-actions.tsx`, `message-editor.tsx`; `chat/[id]/page.tsx` via server caller |
| 5b projects & uploads | projects, files, `POST /uploads` (user-scoped pathnames; S4 outcome) | `contexts/project-context.tsx`, `styles-projects/editor-v1.tsx`, `multimodal-input.tsx`, `projects/[id]/page.tsx` |
| 5c prompts & quiz | prompts, favorites, quizzes | `prompt-library.tsx`, `quiz-reward-banner.tsx` |
| 5d billing reads | `me/billing/*`, `me/subscription`; `/plans` consumers; **lift of the 4 DB cards** (F8) | `usage-hint.tsx`, `use-spend-banner.ts`, `subscription/page.tsx`, `manage/page.tsx`, `plans-grid-card.tsx`, `payment-utils.ts`, the 4 cards |
| 5e money mutations | `me/subscription/{cancel,resume,cancellation-feedback}`, `POST/GET /payment-intents` with `Idempotency-Key` and a per-user limit | `cancel-flow-dialog.tsx`, `resume-dialog.tsx`, `use-payment.ts`, `top-up-dialog.tsx` |

- **Verify**: `pnpm vitest run server/api/v1/<resource>`; Playwright; for 5e a CloudPayments test-mode subscription, top-up, cancel and resume on a preview, plus a reconciliation query (every paid intent has its webhook transaction) in `admin-dashboard`.
- **Rollback**: revert the (iii) PR (legacy routes still serve).

### Phase 6 — Chat turn, resume, stop on v1 [R + B, M] (5-7 days)
- **6a [R]**: `app/(chat)/api/chat/_lib/**` → `server/modules/chat-turn/**`; server `lib/ai/**` → `server/modules/ai`, `server/integrations/*`. The legacy route imports from the new paths.
- **6b [B]**: `turn-handler.ts` and `stream-handler.ts` under `withV1Raw` (principal, CSRF, 426, rate limit, foreign chat → 404, envelope); `prepareChatTurn(principal, …)`; `INSUFFICIENT_BALANCE` 402 while still persisting the localized notice; `MODEL_UNAVAILABLE` for unknown or hidden models; `trigger` + `TURN_ALREADY_EXISTS` (S15); v1 attachment URL prefix rule; stop procedure; spec path objects generated from the zod turn schema (m11).
- **6c [B]**: `v1/_schemas/message.ts` `MessagePart` union with `unknown` fallback; `GET /messages` output uses it; `lib/types.ts` `ChatMessage` replaced; `golden-stream.test.ts`.
- **6d [B]**: raw route files (`maxDuration = 800`); `next.config.ts` `outputFileTracingIncludes` adds `"/api/v1/chats/**"` (no bracket ambiguity, F5) and keeps `"/api/chat"` until Phase 12; nft assertion in `scripts/check.ts`.
- **6e [B]**: web transport behind `isChatV1TransportEnabled` (D21): `api: "/api/v1/chats"`, `prepareSendMessagesRequest` returns `api: \`/api/v1/chats/${id}/turns\`` and forwards `trigger`; errors read the envelope. Ramp: testers → 10% → 100% over at least 3 days, with an hourly reconciliation in `admin-dashboard`: assistant messages with a `modelId` vs usage `Transaction` rows per hour.
- **Verify**: `pnpm vitest run server/api/v1/chats`; preview matrix (text, image, video, PDF tool, resume after reload, stop, app-backgrounded abort still charged); PDF fonts and watermark render; `pnpm exec playwright test tests/routes`.
- **Rollback**: turn the flag off (instant); revert 6e if needed.

### Phase 7 — Web auth UI on REST [B] (2-3 days)
- Login via `signIn`; register, verify, resend, forgot and reset via v1; `update()` with no payload; auth action exports become wrappers with `legacy-hit`.
- **Verify**: Playwright `login.test.ts` (assertions unchanged) + new register/verify spec; manual reset email on a preview. **Rollback**: revert.

### Phase 8 — Preferences off server actions [B] (1 day)
- `client/shared/lib/preferences-cookie.ts`; the 4 providers call it; the 11 actions become wrappers.
- **Verify**: Playwright chat-input (model and settings persist after reload); unit test. **Rollback**: revert.

### Phase 9 — Account deletion [B, M] (2-3 days)
- Migration `0048`; `server/modules/account-deletion` (re-auth by password; cancels the CloudPayments subscription first, failure ⇒ 502 and nothing changes; revokes sessions and bumps `token_version`; anonymizes email and PII; deletes chats, blobs and projects in `after()`; keeps `Transaction`, `PaymentIntent` and `Balance` rows for accounting, Q14); `POST /api/v1/me/deletion`; web settings entry.
- **Verify**: integration test; preview run on a test account. **Rollback**: endpoint is additive.

### Phase 10 — Mobile GA hardening [B, M] (2 days)
- Set `minSupportedVersion` flags; 426 live for mobile headers; `docs/api-versioning.md`; a mobile developer README (auth flow, single-flight refresh, resume-not-retry, error codes, headers, `openEnum` fallbacks); decide spec linking (Q3).
- **Verify**: a deliberately breaking test PR fails `api-breaking`; curl with `X-Client-Version: 0.0.1` → 426.

### Phase 11 — FSD client restructure [R] (8-12 days, off the mobile path)
- S13 first. Bottom-up, one PR per step, `git mv` + codemod, no shims: (11a) `client/shared` (shadcn, ai-elements, icons, lib, api, config; `components.json`, Biome ignores); (11b) entities; (11c) features (contexts become feature providers; `components/ui/model-selector` leaves the lint ignore, with lint fixes in a separate [B] PR); (11d) widgets (chat cluster moved first, split later in separate PRs); (11e) pages (`page.tsx` → guard + load + `<XPage/>`); (11f) `client/app` providers, styles (`globals.css` `@source` path), analytics; root docs files → `docs/`; `lib/agent-discovery` → `server/agent-discovery`. Biome boundary overrides go from warn to error per finished layer; optional Steiger job.
- **Verify**: `pnpm check`; Playwright; allowlist count drops; `/chat` First Load JS within +5%; preview visual check (GIPITI-101 DOM guard still mounted). **Rollback**: revert per PR.

### Phase 12 — Legacy removal [B] (1-2 days)
- Gate: 14 calendar days after each web switch with zero `legacy-hit` counts, and a "failed to find server action" rate at noise level. Delete the legacy routes, `actions.ts` files, the `"/api/chat"` tracing key, `serverActions.allowedOrigins` (`next.config.ts:101-105`) and the paired characterization tests. The architecture test asserts no `"use server"` file remains and that legacy folders are empty.
- **Rollback**: revert.

### Phase 13 — Optional
- (13a [R]) Wrap `app client server core types` + `proxy.ts` + `instrumentation.ts` into `src/` in one atomic commit; alias `@/*` → `./src/*`; no `@/` import edits (Q1). (13b [B]) Full Zod 4 upgrade of legacy schemas. (13c) Delete `legacy` allowlist entries.

---

## Risks and mitigations

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| GIPITI-28 branch conflicts with moves | high / high | Owner merges or parks it before 3a; moves are spread over domains, not done up front |
| Migrations path change breaks the production deploy | medium / critical | Single move (3a) with a preview deploy; guard in `migrate.ts`; protect-hook regex + test in the same PR; `vercel rollback` path documented |
| Preview build migrates production | unknown / critical | Owner precondition + `ALLOW_PREVIEW_MIGRATIONS` guard (1i) |
| Tracing includes miss on the v1 chat route | medium / high | `"/api/v1/chats/**"` key + nft build assertion + manual PDF/watermark turn |
| Money route outside middleware | was certain / high | `withV1Raw` shares guards; HTTP tests per raw route |
| Paid duplicate turns from mobile retries | medium / medium | `trigger` + 409 `TURN_ALREADY_EXISTS`; resume-not-retry README |
| Revocation gaps on cookie path | was certain / high | `jwt`-callback `ver` check |
| Extra DB/Redis read per web request | certain / low | Redis write-through cache; p95 measured in Phase 4 |
| Limiters absent in production | unknown / high | Health check, fail closed for auth flows, owner precondition |
| Grant farming at scale | medium / medium | Limits, blocklist, deferred mobile grant, weekly metric |
| SSRF via attachment URLs | was certain / high | Host allow-list + caps (1j), user prefix (6b) |
| Native clients break on new enum values | medium / high | `openEnum`, S14 |
| AI SDK / tool change breaks old mobile builds | medium / high | Golden stream test, `MessagePart` fallback, explicit breaking rule |
| oRPC 1.16 differs from docs | high / medium | Exact pin, spikes S1-S6, installed `.d.mts` |
| Raw route vs catch-all precedence | medium / medium | S3 with fallback stop path |
| Upload body cap on Vercel | unknown / medium | S4; direct-to-Blob later |
| Stale tabs hit removed actions | high / low | Reload toast, Skew Protection, counters, 14-day window |
| Refresh races | medium / medium | Sibling tolerance + client single-flight + integration test |
| Phase 6 regression on the money path | medium / high | Flag ramp, reconciliation, instant off |
| Solo-dev fatigue | high / medium | Mobile beta cut line; restructure phases off-path; per-phase plans and issues |

---

## Verification

| Phase | Commands / checks |
|---|---|
| all | `pnpm check`; `pnpm format` for formatting failures; CI `characterization-diff`, `integration` |
| 0 | `pnpm vitest run tests/characterization tests/architecture`; `pnpm test:integration` |
| 1 | `pnpm check`; `pnpm exec playwright test tests/e2e/login.test.ts`; preview: CloudPayments test payment, cron with and without secret, `/api/health` shows the limiter |
| 2 | `pnpm check`; preview build; spike notes in the Phase 3 plan file |
| 3 | `pnpm check`; `git diff --stat origin/main...HEAD -- tests/characterization` (specifier lines only, enforced); preview deploy log shows migrations from `server/db/migrations`; `curl` `/api/v1/config`, `/api/v1/openapi.json`, unknown path → 404 JSON |
| 4 | `pnpm test:integration`; `pnpm exec playwright test tests/routes/auth-flow.test.ts`; curl flow on preview; web login; p95 check |
| 5 | `pnpm vitest run server/api/v1/<resource>`; Playwright; 5e CloudPayments test-mode flows + reconciliation query |
| 6 | `pnpm vitest run server/api/v1/chats`; `pnpm check` build step nft assertion; preview turn matrix; flag ramp with hourly reconciliation |
| 7, 8 | Playwright e2e; component and unit tests; preview reset email |
| 9 | `pnpm test:integration` (deletion); preview test account |
| 10 | breaking test PR fails `api-breaking`; curl 426 |
| 11 | `pnpm check`; allowlist count decreases; `/chat` First Load JS within +5% |
| 12 | `legacy_hit` zero for 14 days; stale-action error rate at noise level; `pnpm check` |

---

## Owner decisions

On 2026-11-15 the owner accepted the recommended default for every open question (Q1-Q14). The table records those decisions; references to a Q-number elsewhere in this document point here. Two items still need action outside the code: Q9 depends on Skew Protection being available on the Vercel plan, and Q14 needs a legal check before Phase 9.

| # | Question | Decision |
|---|---|---|
| Q1 | Final layout: top-level `app/ client/ server/ core/` (each file moves once), or additionally wrap them into `src/` like `admin-dashboard`? | Top-level now; decide the optional Phase 13 `src/` wrap at the end (one commit, no import edits). |
| Q2 | Resource naming: plural REST (`GET /api/v1/chats` for history) or literal paths like `/api/v1/chat/history`? | Plural REST; folders mirror it (`server/api/v1/chats`). |
| Q3 | Publish the v1 spec: link from `/.well-known/api-catalog` (reverses `docs/agent-discovery.md`) or serve `/api/v1/openapi.json` unlinked? | Unlinked + committed snapshot; revisit at mobile GA. |
| Q4 | Preferences: device-local (client cookie writes; mobile on device) or DB-synced across devices? | Device-local; `/me/preferences` can be added later. |
| Q5 | Defer the 50 RUB welcome grant until email verification for mobile (`ios`/`android`) registrations? | Yes for mobile; web unchanged; revisit for web after watching the grants metric. |
| Q6 | Keep `email_taken` on register (enumeration) or move to verify-first? | Keep, with (email, IP) and /64 limits. |
| Q7 | Refresh lifetime 60-day sliding / 180-day absolute? | Yes. |
| Q8 | Auth endpoints fail closed (503) in production when the limiter is missing or erroring? | Yes for login, register, verify, send and forgot; open elsewhere. |
| Q9 | Enable Vercel Skew Protection? | Enable if available; keep the 14-day window anyway. |
| Q10 | Env-gated test model so chat turns run in Playwright/CI? | Yes, gated by `PLAYWRIGHT=True`, never registered in production builds. |
| Q11 | Schedule `cleanup-payment-intents` hourly? | Yes. Refresh tokens do not exist yet; cleaning them is added to this cron in Phase 4. Before it is scheduled, the cron stops deleting succeeded intents (Phase 1c). |
| Q12 | Mobile payments: WebView over the payment-intent payload, or a native SDK later? | WebView first; store-policy review is a separate task. |
| Q13 | Password-reset links for mobile users: web page or app link? | Web page for v1. |
| Q14 | Account deletion: anonymize and keep financial rows; what happens to a remaining balance? | Anonymize, keep `Transaction`/`PaymentIntent`, forfeit the balance with a confirmation warning; confirm with a legal check. |

---

## Review notes

| Critic finding | Resolution | Reason |
|---|---|---|
| Risk M1: raw SSE/upload routes bypass `_kit` (CSRF, 426, envelope, 404) | Accepted | Guards become plain functions shared by the oRPC middleware and `withV1Raw`; multipart allowed only on uploads; HTTP tests per raw route (verified `parse-request.ts:19`, `prepare-chat-turn.ts:232-233`). |
| Risk M2: `token_version` checked only in `resolvePrincipal` | Accepted | Check moved into the NextAuth `jwt` callback; `null` clears the cookie (verified `session.js:53-55`); missing `ver` = 0. |
| Risk M3: grace window impossible with hash-only storage | Accepted | Sibling-pair tolerance within 30 s + client single-flight; no plaintext stored; parallel-refresh integration test. |
| Risk M4: retried turn = paid regeneration | Accepted | `trigger` forwarded (verified in transport, `ai/dist/index.mjs:12251`; web omits it today, `chat.tsx:106-131`), 409 `TURN_ALREADY_EXISTS`, resume-not-retry rule, abort-still-charges test. |
| Risk M5: grant farming; limiters no-op without Upstash REST | Accepted (device attestation deferred) | Verified `rate-limit.ts`/`redis.ts`; health + fail-closed, (email, IP)//64 limits, blocklist, mobile grant deferral (Q5), metric. |
| Risk M6: SSRF / unbounded fetch via file URLs | Accepted | Blob host allow-list + caps in Phase 1 for legacy and v1; v1 user-prefix rule; user-scoped upload pathnames (verified `upload/route.ts:124`). |
| Risk M7: open enums not expressible; response validation | Accepted | `openEnum` via `JSON_SCHEMA_OUTPUT_REGISTRY` (exists in `@orpc/zod@1.16.2`), `ResponseValidationPlugin` banned, S14 native decode check. |
| Risk M8: stream protocol and message parts unversioned | Accepted | `MessagePart` union with fallback, golden stream test, explicit breaking rule for tools/parts, AI SDK major → adapter or v2. |
| Risk M9 / Pragmatist F3: byte-identical characterization impossible | Accepted | DoD changed to "specifier lines only" with a CI diff guard; `vi.mock`-resolves check; money flows pinned by real-DB integration tests from Phase 0. |
| Risk M10: no instant rollback for the Phase 8 cutover | Accepted | Vercel Flag for the transport, tester → 10% → 100% ramp, hourly reconciliation. |
| Risk M11: previews may migrate production | Accepted | Owner precondition + `migrate.ts` preview guard before any new migration; "never edit a migration after preview" rule (verified `package.json:7`, `migrate.ts:10-24`). |
| Risk M12: no account deletion | Accepted | Phase 9 `POST /me/deletion` before store submission; store-policy wording stays UNVERIFIED. |
| Risk m1: action hit counter cannot see stale tabs | Accepted | Reload toast + stale-action error rate as the gate; Skew Protection. |
| Risk m2-m14 | Accepted | Lockout-safe limits, hidden model → `MODEL_UNAVAILABLE`, length-checked HMAC compare, secrets precondition, no TTL session cache, documented cookie-group revocation, `Idempotency-Key`, no write-on-GET (preferences dropped), freeze from first client use, generated SSE spec paths, no CORS, `kid` rotation, bulk-delete cleanup in `after()`. |
| Pragmatist F1: mobile blocked behind restructuring | Accepted | Reordered: v1 code born in final place in Phase 3b; legacy domains move once in the PR stack that ports them; FSD off-path. |
| Pragmatist F2: double moves, migrations moved twice | Accepted | No `src/` move; top-level `server/` etc. keep the alias; each file moves once; migrations once (3a). Owner can still choose the `src/` wrap later (Q1). |
| Pragmatist F4: Phase 0 too large | Accepted | Slim characterization (4 files) + 2 integration tests; the rest is tested as v1 endpoints. |
| Pragmatist F5: tracing key glob ambiguity | Accepted | Key `"/api/v1/chats/**"` + nft build assertion (docs contradiction verified at `output.md:105,114`). |
| Pragmatist F6: DB preferences is scope creep | Accepted (owner can override, Q4) | Client cookie writes; cookies already non-httpOnly and the chat POST carries all settings. Trade-off: no cross-device sync (owner's literal goal 2 is still met, since no server action remains). |
| Pragmatist F7: per-endpoint ceremony, no DTO home | Accepted | Resource-level folders, `v1/_schemas`, `v1/_mappers`; contract-first kept and justified by the Expo package. |
| Pragmatist F8: nested RSC DB reads vs FSD rule | Accepted | Data-lift of 4 cards in 5d as [B]; streaming loaders stay in `app/`. |
| Pragmatist F9-F10: barrels decided late; too many features | Accepted | S13 before 11a; coarse features. |
| Pragmatist F11: client imports `src/server` | Partially accepted | Single re-export in `client/shared/api/contract.ts`; contracts stay colocated, since a separate `contract/` tree would duplicate the URL tree. |
| Pragmatist F12-F13: in-process middleware; cookie-path DB read | Accepted | Per-transport guard policy; Redis write-through `token_version` cache with explicit invalidation, measured (resolves the tension with risk m6: immediate revocation kept). |
| Pragmatist F14: three versioning mechanisms | Accepted | Snapshot + golden stream + `oasdiff` from Phase 5; custom frozen comparer dropped; `deprecation.ts` built on first use. |
| Pragmatist F15-F18 | Accepted | DB/Redis legacy counters with a calendar window; `origin/main...HEAD`; phase steps fixed (1c before 1h, grant transaction own PR, 7(iii) removed); umbrella roadmap + per-phase plans and Linear issues. |
| Pragmatist: Zod 4 upgrade not required | Accepted | Verified `@orpc/zod@1.16.2` peer `zod >=3.25.0` and its `zod/v4/core` import, which the installed 3.25.76 ships; S1 confirms at runtime; the upgrade becomes optional 13b. |
| Safety vs simplicity trade-offs | Explicit | Risk asked for more safety on the money path (integration tests early, flag ramp, guards); pragmatist asked for fewer phases before mobile value. Resolution: money/security safety stays on the critical path (Phases 0-1, ~1.5 weeks); structural ceremony (full characterization, upfront moves, DB preferences, custom comparer) is cut or moved off-path. |
