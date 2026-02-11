# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js 15 AI chatbot with multi-provider LLM support (OpenAI, Google, Anthropic, Xai), token balance/quota management, subscription tiers, artifact creation, web search, image generation, and project/style customization. Built with TypeScript, PostgreSQL (Drizzle ORM), NextAuth v5, and the Vercel AI SDK.

## Development Commands

### Running the Application
```bash
pnpm install              # Install dependencies
pnpm dev                  # Start dev server with Turbopack
pnpm build                # Run migrations + production build
pnpm build:debug          # Run simple build checks after any changes, it helps understand if app builds correctly
pnpm start                # Start production server
```

### Database Operations
```bash
pnpm db:generate          # Generate Drizzle migrations from schema changes
pnpm db:migrate           # Run pending migrations
pnpm db:studio            # Open Drizzle Studio (database GUI)
pnpm db:push              # Push schema changes without migration files
pnpm db:pull              # Pull schema from database
pnpm db:check             # Check for schema conflicts
```

### Code Quality
```bash
pnpm lint                 # Check code with ultracite (Biome-based)
pnpm format               # Auto-fix issues with ultracite
pnpm test                 # Run Playwright tests
```

### Utility Scripts
```bash
pnpm models:list          # List AI Gateway models
tsx scripts/seed-plans.ts  # Initialize subscription plans in DB
tsx scripts/add-tokens.ts  # Add tokens to a user
```

## Architecture Overview

### Core Technologies
- **Framework**: Next.js 15 App Router with React Server Components
- **Database**: PostgreSQL with Drizzle ORM (30+ migrations)
- **Authentication**: NextAuth v5 beta (Credentials provider, bcrypt-ts)
- **AI**: Vercel AI SDK with multi-provider gateway (@ai-sdk/gateway, @ai-sdk/google, @ai-sdk/xai)
- **Styling**: TailwindCSS 4 + Radix UI + shadcn/ui components
- **State**: React Context + SWR for data fetching + Cookies for persistence
- **Real-time**: Resumable streams backed by Redis (Upstash or standard)
- **Payments**: CloudPayments (Russian payment gateway)
- **Email**: Resend for transactional emails
- **Search**: Tavily API for web search and URL extraction
- **i18n**: next-intl v4 (English + Russian, cookie-based)
- **Analytics**: Vercel Analytics + Yandex Metrika
- **Monitoring**: OpenTelemetry via @vercel/otel

