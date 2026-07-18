# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 AI chatbot with multi-provider LLM support (OpenAI, Google, Anthropic, Xai), token balance/quota management, subscription tiers, web search, image and video generation, and project/style customization. Built with TypeScript, PostgreSQL (Drizzle ORM), NextAuth v5, and the Vercel AI SDK.

## Development Commands

Standard scripts (dev, build, db:*, lint, format, test) are in `package.json`. Non-obvious ones:

```bash
pnpm build:debug          # Run simple build checks after any changes, it helps understand if app builds correctly
pnpm models:list          # List AI Gateway models
tsx scripts/seed-plans.ts  # Initialize subscription plans in DB
tsx scripts/add-tokens.ts  # Add tokens to a user
```

## Architecture Overview

### AI Integration

- Model registry: `lib/ai/models.ts` (capabilities, thinking configs, `isVisibleInUI` flag, helper functions); providers in `lib/ai/providers.ts`; system prompt factory in `lib/ai/prompts.ts`; tools in `lib/ai/tools/`.
- **Token System (Dual):** balance-based (primary, `lib/ai/token-balance.ts`, deducts BEFORE inference, refunds on partial consumption, audit trail via TokenBalanceTransaction) + period-based (legacy, `lib/ai/token-quota.ts`, per-subscription period aggregation).
- Flow: `checkTokenQuota()` → `checkBalance()` → inference → `recordTokenUsage()` + `deductBalance()`
- Subscription tiers are defined in `lib/subscription/subscription-tiers.ts`. Users are capped by token balance, web-search count, image-generation count, and video-generation count — there is no per-period message-count cap.

### Chat Streaming

**Main Endpoint**: `POST /api/chat` (300s max timeout)
1. Validates token quota/balance before inference
2. Saves user message to Message_v2
3. Builds system prompt with model capabilities + user style + project context
4. Streams via `streamText()` with up to 5 tools, maxSteps calculated per subscription
5. Records usage + deducts balance on completion
6. Redis-backed resumable streams for recovery

**Stream Recovery**: `GET /api/chat/[id]/stream` — reconnect within 15s window using stream ID.

### Authentication

- **Provider**: Credentials (email/password) via NextAuth v5 beta
- **Security**: bcrypt-ts hashing, timing-safe comparison with dummy password to prevent user enumeration
- **JWT**: httpOnly cookies, callbacks populate user.id, user.type, emailVerified, hasActiveSubscription, isTester
- **Route protection**: Auth checks in API routes via `auth()`, server components, and layout guards
- **Registration**: Email + password → bcrypt hash → email verification (6-digit code via Resend)
- **Password reset**: Token-based flow via email

### State Management

**Provider Hierarchy** (root layout → chat layout):
```
NextIntlClientProvider → ThemeProvider → SessionProvider →
  DataStreamProvider → ModelProvider → StyleProvider → ProjectProvider → SidebarProvider
```

**Context Providers:**
- `ModelContext`: currentModelId, thinkingSetting — persisted in cookies
- `StyleContext`: currentStyleId, styles[] — SWR-fetched from /api/text-styles, persisted in cookie
- `ProjectContext`: currentProjectId, projects[] — SWR-fetched from /api/projects, persisted in cookie
- `DataStreamContext`: Pipes `useChat()` data through context so `useAutoResume()` can react to `data-appendMessage` events on page reload

**Data Fetching**: SWR with key-based cache invalidation. `useChat()` from @ai-sdk/react manages message state.

**Custom Hooks:**
- `useMessages()`: Scroll-to-bottom + message tracking
- `useAutoResume()`: Resume interrupted streams on page reload
- `useScrollToBottom()`: ResizeObserver + MutationObserver sticky scroll
- `useMobile()`: 768px breakpoint detection
- `usePayment()`: CloudPayments flow with polling, session recovery, trial handling (532 lines, in subscribe/hooks/)

### Error Handling

**ChatSDKError** (`lib/errors.ts`):
```
ErrorCode = "{type}:{surface}" — e.g., "quota_exceeded:chat", "unauthorized:api"
Types: bad_request | unauthorized | forbidden | not_found | rate_limit | quota_exceeded | offline
Surfaces: chat | auth | api | stream | database | history | vote
```
- `.toResponse()` converts to proper HTTP response with status code
- Database errors logged only (not exposed to user)

### Payment System

- **Gateway**: CloudPayments (Russian processor)
- **Webhook endpoint**: `/api/webhooks/cloudpayments/` with HMAC-SHA256 signature validation
- **Events**: check, pay, fail, recurrent, cancel
- **Payment intents**: 30-minute expiry, tracked in PaymentIntent table
- **Trial support**: Separate create-trial-intent endpoint

### Search System

- **Provider**: Tavily API (`lib/search/tavily-client.ts`)
- **Capabilities**: Web search (basic/advanced depth) + URL content extraction
- **Quota**: Per-user per-billing-period, defined in subscription tier features
- **Tracking**: SearchUsageLog table, `checkSearchQuota()` before each search

### Cron Jobs

