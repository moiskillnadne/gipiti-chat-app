# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GIPITI — a Next.js 16 (App Router, Turbopack) AI chat app for the Russian market. Multi-provider LLMs (OpenAI, Google, Anthropic, xAI, DeepSeek, Perplexity, ByteDance, Kling, …) all reached through the Vercel AI Gateway, plus image/video generation, document-generation tools, web search, projects, and a public SEO marketing site. Billing is **pure pay-per-use**: users hold a money balance (RUB by default) that is charged per request. Stack: TypeScript, PostgreSQL + Drizzle ORM, NextAuth v5 beta, AI SDK v6, CloudPayments, Tavily, Resend.

## Development Commands

Standard scripts (dev, build, db:*, lint, format) are in `package.json`. Non-obvious ones:

```bash
pnpm build:debug                 # next build only — use this to check the app builds after changes
pnpm build                       # NOTE: runs DB migrations first (tsx lib/db/migrate), then next build
pnpm test:unit                   # Vitest; only picks up **/__tests__/**/*.test.ts
pnpm vitest run lib/ai/__tests__/model-registry.test.ts   # single unit test file
pnpm test                        # Playwright E2E (starts `pnpm dev` via webServer)
pnpm exec playwright test tests/e2e/login.test.ts         # single E2E file
pnpm models:list                 # list AI Gateway models
pnpm prompts:sync                # sync prompt library from Google Sheet
npx tsx scripts/seed-subscriptions.ts   # seed Subscription catalog from lib/subscription/subscription-tiers.ts
npx tsx scripts/add-tokens.ts <userId> <amountMajor> [description]  # credit a user's top-up balance
```

CI (`.github/workflows/`) runs lint, unit tests, and Playwright.

## Architecture Overview

### Route groups

- `app/(chat)` — the authenticated app (chat, projects, prompt library) and its APIs under `app/(chat)/api/*`
- `app/(auth)` — login/register/reset, NextAuth config (`auth.ts`, `auth.config.ts`), manage-subscription + payment hook
- `app/(marketing)` — public landing, `/models` catalog + per-model landings (data in `lib/marketing/`), blog (`content/blog/*.md`)
- `app/subscription` — balance/usage dashboard, email verification
- `app/api` — cron, webhooks (CloudPayments, Resend), payment/top-up intents, health, log, agent-markdown
- `proxy.ts` — Next 16's middleware: redirects for `PROTECTED_ROUTE_PATTERNS` (new authenticated pages must be added there; everything else falls through so unknown paths 404), signup gating via the `isSignupEnabled` flag, `Accept: text/markdown` rewrites

### AI integration

- Model registry: `lib/ai/models.ts` — every model's capabilities (attachments, `pdfAttachments`, `toolCalling`, thinking config, image/video gen configs, `isVisibleInUI`) plus helpers (`isImageGenerationModel`, `isVideoGenerationModel`, `supportsToolCalling`, gateway-id maps…). UI visibility list in `lib/ai/entitlements.ts`. `lib/ai/__tests__/model-registry.test.ts` guards registry consistency.
- Providers: `lib/ai/providers.ts`; system prompts: `lib/ai/prompts.ts`; tools: `lib/ai/tools/` (web search, URL extract, calculator, generateImage, generatePdf/Docx/Markdown/Txt/Csv).
- Recipes for adding a model, a tool, or changing the DB schema: `repo-recipes` skill (`.claude/skills/repo-recipes/SKILL.md`).

### Chat request flow (`POST /api/chat`, `app/(chat)/api/chat/route.ts`, 300s max)

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
- Free start = welcome grant + email-confirm bonus + onboarding-quiz bonus (constants in `lib/billing/constants.ts`).
- Web search is billed per call (`SEARCH_COST_USD`), not quota-counted.

### Authentication

- NextAuth v5 Credentials (email/password), bcrypt-ts, dummy-password compare to prevent user enumeration; emails normalized (`lib/auth/`), unique on `lower(email)`.
- JWT callbacks add `id`, `type`, `emailVerified`, `hasActiveSubscription`, `isTester` — these are **login-time snapshots**; read the DB for runtime tier decisions.
- Registration → 6-digit email verification code via Resend; signup can be disabled by the `isSignupEnabled` Vercel Flag (`lib/flags.ts`).

### Client state

Chat layout providers: `SessionProvider → DataStreamProvider → ModelProvider → ProjectProvider → WebSearchProvider → SidebarProvider`. Model/thinking/media settings and project selection persist in cookies (update through server actions in `app/(chat)/actions.ts`). `DataStreamProvider` pipes `useChat()` stream parts so `useAutoResume()` can resume after reload. Data fetching uses SWR.