### Directory Structure
```
app/
  (auth)/                  # Login, register, forgot/reset password, verify email, subscribe
    api/auth/[...nextauth]/ # NextAuth route handler
    actions.ts             # Server actions: login, register, forgotPassword, resetPassword, verifyEmail
  (chat)/                  # Chat interface + API routes
    api/
      chat/                # Main chat streaming (POST) + delete (DELETE)
      chat/[id]/stream/    # Resumable stream recovery (GET)
      document/            # Document CRUD
      files/upload/        # File upload to Vercel Blob
      history/             # Chat history with pagination
      usage/               # Token usage tracking
      subscription/        # Subscription management
      suggestions/         # Document edit suggestions
      vote/                # Message voting
      text-styles/         # Text style CRUD
      projects/            # Project CRUD
      transactions/        # Token transaction history
    chat/[id]/             # Individual chat page
    projects/, styles/     # Project & style management pages
    actions.ts             # Server actions: saveChatModel, generateTitle, deleteTrailingMessages
  (marketing)/             # Landing page
  (legal)/legal/           # Privacy, terms, support, requisites pages
  api/
    health/                # Health check endpoint
    log/                   # Client error logging
    payment/               # Payment intent creation (regular + trial) and status
    cron/                  # Scheduled tasks (reset-quotas, cleanup-expired-trials, etc.)
    webhooks/
      cloudpayments/       # Payment webhooks (HMAC-SHA256 signature validation)
      resend/              # Email event webhooks
  actions/locale.ts        # i18n server action: setUserLocale
  subscription/            # Subscription dashboard + usage pages
lib/
  ai/
    models.ts              # Model registry (19 models, 4 providers)
    providers.ts           # AI SDK provider setup + reasoning middleware
    prompts.ts             # System prompts (regular, reasoning, artifacts, search, image, style, project)
    token-quota.ts         # Quota checking & period-based enforcement
    token-balance.ts       # Balance-based token system with transaction audit
    entitlements.ts        # User type entitlements
    message-validator.ts   # Ensures messages have text parts
    step-calculator.ts     # Multi-step inference calculation
    tools/                 # 8 AI tools (see AI Tools section)
  db/
    schema.ts              # Drizzle schema (24 tables, 785 lines)
    queries.ts             # 50+ query functions (1479 lines)
    queries-transactions.ts # Transaction utilities
    migrations/            # 30+ migration files
  subscription/
    subscription-tiers.ts  # Tier definitions with pricing
    billing-periods.ts     # Period calculation utilities
    subscription-init.ts   # Subscription initialization
    cancellation-reasons.ts
  payments/
    cloudpayments.ts       # CloudPayments API client
    cloudpayments-config.ts
    cloudpayments-types.ts
  search/
    tavily-client.ts       # Tavily web search + URL extraction
    search-quota.ts        # Search quota tracking per billing period
    search-types.ts
  email/
    client.ts              # Resend client
    send-verification-email.ts
    send-password-reset.ts
    send-password-changed.ts
    templates/             # Email HTML templates
  auth/
    secret.ts              # AUTH_SECRET resolution
    reset-token.ts         # Password reset token utils
  validation/              # Zod schemas for API validation
  editor/                  # ProseMirror editor utilities
  artifacts/server.ts      # Artifact handler factory
  errors.ts                # ChatSDKError class with error codes
  types.ts                 # Global types (ChatMessage, ArtifactKind, CustomUIDataTypes)
  utils.ts                 # cn(), generateUUID(), convertToUIMessages()
  constants.ts             # Environment checks, DUMMY_PASSWORD
  redis.ts                 # Redis client (Upstash REST or standard)
  format-tokens.ts         # Token number formatting
  client-logger.ts         # Client-side error logging
  usage.ts                 # AppUsage type definition
artifacts/                 # Artifact handlers (4 types: text, code, sheet, image)
  [type]/server.ts         # AI streaming handler per type
  [type]/client.tsx        # Editor component per type
  actions.ts               # getSuggestions server action
components/                # 63+ React components
  ui/                      # shadcn/ui base components
  elements/                # Message rendering primitives (response, reasoning, tool, code-block, etc.)
  landing/                 # Landing page components
contexts/                  # React context providers
  model-context.tsx        # Selected model + thinking settings
  project-context.tsx      # Active project selection
  style-context.tsx        # Active text style selection
hooks/                     # Custom hooks (useArtifact, useMessages, useAutoResume, etc.)
i18n/                      # next-intl configuration
messages/                  # Translation files (en.json, ru.json)
types/                     # Type augmentations (next-auth.d.ts, next-intl.d.ts)
scripts/                   # Utility scripts (seed-plans, add-tokens, etc.)
```

### Database Schema (24 Tables)

**User & Auth:**
- `User`: id, email, password, currentPlan, tokenBalance (bigint), preferredLanguage, emailVerified, isTester, trialUsedAt, reset/verification tokens
- `UserSubscription`: userId, planId, billing period config, status, CloudPayments external IDs, trial fields, cancellation

**Chat & Messages:**
- `Chat`: id, userId, title, lastContext (AppUsage JSON)
- `Message_v2`: id, chatId, role, parts (JSON array), attachments, modelId, createdAt
- `Vote_v2`: chatId + messageId (composite PK), isUpvoted
- `Stream`: id, chatId (for resumable stream recovery)

**Documents & Suggestions:**
- `Document`: id + createdAt (composite PK), title, content, kind, userId, generationId
- `Suggestion`: id, documentId + documentCreatedAt FK, originalText, suggestedText, isResolved

**Subscription & Plans:**
- `SubscriptionPlan`: name, displayName, billingPeriod, tokenQuota, modelLimits (JSONB), features (JSONB), price
- `PaymentIntent`: sessionId, userId, planName, amount, status, isTrial, expiresAt (30 min)
- `CancellationFeedback`: userId, reasons (JSONB), additionalFeedback, plan metadata

**Token Tracking (Dual System):**
- `TokenUsageLog`: per-message usage with input/output/cache tokens, costs, modelId
- `UserTokenUsage`: aggregated usage per billing period, modelBreakdown (JSONB)
- `TokenBalanceTransaction`: audit trail (credit/debit/reset/adjustment), amount, balanceAfter, metadata