All require `Authorization: Bearer ${CRON_SECRET}` header:
- `GET /api/cron/reset-quotas` — Reset free tester quotas, renew billing periods
- `GET /api/cron/cleanup-expired-trials` — Clean up expired trial subscriptions
- `GET /api/cron/cleanup-cancelled` — Clean up cancelled subscriptions
- `GET /api/cron/cleanup-payment-intents` — Expire old payment intents

## Important Patterns

Step-by-step recipes for modifying the DB schema, adding an AI model, or adding an AI tool live in the `repo-recipes` skill (`.claude/skills/repo-recipes/SKILL.md`).

### Linting and Formatting
- **ultracite** (Biome-based): `pnpm lint` to check, `pnpm format` to fix
- Use `type` keyword, not `interface` (Biome `useConsistentTypeDefinitions`)
- No `any` types (enforced, use `biome-ignore` with reason when unavoidable)
- No console.log (use proper logging via `/api/log` endpoint)
- TypeScript best practices: no enums, explicit types, `import type` syntax
- React: no index keys, hooks rules, functional components only
- Next.js: use `<Image>` not `<img>`, semantic HTML with ARIA attributes

## Environment Variables

```bash
# Database & Infrastructure
POSTGRES_URL              # (Required) PostgreSQL connection string
REDIS_URL                 # (Optional) Standard Redis or Upstash REST endpoint
KV_REST_API_URL           # (Optional) Upstash REST API URL
KV_REST_API_TOKEN         # (Optional) Upstash REST API token

# Authentication
AUTH_SECRET               # (Required) NextAuth secret (fallback: NEXTAUTH_SECRET)

# Email
RESEND_API_KEY            # (Required) Resend email service
NEXT_PUBLIC_APP_URL       # (Required) Frontend URL for email links
RESEND_WEBHOOK_SECRET     # (Optional) Resend webhook signing
RESEND_MARKETING_SEGMENT_ID # (Optional) Marketing list segment

# Payments
CLOUDPAYMENTS_PUBLIC_ID   # (Required) CloudPayments public key
CLOUDPAYMENTS_API_SECRET  # (Required) CloudPayments API secret

# Search
TAVILY_API_KEY            # (Required) Tavily web search API

# AI (handled via Vercel AI Gateway, or direct provider keys)

# Cron
CRON_SECRET               # (Required) Secret for cron job authorization

# Testing
PLAYWRIGHT                # Set to "True" for mock models in tests
```

## Testing

- Playwright E2E tests: `pnpm test`
- Test mode (`PLAYWRIGHT=True`) uses mock models from `lib/ai/models.mock.ts`
- Tests in `tests/` directory with page object models

## Common Gotchas

1. **Message Schema**: Always use `Message_v2`, not deprecated `Message` table
2. **Composite Keys**: `Document` uses (id + createdAt) as PK, not just id. `Vote_v2` uses (chatId + messageId)
3. **Document table scope**: Only stores generated image/video output (kind="image"|"video"). Not a general-purpose document/artifact store
4. **Token Systems**: Dual system — balance-based (primary, deducts before inference) + period-based (legacy aggregation). Both must be updated
5. **Quota Checks**: Always check quota/balance BEFORE calling AI API to avoid wasted inference
6. **Stream Recovery**: Requires Redis; gracefully degrades without it. 15-second recovery window
7. **Billing Period Renewal**: Automatically handled in `recordTokenUsage()`, don't manually renew
8. **Reasoning Models**: Require `extractReasoningMiddleware` to parse `<think>` blocks
9. **Search Quota**: Checked separately from token quota via `checkSearchQuota()`
10. **Locale**: Currently hardcoded to Russian in `i18n/request.ts`. Browser detection code exists but is commented out
11. **Payment Intent Expiry**: 30-minute hardcoded expiry
12. **Cookie Persistence**: Model, style, project selections stored in cookies — must use server actions to update
13. **ChatSDKError**: Use `new ChatSDKError("type:surface")` for consistent error handling across API routes
14. **Provider SDKs**: Xai/Anthropic models are reached via the Vercel AI Gateway (@ai-sdk/gateway) — there is no direct Xai/Anthropic SDK in this repo

## Internationalization (i18n)

- **Library**: next-intl v4 with cookie-based locale detection
- **Locales**: Currently only Russian (`ru`) — `messages/en.json` does not exist yet
- **Translations**: `messages/ru.json`
- **Namespaces**: common, auth, chat, metadata, settings, usage, errors, legal, thinkingSetting, modelList, textStyles, projects
- **Client**: `useTranslations('namespace')` hook
- **Server**: `await getTranslations('namespace')`
- **Switching**: `setUserLocale()` server action updates cookie + user.preferredLanguage in DB
- **Adding translations**: Add keys to `ru.json`, use `t('key')` in components
- Always use translation keys, never hardcode UI strings

## Refactoring Guidelines
- All code must be TypeScript with strict types
- Components should be < 200 lines
- Business logic goes in /lib or /services, not in components
- Use named exports, not default exports
