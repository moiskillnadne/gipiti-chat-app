# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js 15-based AI chatbot application with multi-provider LLM support (Grok, OpenAI, Google, Anthropic), token quota management, subscription tiers, and artifact (document) creation capabilities. Built with TypeScript, PostgreSQL (Drizzle ORM), NextAuth, and the Vercel AI SDK.

## Development Commands

### Running the Application
```bash
pnpm install              # Install dependencies
pnpm dev                  # Start dev server with Turbopack
pnpm build                # Run migrations + production build
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

## Architecture Overview

### Core Technologies
- **Framework**: Next.js 15 App Router with React Server Components
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: NextAuth v5 (Credentials provider)
- **AI**: Vercel AI SDK with multi-provider gateway
- **Styling**: TailwindCSS 4 + Radix UI + shadcn/ui components
- **State**: React Context + SWR for data fetching
- **Real-time**: Resumable streams backed by Redis

### Directory Structure
```
app/
  (auth)/              # Login/register routes
  (chat)/              # Chat interface + API routes
    api/
      chat/            # Main chat streaming endpoint
      usage/           # Token usage tracking
      subscription/    # Subscription info
      document/        # Document CRUD
lib/
  db/                  # Drizzle schema, queries, migrations
  ai/                  # Models, prompts, tools, token quota logic
  artifacts/           # Artifact handlers (text, code, sheet, image)
  auth/                # NextAuth utilities