**Search & Image Generation:**
- `SearchUsageLog`: userId, query, searchDepth, resultsCount, billing period
- `ImageGenerationUsageLog`: userId, modelId, prompt, imageUrl, token counts, cost

**Customization:**
- `TextStyle`: userId, name, examples (JSONB string[]), isDefault
- `Project`: userId, name, contextEntries (JSONB string[]), isDefault

**Note**: `Message` (deprecated) exists for migration; always use `Message_v2`.

### AI Integration

**Model Configuration** (`lib/ai/models.ts`):
- **Default model**: `gpt-5.2` (OpenAI)
- **19 models across 4 providers**: OpenAI (gpt-5, gpt-5.1-instant, gpt-5.1-thinking, gpt-5.2, gpt-5.2-pro, gpt-5-mini, gpt-codex-5.2, gpt-image-1.5), Google (gemini-2.5-pro, gemini-3-pro, gemini-3-pro-image), Anthropic (opus-4.1, opus-4.6, sonnet-4.5), Xai (grok-2-vision, grok-3-mini, grok-4.1-reasoning, grok-4.1-non-reasoning, grok-code-fast-1)
- **Capabilities**: `reasoning`, `attachments`, `imageGeneration`, `thinkingConfig` (effort levels)
- **Thinking configurations**: OpenAI (auto/none/medium/high), Google (auto/low/high), Anthropic (auto/low/medium/high)
- Reasoning models use `extractReasoningMiddleware({ tagName: "think" })` to parse `<think>` blocks
- Hidden vs visible models controlled by `isVisibleInUI` flag
- Helper functions: `isReasoningModelId()`, `isImageGenerationModel()`, `supportsThinkingConfig()`, `getProviderOptions()`

**System Prompts** (`lib/ai/prompts.ts`):
- `regularPrompt` / `reasoningPrompt`: Base behavior (reasoning adds `<think>` block instructions)
- `artifactsPrompt`: Guides createDocument/updateDocument tool usage
- `webSearchPrompt`: Web search best practices and citation format
- `imageGenerationPrompt`: Image generation style guidance
- `textStylePrompt(style)`: Custom writing style from user examples
- `projectContextPrompt(project)`: Project context injection
- `getRequestPromptFromHints()`: Geolocation data from Vercel Edge
- `systemPrompt()` factory: Dynamically combines prompts based on model capabilities, user's style, and project

**AI Tools** (`lib/ai/tools/` — 8 tools):
1. `calculator`: Math expressions via mathjs
2. `getWeather`: Open-Meteo weather API
3. `webSearch`: Tavily search with quota checking per billing period
4. `extractUrl`: Tavily URL content extraction (max 3 URLs)
5. `createDocument`: Creates artifacts (text/code/sheet/image) with streaming deltas
6. `updateDocument`: Updates existing artifacts
7. `requestSuggestions`: AI-generated edit suggestions for documents
8. `generateImage`: DALL-E / Gemini image generation, uploads to Vercel Blob

**Token System (Dual):**
1. **Balance-based** (primary, `lib/ai/token-balance.ts`): User.tokenBalance field, deducts BEFORE inference, refunds on partial consumption, full audit trail via TokenBalanceTransaction
2. **Period-based** (legacy, `lib/ai/token-quota.ts`): Per-subscription period aggregation in UserTokenUsage

Flow: `checkTokenQuota()` → `checkBalance()` → inference → `recordTokenUsage()` + `deductBalance()`

**Subscription Tiers** (`lib/subscription/subscription-tiers.ts`):
| Tier | Period | Quota | Messages | Price |
|------|--------|-------|----------|-------|
| tester | daily | 200K | 100/day | Free |
| tester_paid | daily | 200K | 100/day | $0.05 / 5₽ |
| basic_monthly | monthly | 3M | 1,500/mo | $19.99 / 1,999₽ |
| basic_quarterly | 3 months | 9M | 4,500/qtr | $49.99 / 4,999₽ |
| basic_annual | annual | 36M | 18K/yr | $149.99 / 14,999₽ |

Each tier defines: tokenQuota, modelLimits, features (maxFileSize, maxConcurrentChats, searchQuota, searchDepthAllowed, hasReasoningModels, hasPrioritySupport).

### Artifact System

**Types**: `text`, `code`, `sheet`, `image`