### Errors

`ChatSDKError` (`lib/errors.ts`) with codes `"{type}:{surface}"` (e.g. `quota_exceeded:chat`, `unauthorized:api`); `.toResponse()` maps to HTTP status. Database errors are logged, not exposed.

### Payments (CloudPayments)

- Webhook `/api/webhooks/cloudpayments/` (HMAC-SHA256 validated): check, pay, fail, recurrent, cancel. Branches on `data.kind` (`subscription` vs `topup`); top-up crediting is idempotent per intent.
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

All require `Authorization: Bearer ${CRON_SECRET}`: `reset-quotas` (renew billing periods / reset subscription pool), `cleanup-cancelled`, `cleanup-payment-intents`, `refresh-fx-rates` (hourly).

## Conventions

### Linting and formatting (ultracite / Biome — `.cursor/rules/ultracite.mdc`)
- `pnpm lint` to check, `pnpm format` to fix
- `type`, not `interface` (`useConsistentTypeDefinitions`); no enums; `import type`
- No `any` (use `biome-ignore` with a reason when unavoidable); no bare `public` on class members
- No `console.log` in client code (client logging goes through `/api/log`)
- React: no index keys, functional components; Next.js: `<Image>` not `<img>`, semantic HTML/ARIA
- Named exports, components < 200 lines, business logic in `lib/` not components

### i18n
- No next-intl — a small in-house shim in `lib/i18n/translate.ts` exposes `useTranslations(ns)` / `await getTranslations(ns)` with the same shape.
- Russian only: strings in `messages/ru.json`; the `errors` namespace lives in `messages/ru.errors.json` (loaded separately by root error boundaries).
- Never hardcode UI strings.

## Environment Variables

See `.env.example` (`AUTH_SECRET`, `AI_GATEWAY_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `POSTGRES_URL`, `REDIS_URL`, Resend vars, `NEXT_PUBLIC_APP_URL`, `FLAGS`/`FLAGS_SECRET`, `TAVILY_API_KEY`, `PROMPTS_SHEET_*`, `BLOG_PREVIEW_KEY`). Also needed but missing from the example: `CLOUDPAYMENTS_PUBLIC_ID`, `CLOUDPAYMENTS_API_SECRET`, `CRON_SECRET`. Redis (`lib/redis.ts`) accepts either `REDIS_URL` (+`REDIS_TOKEN`) or Upstash `KV_REST_API_URL` + `KV_REST_API_TOKEN`; without it resumable streams are disabled.

## Common Gotchas

1. **Message schema**: use `Message_v2` / `Vote_v2`, not the deprecated tables. `Vote_v2` PK is (chatId, messageId); `Document` PK is (id, createdAt).
2. **Document table** only stores generated tool output (`kind` = image | video | pdf | docx | markdown | txt | csv). `kind` is a TS-only varchar enum — adding a kind needs no migration.
3. **Migrations**: SQL files in `lib/db/migrations/`, applied by `pnpm db:migrate`. `pnpm db:generate` is currently broken (drizzle-kit 0.25 vs drizzle-orm 0.45) — hand-write migrations + journal entries. Drizzle puts Postgres SQLSTATE on `error.cause` (see `lib/db/unique-violation.ts`).
4. **Gate before inference, charge after**: balance is checked before calling the model; cost is charged afterwards. A billing failure must never break the stream (`chargeUsageSafe`).
5. **Gateway provider metadata**: Google models report under `providerMetadata.vertex`, not `google`. The gateway silently drops unknown image/video params — verify a new param actually changes output.
6. **Reasoning**: some models need `extractReasoningMiddleware` for `<think>` tags — check `usesReasoningTagMiddleware()` in `models.ts`; native-reasoning models must not be wrapped.
7. **Text attachments**: `.md`/`.txt`/`.csv`/`.tsv`/code uploads are validated by extension (browser MIME is unreliable), normalised to UTF-8 on upload (BOM stripped, Windows-1251 re-encoded), and inlined as text for the model by `lib/ai/text-attachments.ts` (`.docx` via `docx-extract.ts`) — providers only accept images/PDFs as file parts. Some models reject PDFs (`pdfAttachments: false`).
8. **Provider SDKs**: all models go through `@ai-sdk/gateway`; `@ai-sdk/google` is imported only for provider-option types.
9. **SVG imports**: a Turbopack SVGR rule in `next.config.ts` turns **every** `.svg` import into a React component.
10. **Static assets**: files in `public/` are served from `/`, never `/public/...`.
11. **Hidden deps**: `redis` and `@opentelemetry/api-logs` look unused but are required transitively — don't remove.