components/            # React components (48+ files)
hooks/                 # Custom hooks (useMessages, useArtifact, etc.)
artifacts/             # Artifact-specific handlers and clients
middleware.ts          # NextAuth route protection
```

### Database Schema (Key Tables)

**User & Auth:**
- `User`: id, email, password, currentPlan, timestamps
- `UserSubscription`: userId, planId, billingPeriod, billingPeriodCount, status, external IDs

**Chat & Messages:**
- `Chat`: id, userId, title, visibility (public/private), lastContext (usage JSON)
- `Message_v2`: id, chatId, role, parts (JSON array), attachments, createdAt
- `Vote_v2`: chatId + messageId composite PK, isUpvoted

**Documents & Suggestions:**
- `Document`: id + createdAt composite PK, title, content, kind (text/code/image/sheet), userId
- `Suggestion`: id, documentId + documentCreatedAt FK, originalText, suggestedText, isResolved

**Token Tracking:**
- `SubscriptionPlan`: Defines tiers with tokenQuota, billingPeriod, billingPeriodCount, modelLimits (JSONB), features
- `TokenUsageLog`: Per-message token usage with input/output/cache tokens, costs, modelId
- `UserTokenUsage`: Aggregated usage per user per billing period, modelBreakdown (JSONB)

**Note**: `Message` (deprecated) exists for migration; use `Message_v2` for new code.

### AI Integration

**Model Configuration** (`lib/ai/models.ts`):
- Default models: Grok-2-Vision (chat-model), Grok-3-Mini (chat-model-reasoning)
- Additional providers: OpenAI GPT-5, Google Gemini 2.5 Pro, Claude Opus 4.1
- Models have capabilities: `reasoning` (shows thinking), `attachments` (file uploads)
- Reasoning models wrapped with `extractReasoningMiddleware` to parse `<think>` tags

**System Prompts** (`lib/ai/prompts.ts`):
- `regularPrompt`: Default friendly assistant
- `reasoningPrompt`: Enables explicit chain-of-thought with `<think>` tags
- `artifactsPrompt`: Guides AI to use `createDocument`/`updateDocument` tools for substantial content
- Includes request hints: geolocation data (lat, lon, city, country) from Vercel Edge

**AI Tools** (`lib/ai/tools/`):
- `getWeather`: Weather data retrieval
- `createDocument`: Creates artifacts (text, code, sheet, image) with streaming deltas
- `updateDocument`: Updates existing documents with change descriptions
- `requestSuggestions`: Generates edit suggestions for documents

**Token Quota System** (`lib/ai/token-quota.ts`):
- Uses `TokenLens` library for token counting and cost calculation
- Checks quota BEFORE API call to prevent overages
- Records usage AFTER response with full breakdown (input/output/cache tokens, costs)
- Auto-renews billing periods when expired
- Enforces per-user limits based on subscription tier

**Subscription Tiers** (`lib/subscription/subscription-tiers.ts`):
- **Tester**: 100K tokens/day (free, resets daily for testing)
- **Tester Paid**: 100K tokens/day (paid daily for testing)
- **Basic Monthly**: 2M tokens/month
- **Basic Quarterly**: 6M tokens/quarter (billingPeriod: "monthly", billingPeriodCount: 3)
- **Basic Annual**: 24M tokens/year
- Each tier defines: tokenQuota, billingPeriod, billingPeriodCount, features (max file size, chat limits, API access)
- The `billingPeriodCount` field enables multi-period subscriptions (e.g., 3 months for quarterly)

### Artifact System

**Artifact Types**: `text`, `code`, `image`, `sheet`

**Handler Pattern**:
- Server handlers in `artifacts/[type]/server.ts`:
  - Use `streamObject()` for structured AI outputs
  - Stream deltas to client via data-stream events
  - Auto-save to Document table
- Client components in `artifacts/[type]/client.tsx`:
  - `text`: ProseMirror-based ProseEditor
  - `code`: CodeMirror with syntax highlighting
  - `sheet`: React Data Grid
  - `image`: Image editor

**Data Stream Events**:
- Client receives typed events: `data-kind`, `data-id`, `data-title`, `data-[type]Delta`, `data-finish`, `data-usage`
- Enables progressive rendering as AI generates content
- Transient flags for optimistic UI updates

### Chat Streaming

**Main Endpoint**: `app/(chat)/api/chat/route.ts`
1. Validates token quota before inference
2. Saves user message to `Message_v2`
3. Streams AI response using `streamText()` or `streamObject()`
4. Calls tools based on model capabilities
5. Records usage in `TokenUsageLog` and aggregates in `UserTokenUsage`
6. Uses Redis-backed resumable streams for recovery

**Resumable Streams**:
- Enabled via `resumable-stream` package with Redis
- Stream ID created per chat message
- Client can reconnect mid-stream using `useAutoResume()` hook
- Fallback to non-resumable if `REDIS_URL` not set

### Authentication Flow

**NextAuth Setup** (`app/(auth)/`):
1. User registers → `createUser()` hashes password with bcrypt-ts
2. Login → `authorize()` compares hashes with timing-safe dummy comparison
3. JWT callbacks populate token with user `id` and `type`
4. Session callback exposes user data to frontend
5. Middleware protects `/` and `/chat/:id` routes

**Security Notes**:
- Uses timing-safe authentication to prevent user enumeration
- JWT stored in httpOnly cookies (secure in production)
- NextAuth v5 beta with stricter security defaults

### State Management

**Client-Side Providers** (in root layout):
- `SessionProvider`: NextAuth session
- `DataStreamProvider`: AI streaming data
- `ThemeProvider`: Dark/light mode (next-themes)
- `Toaster`: Toast notifications (Sonner)

**Data Fetching**:
- SWR for cache-first chat history and messages
- Key-based invalidation via `useSWRConfig()`
- `useChat()` from @ai-sdk/react manages message array, streaming state, send/stop/regenerate functions

**Custom Hooks**:
- `useMessages()`: Scroll-to-bottom + message tracking
- `useArtifact()`: Artifact state management
- `useAutoResume()`: Resume interrupted streams
- `useChatVisibility()`: Chat visibility state
- `useScrollToBottom()`: Sticky scroll behavior
- `useMobile()`: Responsive breakpoint detection

### Key Components

**Chat Interface**:
- `components/chat.tsx`: Main chat manager with `useChat()` hook
- `components/messages.tsx`: Message list renderer
- `components/message.tsx`: Individual message with reasoning/votes
- `components/multimodal-input.tsx`: Input with file upload support
- `components/chat-header.tsx`: Metadata + model selector

**Artifacts**:
- `components/artifact.tsx`: Artifact container
- `components/artifact-actions.tsx`: Save/download/share actions
- `components/document-preview.tsx`: Live artifact preview
- `components/diffview.tsx`: Diff visualization for edits

**Specialized**:
- `components/code-editor.tsx`: CodeMirror integration
- `components/message-reasoning.tsx`: Extended thinking display
- `components/model-selector.tsx`: Model picker with capabilities
- `components/usage-hint.tsx`: Token usage hover card (shows usage below chat input)

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
3. Update subscription tier `modelLimits` in `lib/ai/subscription-tiers.ts`
4. Test quota enforcement and cost tracking

### Token Usage Tracking Flow
1. **Before inference**: Check quota with `checkTokenQuota()` → throws if exceeded
2. **After completion**: Call `recordTokenUsage()` with usage data + costs
3. **Aggregation**: Automatically updates `UserTokenUsage` with model breakdown
4. **Renewal**: Auto-creates new period in `renewTokenUsagePeriod()` if expired

### Linting and Formatting
- Project uses **ultracite** (Biome-based linter/formatter)
- Configuration in `.cursor/rules/ultracite.mdc` (detailed accessibility, TypeScript, React rules)
- Key rules enforced:
  - No `any` types
  - Strict accessibility (ARIA, alt text, semantic HTML)
  - No console.log (use proper logging)
  - TypeScript best practices (no enums, explicit types, import type syntax)
  - React patterns (no index keys, hooks rules, functional components)
  - Next.js specific rules (no `<img>`, use Next Image)

## Environment Variables

Required variables (see `.env.example`):
```bash
POSTGRES_URL              # PostgreSQL connection string
REDIS_URL                 # Optional, for resumable streams
AUTH_SECRET               # NextAuth secret (auto-generated in dev)
# AI provider keys handled via Vercel AI Gateway or direct provider SDKs
```

## Testing

- Playwright tests configured with `pnpm test`
- Test environment sets `PLAYWRIGHT=True` to use mock models
- Tests located in standard Playwright directory structure

## Common Gotchas

1. **Message Schema**: Always use `Message_v2`, not deprecated `Message` table
2. **Composite Keys**: `Document` uses (id + createdAt) as PK, not just id
3. **Token Costs**: Must fetch model catalog with TokenLens before calculating costs
4. **Quota Checks**: Always check quota BEFORE calling AI API to avoid wasted inference
5. **Stream Recovery**: Requires Redis; gracefully degrades without it
6. **Artifact Deltas**: Each artifact type has its own delta event (textDelta, codeDelta, etc.)
7. **Billing Period Renewal**: Automatically handled in `recordTokenUsage()`, don't manually renew
8. **Reasoning Models**: Require middleware to extract thinking blocks from response

## Internationalization (i18n)

### Overview
The application supports multiple languages (English and Russian) using **next-intl** v3.24+ with cookie-based locale detection and database persistence.

### Configuration Files
```
i18n/
  config.ts          # Supported locales, locale names, flags
  request.ts         # Server-side i18n configuration
  navigation.ts      # Localized routing helpers