**Handler Pattern** (`createDocumentHandler()` factory in `lib/artifacts/server.ts`):
- Server handlers in `artifacts/[type]/server.ts` — use `streamText()`/`streamObject()` for AI output
- Client components in `artifacts/[type]/client.tsx` — ProseMirror (text), CodeMirror (code), React Data Grid (sheet), Image editor (image)
- Data stream events: `data-textDelta`, `data-codeDelta`, `data-sheetDelta`, `data-imageDelta`, `data-finish`, `data-usage`
- Code handler auto-detects programming language from content

### Chat Streaming

**Main Endpoint**: `POST /api/chat` (300s max timeout)
1. Validates token quota/balance before inference
2. Saves user message to Message_v2
3. Builds system prompt with model capabilities + user style + project context
4. Streams via `streamText()` with up to 8 tools, maxSteps calculated per subscription
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
- `DataStreamContext`: AI streaming data for artifact rendering

**Data Fetching**: SWR with key-based cache invalidation. `useChat()` from @ai-sdk/react manages message state.

**Custom Hooks:**
- `useArtifact()` / `useArtifactSelector()`: SWR-based artifact state with metadata
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
Surfaces: chat | auth | api | stream | database | history | vote | document | suggestions
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

### Adding a New Artifact Type
1. Add type to `ArtifactKind` in `lib/types.ts`
2. Create handler in `artifacts/[type]/server.ts` using `createDocumentHandler()` factory
3. Create client component in `artifacts/[type]/client.tsx`
4. Add delta type to `CustomUIDataTypes` in `lib/types.ts`
5. Update `components/artifact.tsx` to render new type

### Modifying Database Schema
1. Update schema in `lib/db/schema.ts`
2. Run `pnpm db:generate` to create migration
3. Run `pnpm db:migrate` to apply changes
4. Update types in `lib/types.ts` if needed

### Adding a New AI Model
1. Add provider import in `lib/ai/models.ts`
2. Define model with capabilities in `chatModels` array
3. Add provider mapping in `lib/ai/providers.ts`
4. Update subscription tier `modelLimits` in `lib/subscription/subscription-tiers.ts`
5. Test quota enforcement and cost tracking

### Adding a New AI Tool
1. Create tool file in `lib/ai/tools/`
2. Define with Zod schema using AI SDK's `tool()` helper
3. Register in the `tools` object in `/api/chat/route.ts`
4. Add tool type to `ChatTools` in `lib/types.ts`
5. Create result renderer component if needed (in `components/`)

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
3. **Token Systems**: Dual system — balance-based (primary, deducts before inference) + period-based (legacy aggregation). Both must be updated
4. **Quota Checks**: Always check quota/balance BEFORE calling AI API to avoid wasted inference
5. **Stream Recovery**: Requires Redis; gracefully degrades without it. 15-second recovery window
6. **Artifact Deltas**: Each type has its own delta event (textDelta, codeDelta, sheetDelta, imageDelta)
7. **Billing Period Renewal**: Automatically handled in `recordTokenUsage()`, don't manually renew
8. **Reasoning Models**: Require `extractReasoningMiddleware` to parse `<think>` blocks
9. **Search Quota**: Checked separately from token quota via `checkSearchQuota()`
10. **Locale**: Currently hardcoded to Russian in `i18n/request.ts`. Browser detection code exists but is commented out
11. **Payment Intent Expiry**: 30-minute hardcoded expiry
12. **Cookie Persistence**: Model, style, project selections stored in cookies — must use server actions to update
13. **ChatSDKError**: Use `new ChatSDKError("type:surface")` for consistent error handling across API routes

## Internationalization (i18n)

- **Library**: next-intl v4 with cookie-based locale detection
- **Locales**: English (`en`), Russian (`ru`). Default: `ru` (currently hardcoded)
- **Translations**: `messages/en.json` and `messages/ru.json`
- **Namespaces**: common, auth, chat, metadata, settings, usage, errors, legal, thinkingSetting, modelList, textStyles, projects
- **Client**: `useTranslations('namespace')` hook
- **Server**: `await getTranslations('namespace')`
- **Switching**: `setUserLocale()` server action updates cookie + user.preferredLanguage in DB
- **Adding translations**: Add keys to both `en.json` and `ru.json`, use `t('key')` in components
- Always use translation keys, never hardcode UI strings

## Refactoring Guidelines
- All code must be TypeScript with strict types
- Components should be < 200 lines
- Business logic goes in /lib or /services, not in components
- Use named exports, not default exports