messages/
  en.json            # English translations
  ru.json            # Russian translations
types/
  next-intl.d.ts     # TypeScript type definitions for translations
```

### Translation Structure
Translations are organized into namespaces:
- **common**: Buttons, notifications, navigation
- **auth**: Login, register, validation errors
- **chat**: Chat UI, messages, sidebar
- **metadata**: Page titles and descriptions
- **settings**: Settings UI
- **usage**: Token usage display
- **errors**: Error pages and messages

### Using Translations

**In Client Components:**
```tsx
'use client'
import { useTranslations } from 'next-intl'

function MyComponent() {
  const t = useTranslations('auth.login')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('subtitle')}</p>
    </div>
  )
}
```

**In Server Components:**
```tsx
import { getTranslations } from 'next-intl/server'

async function MyServerComponent() {
  const t = await getTranslations('chat.messages')

  return <p>{t('thinking')}</p>
}
```

**Multiple Namespaces:**
```tsx
const t = useTranslations('auth.login')
const tErrors = useTranslations('auth.errors')

toast({ description: tErrors('invalidCredentials') })
```

### Language Switching

**LanguageSwitcher Component:**
```tsx
import { LanguageSwitcher } from '@/components/language-switcher'

// Use in navigation or settings
<LanguageSwitcher />
```

The component:
- Shows current language with flag emoji
- Updates cookie immediately
- Persists preference to User table (preferredLanguage column)
- Refreshes page to load new translations

### Server Actions

**setUserLocale** (`app/actions/locale.ts`):
- Updates NEXT_LOCALE cookie
- Updates user.preferredLanguage in database
- Returns success/error status

### Locale Detection Flow
1. Middleware checks for `NEXT_LOCALE` cookie
2. Falls back to browser Accept-Language header
3. Falls back to default locale (English)
4. Sets cookie if not present
5. Cookie persists for 1 year

### Adding New Translations

1. **Add keys to English file** (`messages/en.json`):
```json
{
  "myNamespace": {
    "myKey": "My English text"
  }
}
```

2. **Add corresponding Russian translation** (`messages/ru.json`):
```json
{
  "myNamespace": {
    "myKey": "Мой русский текст"
  }
}
```

3. **Use in components**:
```tsx
const t = useTranslations('myNamespace')
return <p>{t('myKey')}</p>
```

### Type Safety
- TypeScript autocomplete works for all translation keys
- Type definitions auto-generated from `messages/en.json`
- Invalid keys cause compile-time errors

### Database Schema
**User table** includes:
- `preferredLanguage`: varchar(8), default 'en'
- Automatically updated when user changes language
- Used to pre-set locale for authenticated users

### Metadata Localization
Update page metadata using translations:
```tsx
import { getTranslations } from 'next-intl/server'

export async function generateMetadata() {
  const t = await getTranslations('metadata.home')

  return {
    title: t('title'),
    description: t('description')
  }
}
```

### AI Prompts Localization
For system prompts that need localization:
1. Add prompt templates to translation files
2. Use `getTranslations()` in server-side AI calls
3. Localize BEFORE streaming starts to avoid hydration issues

### Best Practices
1. **Always use translation keys**, never hardcode UI strings
2. **Add translations for both languages** when adding new features
3. **Use descriptive namespace paths** (e.g., `chat.input.placeholder`)
4. **Keep translations atomic** - one concept per key
5. **Test in both languages** before deploying
6. **Use plural forms** when needed: `{count, plural, one {# item} other {# items}}`
7. **Interpolate variables**: `{username}, welcome back!`

### Migration Checklist
When migrating existing components:
1. Identify all hardcoded strings
2. Create translation keys with appropriate namespaces
3. Add both English and Russian translations
4. Replace strings with `t('key')` or `{t('key')}`
5. Update component to use `useTranslations` or `getTranslations`
6. Test language switching

### Performance Considerations
- Translations loaded server-side (no client bundle bloat)
- Messages passed to client via NextIntlClientProvider
- Cookie-based detection prevents flash of wrong language
- Minimal runtime overhead with tree-shaking

## Related Documentation

- [next-intl Documentation](https://next-intl-docs.vercel.app)
- [Vercel AI SDK Docs](https://ai-sdk.dev/docs/introduction)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Drizzle ORM](https://orm.drizzle.team)
- [NextAuth v5](https://authjs.dev)
- [Project README](./README.md)
