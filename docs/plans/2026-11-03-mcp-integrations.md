---
date: 2026-11-03
status: in_progress
milestones_done: [M1]
branch: feat/gipiti-28-mcp-integrations-cw6f0r
issue: GIPITI-28
adr: docs/adr/0001-mcp-integrations.md
---

# MCP integrations in GIPITI (GIPITI-28)

## Goal

A paid user opens `/integrations` and connects remote MCP servers:

- curated built-ins: DeepWiki, Context7, Linear, GitHub, Yandex Wiki;
- any custom server URL, with an optional static header token.

The user then picks integrations in the composer for a chat. The model calls their tools. The
chat shows each call in the existing run-card. Write actions wait for an explicit confirm on a
card. Tokens are stored encrypted. Disconnect and reconnect work.

The decisions and their reasons are in `docs/adr/0001-mcp-integrations.md`. This plan is the "how".

### Hard invariants (every task must preserve these)

1. **Non-MCP turns are byte-identical to today.** Same tools array, prompt, telemetry and bill.
   The only change on that path is one array-length check.
2. **MCP `execute` never throws.** It resolves `{ ok: false, error }` for stop, timeout,
   transport, auth or budget failures. MCP calls never change billing code.
3. **No secret leaves `lib/integrations/crypto.ts` unsealed except into an outgoing header.**
   Secrets never go into a log, a span, a stream part, a client prop or a `Message_v2` row.
4. **No server text reaches the model unsanitised.** This covers descriptions and schemas, and
   server `instructions` are never forwarded.
5. **The tools array is stable within a turn.** No new `activeTools` mutations. Guards live in
   `execute`.

### Deferred (not in this plan)

- **Notion, Atlassian, Google (Gmail, Calendar, Drive), Slack and Figma.** Reasons: reachability
  from Russia, legal risk, or an app review that blocks the MVP.
- **stdio servers.** They are impossible on the web.
- **An audit log table, drift cron, key-ring HKDF, CSP rollout and drift-review UI.** Pending
  action rows and `needs_review` are enough at this scale.
- **A hosted GIPITI OAuth app for Yandex.** The MVP uses a pasted token.
- **MCP sampling, elicitation, resources and prompts.** Not advertised.
- **Per-call pricing of MCP calls.** The tokens are already billed. See the PO question.
- **MCP in image and video handlers.**

## Architecture summary

```
lib/integrations/
  catalog.ts           static built-in catalog (URL, header descriptor, scopes, allowlist,
                       read/write class, our descriptions, sensitivity)
  tool-names.ts        stable mangled names, <=64 chars, [a-zA-Z0-9_], collision-safe
  sanitize.ts          definition sanitiser + snapshot hash
  json-schema.ts       provider-safe schema normaliser
  client.ts            createMCPClient factory (no sampling/elicitation, guarded fetch)
  snapshot.ts          tools/list -> allowlist -> sanitise -> normalise -> snapshot
  turn-plan.ts         buildIntegrationTurnPlan -> { tools, close() }  (text-chat derives hasPlanTools)
  result.ts            CallToolResult -> bounded text output
  history.ts           flattenOrphans, compactMcpHistory, applyActionOutcomes (pure)
  policy.ts            paid + flag + model gates; mixed-chat write filter
  taint.ts             hasPrivateMcpResult, userProvidedUrls (pure)
  crypto.ts            AES-256-GCM seal/open with kid + AAD          (M2)
  safe-fetch.ts        undici SSRF guard                              (M2)
  oauth-provider.ts    Postgres-backed OAuthClientProvider            (M2)
  refresh.ts           lease + tokenVersion CAS refresh               (M2)
  pending-actions.ts   propose/commit for write tools                 (M3)
```

**Chat turn.** Every step below is skipped unless `integrationIds` is non-empty, except the
telemetry rule, which also applies when the history holds MCP parts.

1. `schema.ts` accepts `integrationIds`.
2. `prepare-chat-turn.ts` runs the gate (`policy.ts`) in parallel with its existing reads. A
   failed gate drops the ids silently and logs the reason code; it never errors the turn
   (`resolveAllowedIntegrationsSafe` catches gate errors as reason `error`). `filterWriteTools`
   runs in `policy.ts` on the loaded rows. The per-turn budget drops whole connections: the
   count and the token estimate cover all enabled tools of a connection.
3. `text-chat.ts` builds the turn plan and merges `plan.tools` after `chatTools`. It then
   - runs the history helpers before `convertToModelMessages`;
   - adds 3 to the step limit;
   - sets `recordInputs: false` and `recordOutputs: false` when MCP content is in play;
   - calls `plan.close()` on `onFinish`, on the `consumeStream().finally`, on
     `turnAbort.onForcedAbort`, and from a deadline timer.

## Files that change

| Area | Files |
|---|---|
| Chat route | `app/(chat)/api/chat/route.ts` (passes `deadlineAt`), `app/(chat)/api/chat/schema.ts`, `_lib/context.ts`, `_lib/prepare-chat-turn.ts`, `_lib/handlers/text-chat.ts`, `_lib/turn-abort.ts`, `_lib/__tests__/turn-lifecycle.test.ts`, `_lib/__tests__/text-chat-integrations.test.ts` |
| Tools | `lib/ai/tools/extract-url.ts` (taint guard, M2) |
| Models | `lib/ai/models.ts` (`capabilities.mcp`, `supportsMcp`), `lib/ai/__tests__/model-registry.test.ts` |
| DB | `lib/db/schema.ts`, `lib/db/migrations/0046_integration_connection.sql`, `0047_integration_credentials.sql`, `0048_integration_pending_action.sql`, `lib/db/migrations/meta/_journal.json`, `lib/db/query/integration/*` |
| New lib | `lib/integrations/*` (above, plus `availability.ts`, `ui.ts`), `lib/integrations/__tests__/*` |
| Flags | `lib/flags.ts` (`isIntegrationsEnabled`), `app/.well-known/vercel/flags/route.ts` |
| Page | `app/integrations/{layout,page,actions}.tsx|ts`, `app/integrations/_components/*`, `components/account-page-top-nav.tsx`, `proxy.ts` (`PROTECTED_ROUTE_PATTERNS`) |
| OAuth routes | `app/api/integrations/oauth/callback/route.ts`, `app/oauth/client-metadata.json/route.ts` (CIMD) |
| Chat UI | `lib/types.ts` (`McpToolUIPart` + guard), `lib/messages/group-tool-runs.ts` (+ `lib/messages/__tests__/group-tool-runs.test.ts`), `components/tool-run-renderer.tsx`, `components/tool-run-mcp-step.tsx`, `hooks/use-integration-selection.ts`, `components/composer/integrations-picker.tsx`, `components/multimodal-input.tsx`, `components/chat.tsx`, `components/elements/response.tsx` (image guard), `components/integration-action-card.tsx` (M3) |
| i18n | `messages/ru.json` (`integrations` namespace) |
| Config | `package.json` (`@ai-sdk/mcp@1.0.101`, `undici@7.16.0`, pinned exact), `scripts/check.ts` (placeholder key), `.env.example`, `CLAUDE.md` |

## Order of work

**M1 to M4, strictly in order.** Inside a milestone, follow the task order unless a task lists no
dependency.

| Gate | What must be true | Blocks |
|---|---|---|
| G0 | Run the schema eval (M1-T11) against the candidate models | Turning the flag on for anyone but testers |
| G1 | A real Linear CIMD exchange works | M2-T10 |
| G2 | A GitHub App token is accepted by the remote server | The GitHub OAuth path in M4-T1. The PAT path is not gated |
| G3 | The PO has answered the questions | Wider rollout |

**Rollout.**

1. Flag on for testers after M1.
2. Allowlisted paid users, read-only, after M2.
3. Everyone paid after M3, plus G3.

## Go/no-go gates (human, outside implementer tasks)

- **G0, schema eval.**
  - Run `npx tsx scripts/integrations/schema-eval.ts --models <ids> --yes [--entries ...]` with a
    real `AI_GATEWAY_API_KEY` (`--models` is required). It costs a few cents.
  - **Status: not run yet** (no key in the cloud session; `ai-gateway.vercel.sh` is also not in the
    session's allowed hosts). Until G0 passes, the flag stays tester-only and `capabilities.mcp`
    on the Claude / GPT-5.x list is provisional.
  - Before the M1 smoke, run `npx tsx scripts/integrations/probe-server.ts <url>` for DeepWiki and
    Context7 and check the catalog allowlist (`ask_wiki_question`, `query-docs`) against the live
    `tools/list`. DeepWiki docs list `ask_question`; old Context7 used `get-library-docs`. The
    cloud session could not reach these hosts, so this is unverified.
  - Result table (fill in after the run):

    | Model | DeepWiki | Context7 | Keep `mcp`? |
    |---|---|---|---|
    | _pending_ | | | |
  - Keep `capabilities.mcp` only on models that accept every built-in snapshot schema.
  - Record the result table in this plan.
- **G1, Linear.**
  - Test against `https://mcp.linear.app/mcp/readonly` with a test workspace and the production
    CIMD URL.
  - Complete authorize, code exchange and refresh. Record:
    - access-token lifetime;
    - whether the refresh token rotates;
    - whether `resource` is required on refresh.
  - Repeat from a Russian network.
  - Fallback: shared DCR registration. If Linear is unreachable from Russia, it ships as a
    "may require VPN" catalog entry or is dropped (PO decision).
- **G2, GitHub.**
  - Register the GitHub App with read-only permissions and expiring user tokens.
  - Check that `api.githubcopilot.com/mcp/readonly` accepts its user-to-server token.
  - Measure the `tools/list` size for the curated `X-MCP-Toolsets`.
  - Fallback: PAT only.
- **G3, PO answers.** See `questionsForUser` in the research output.

## Risks

| Risk | Mitigation |
|---|---|
| `onInputStart` is awaited inside the `ai` stream transform (`ai/dist/index.mjs:6878`) | Fire-and-forget in `onInputStart`, with a `.catch` attached. `execute` awaits the memoised connect. Covered by a test that asserts `onInputStart` returns synchronously. |
| Tool names rejected by a provider (64 chars, charset, Gemini's first-character rule) | `tool-names.ts` mangler with tests. Names are stored in the snapshot and never recomputed. |
| Anthropic rejects `tool_use` history when the tool is not defined | `flattenOrphans` turns parts for integrations not in this turn's plan, or for models without `capabilities.mcp`, into text. |
| Prompt-injected exfiltration via `extractUrl` or markdown images | The chat-scoped taint rule (M2-T4) ships before any private-sensitivity integration (M2-T10, custom servers in M2-T6). Residual: search queries and links that need a click. Documented. |
| A provider rejects a schema keyword | `json-schema.ts` normaliser, the `capabilities.mcp` allowlist and the G0 eval. |
| Vendor tool renames (DeepWiki already did) | A missing allowlisted tool sets `needs_review`, logs `[integrations-drift]`, and the user gets a "Refresh tools" action. Note: one missing allowlisted tool makes the whole connection unusable, and refresh cannot clear it without a catalog change. |
| Refresh race across instances | Lease plus CAS (M2-T8), single statements only. |
| Key loss or misconfiguration | A missing key means the flag is evaluated as off server-side and connect returns a friendly error. A self-test decrypt runs on first use per instance. |
| MCP content in spans or logs | Telemetry rule (M1-T8). `onError` for MCP turns logs `{ code, integrationId }` only. |
| The chat route's long `maxDuration` (800 s) hides runaway MCP loops | Per-turn budget of 8 calls and 20 s per call. `close()` runs on a deadline timer. |
| Free or lapsed users keep tool access | Gate reads the DB every turn, and the confirm action re-runs the gate. |

## Verification

- **Every task:** `pnpm check` green. Tests follow AAA and live in `__tests__/` so Vitest picks
  them up.
- **Unit tests (new):**
  - `lib/integrations/__tests__/`: `tool-names`, `sanitize`, `json-schema`, `result`,
    `history`, `policy`, `taint`, `crypto`, `safe-fetch` (blocklist logic with an injected
    lookup), `refresh` (mocked queries), `turn-plan` (mocked client), `pending-actions`.
  - `_lib/__tests__/turn-lifecycle.test.ts`: three new cases.
    1. An MCP tool honours `stopRequested`: abort at the step boundary with
       `steps: 1, atStepBoundary: true`. This test must fail before M1-T5.
    2. An MCP tool and `generateImage` in one step: the gate still holds.
    3. A tool that ignores the signal still reaches the forced path.
  - `model-registry.test.ts`: `mcp` implies `toolCalling !== false`.
- **E2E (Playwright, M4-T4):**
  - `/integrations` returns 404 with the flag off, shows the paywall card for a free user, and
    shows the catalog for a paid tester.
  - No live MCP calls in CI.
- **Manual smoke per milestone**, on a preview with the flag on for the tester:
  - M1: connect DeepWiki, select it, ask about a public repo; the run-card shows the call; Stop
    mid-call ends within 1 s; the balance is charged once.
  - M2: custom URL with a bearer token; Linear OAuth connect, revoke and reconnect; check a
    tainted `extractUrl` refusal.
  - M3: a write proposal, then confirm, deny, and expire after a new message.
- **Billing check after M1:** compare a non-MCP turn's charge and logged usage before and after
  the change on the same prompt. They must be equal.

## Tasks

### M1 — No-auth integrations end to end (flag-gated vertical slice)

Outcome: a paid tester with the flag on connects DeepWiki or Context7 on `/integrations`, selects
it in the composer, and the model calls its tools. The run-card shows the call, and Stop works at
once.

#### M1-T1 — Dependency, flag and model capability

- **Files:**
  - `package.json` and lockfile: add `@ai-sdk/mcp` pinned to exactly `1.0.101`.
  - `lib/flags.ts`: add `isIntegrationsEnabled`, `flag<boolean, UserEntities>`, default `false`.
    Copy the `isTopupEnabled` pattern, fail closed.
  - `app/.well-known/vercel/flags/route.ts`: add it to `getProviderData`.
  - `lib/ai/models.ts`: add `mcp?: boolean` to `ChatModelCapabilities`, and
    `supportsMcp(modelId): boolean` (true only when `capabilities.mcp === true` and tool calling
    is supported).
    - Set `mcp: true` on a conservative initial list: the current visible Claude Sonnet, Opus and
      Haiku entries, and the current visible GPT-5.x entries.
    - Leave Gemini, Grok, DeepSeek and the rest off until G0.
  - `lib/ai/__tests__/model-registry.test.ts`: assert that every `mcp: true` model has tool
    calling and `isVisibleInUI`.
- **Acceptance:** `pnpm check` green. `supportsMcp` is unit tested for true, false and unknown id.
- **Depends on:** none.

#### M1-T2 — `IntegrationConnection` table (migration 0046) and queries

- **Files:**
  - `lib/db/migrations/0046_integration_connection.sql`, hand-written, `IF NOT EXISTS`
    everywhere.
  - `meta/_journal.json`: `idx` 46, `when` greater than 1792322105448, tag
    `0046_integration_connection`.
  - `lib/db/schema.ts`.
  - `lib/db/query/integration/{list-for-user,get-by-ids-for-user,insert,delete,update-snapshot,update-status}.ts`.
- **Columns:**

  | Column | Type |
  |---|---|
  | `id` | uuid PK, default random |
  | `userId` | FK to `User`, on delete cascade |
  | `provider` | varchar: catalog id or `custom` |
  | `displayName` | text |
  | `serverUrl` | text |
  | `authType` | `none`, `oauth`, `static_header` |
  | `authHeaderName`, `authHeaderScheme` | text, nullable |
  | `staticHeaders` | jsonb, default `{}` |
  | `status` | `active`, `needs_reauth`, `needs_review`, `error`; default `active` |
  | `trustLevel` | `builtin`, `custom` |
  | `allowWrites` | bool, default false |
  | `accessTokenExpiresAt` | timestamptz, nullable |
  | `scopes` | text, nullable |
  | `toolSnapshot` | jsonb |
  | `toolSnapshotHash` | text |
  | `toolSnapshotAt` | timestamptz |
  | `toolTokenEstimate` | int |
  | `enabledTools` | jsonb array |
  | `readOnlyToolNames` | jsonb array |
  | `createdAt`, `updatedAt`, `lastUsedAt` | timestamps |

- **Indexes:**
  - partial unique `(userId, provider) WHERE trustLevel='builtin'`;
  - partial unique `(userId, lower(serverUrl)) WHERE trustLevel='custom'`;
  - `(userId, status)`.
- **Queries:** every query filters by `userId`. They select explicit columns, and the
  chat-path query returns only snapshot fields.
- **Types:** export `IntegrationConnection` and `ToolSnapshotEntry` (`{ name: string;
  originalName: string; description: string; inputSchema: JSONSchema7; toolClass: "read" |
  "write" }`), with no `any`.
- **Acceptance:** `pnpm check` green. The SQL runs twice without error, checked by reading the
  SQL; do not run `db:migrate` against any shared DB.
- **Depends on:** none.

#### M1-T3 — Pure building blocks: tool names, sanitiser, schema normaliser

- **Files:** `lib/integrations/tool-names.ts`, `sanitize.ts`, `json-schema.ts`, and tests in
  `lib/integrations/__tests__/`.
- **`tool-names.ts`:**
  - `toModelToolName({ slug, originalName, taken })` returns `mcp_<slug>__<name>`.
  - Characters outside `[a-zA-Z0-9_]` become `_`.
  - The result is at most 64 characters. When truncated or colliding with `taken`, it gets a
    6-hex suffix from sha256 of the original.
  - The slug is the catalog id for built-ins and `c<first 6 hex of connection id>` for custom.
    It is never derived from user text.
  - `isMcpToolName(name)` and `parseMcpPartType(type)`.
- **`sanitize.ts`:**
  - `sanitizeDefinition({ name, description, inputSchema })` strips `\p{Cf}`, C0/C1 controls
    except `\n` and `\t`, bidi characters and U+E0000–E007F.
  - It caps descriptions at 1,000 characters and schemas at 4 KB of serialised JSON. An
    over-size schema means the tool is rejected, with a reason.
  - `hashDefinitions(entries)` is sha256 over a canonical JSON of `(name, description, schema)`
    sorted by name.
- **`json-schema.ts`:**
  - `normalizeInputSchema(schema)`:
    - inline local `$ref` and `$defs`, max depth 5; on cycles, reject;
    - drop `$schema`, `format`, `pattern`, `minimum`, `maximum`, `minLength`, `maxLength`,
      `examples` and `default`;
    - make `type: "object"` default `properties: {}`;
    - turn `type: [x, "null"]` into `type: x` with `nullable: true`;
    - flatten a single-branch `anyOf` or `oneOf`;
    - force a root `type: "object"`.
- **Acceptance:** each function has tests covering the edge cases above: a 70-character name, a
  collision, a Cyrillic name, a tag-block payload, a `$ref` cycle, `type: ["string","null"]`.
  `pnpm check` green.
- **Depends on:** none.

#### M1-T4 — Catalog, MCP client factory, snapshot capture

- **Files:** `lib/integrations/catalog.ts`, `client.ts`, `snapshot.ts`, `result.ts`, tests.
- **`catalog.ts`:**
  - Type `CatalogEntry = { id; serverUrl; readWriteServerUrl?; authType; header?: { name; scheme
    }; staticHeaderKeys?: string[]; oauth?: { scope: string }; sensitivity: "public" | "private";
    tools: Record<originalName, { toolClass; description: string }> }`.
  - M1 entries:
    - `deepwiki` (`https://mcp.deepwiki.com/mcp`): `ask_wiki_question`, `read_wiki_contents`,
      `read_wiki_structure`.
    - `context7`: its 2 tools, with short English model-facing descriptions written by us.
  - UI labels and descriptions go in `messages/ru.json` under `integrations.catalog.<id>`.
- **`client.ts`:**
  - `openMcpClient({ serverUrl, headers, fetch, signal })` creates `createMCPClient` with a
    Streamable HTTP transport.
  - It sends `Accept: application/json, text/event-stream`, advertises no sampling or
    elicitation, uses a 5 s connect timeout, and never reads `instructions`.
  - `fetch` defaults to global fetch in M1; M2-T3 swaps it to `safeFetch`.
- **`snapshot.ts`:**
  - `captureToolSnapshot({ entry | customConfig, headers })` runs `listTools`, filters to the
    allowlist (custom: all tools), sanitises and normalises, and assigns names via
    `tool-names.ts`.
  - It returns `{ snapshot, hash, tokenEstimate (chars/4), missingAllowlisted: string[] }`.
- **`result.ts`:**
  - `toModelOutput(callToolResult)` keeps `text` content.
  - `image`, `audio` and `resource` content become `[non-text content omitted: <mime>]`.
  - It joins the text, truncates to 8,000 characters with a marker, and sets `isError` to
    `{ ok: false, error: "tool_error", message }`, with the message truncated to 500 characters.
- **Acceptance:**
  - Unit tests with a fake `MCPClient`: allowlist filtering, `missingAllowlisted`, truncation,
    image omission.
  - No network in tests.
  - `pnpm check` green.
- **Depends on:** M1-T1, M1-T3.

#### M1-T5 — `TurnAbort.stopRequested`

- **Files:** `app/(chat)/api/chat/_lib/turn-abort.ts`, `_lib/__tests__/turn-lifecycle.test.ts`.
- **Change:**
  - Add `readonly stopRequested: AbortSignal` from a second `AbortController`.
  - Abort it with `new DOMException("user-stop", "AbortError")` as the first statement of
    `requestAbort()`, before `flush()`.
  - Do not change the gate, the force timer or `dispose`.
  - Update the header comment to explain why tools with no GIPITI-side cost may honour it.
- **Tests:** write them first and confirm they fail.
  1. Use the real `createTurnAbort`, `createTurnLifecycle` and `createInFlightStepTracker` with
     `streamText` and `MockLanguageModelV3`. A tool resolves `cancelled_by_user` when
     `stopRequested` fires. Stop at 300 ms gives `billAborted` with `steps: 1` and
     `atStepBoundary: true`, and no forced abort.
  2. The same, plus a `generateImage`-named tool pending: the gate holds until it returns.
  3. A tool that ignores the signal: the forced path runs at `DEFERRAL_CAP_MS`.
- **Acceptance:** the three tests pass, and the existing lifecycle tests are unchanged and green.
- **Depends on:** none.

#### M1-T6 — Turn plan

- **Files:** `lib/integrations/turn-plan.ts`, `lib/integrations/policy.ts`, tests.
- **`policy.ts`:**
  - `resolveAllowedIntegrations({ userId, modelId, requestedIds })` returns
    `{ connections, reason? }`.
  - It checks, in order: the flag (`isIntegrationsEnabled`), `!isFreeUserById(userId)`,
    `supportsMcp(modelId)`, then loads with `get-by-ids-for-user` and filters
    `status = 'active'`.
  - An empty `requestedIds` returns at once with no DB access.
  - In M1, `filterWriteTools` keeps read-class tools only. Writes arrive in M3.
- **`turn-plan.ts`:**
  - `buildIntegrationTurnPlan({ connections, turnSignal, stopRequested })` returns
    `{ tools: Record<string, Tool>; close: () => Promise<void> }`.
  - **Tools:** one `tool()` per enabled snapshot entry, sorted by name, using
    `jsonSchema(entry.inputSchema)`.
  - **Budgets:** at most 25 tools and `toolTokenEstimate` sum ≤ 6,000 per turn. Over budget,
    later connections are dropped and logged.
  - **Connect:** one memoised `connect()` per connection.
  - **`onInputStart`:** calls `void connect().catch(noop)` and returns synchronously, never
    awaiting.
  - **`execute`:**
    1. Check the per-turn call budget (8); over it, resolve
       `{ ok: false, error: "budget_exceeded" }`.
    2. `await connect()`.
    3. Call
       `client.toolsFromDefinitions(snapshotDefs)[originalName].execute(args, { abortSignal })`
       with `AbortSignal.any([turnSignal, stopRequested, AbortSignal.timeout(20_000)])`.
    4. Map the result through `result.ts`.
    5. Catch everything and map it to `cancelled_by_user`, `timeout`, `connect_failed`,
       `unauthorized` or `tool_error`.
  - **`close()`:** idempotent, closes every opened client, and swallows and logs close errors
    with context.
- **Tests (fake client factory injected):**
  - `onInputStart` returns before connect resolves.
  - `execute` without a prior `onInputStart` still connects.
  - Stop resolves `cancelled_by_user` within one tick.
  - Timeout resolves `timeout`.
  - The ninth call is budget-refused.
  - A double `close()` is safe.
  - The policy short-circuits on empty ids, the flag off, a free user and a non-MCP model.
- **Acceptance:** `pnpm check` green.
- **Depends on:** M1-T2, M1-T4, M1-T5.

#### M1-T7 — History helpers (pure)

- **Files:** `lib/integrations/history.ts`, tests.
- **`flattenOrphans(messages, { activeToolNames, modelSupportsMcp })`:**
  - Applies to every `tool-mcp_*` part whose name is not in `activeToolNames`, or to all MCP
    parts when the model has no MCP.
  - Such a part becomes a `text` part: `[<integration label> · <tool>: <first 600 chars of
    output or "no result">]`.
- **`compactMcpHistory(messages)`:** truncates `output` of MCP parts older than the last two user
  turns to 600 characters with a marker.
- **`hasMcpParts(messages)`.**
- All three return new arrays and never mutate.
- **Acceptance:**
  - Tests for no MCP parts (same reference returned), orphan flattening, compaction boundary and
    immutability.
  - `pnpm check` green.
- **Depends on:** M1-T3.

#### M1-T8 — Chat route wiring

- **`app/(chat)/api/chat/schema.ts`:** `integrationIds: z.array(z.string().uuid()).max(5)
  .optional()`.
- **`_lib/context.ts`:** `integrationConnections: IntegrationConnection[]` (snapshot columns
  only).
- **`_lib/prepare-chat-turn.ts`:** call `resolveAllowedIntegrations` inside the existing
  `Promise.all` only when ids are present.
  The route passes `deadlineAt` (start + `maxDuration` - `DEADLINE_MARGIN_MS`) through
  `prepareChatTurn` onto `ctx.deadlineAt`, which the handler uses for the close timer.
- **`_lib/handlers/text-chat.ts`:**
  - Build the plan when `integrationConnections.length > 0 && supportsToolCalling(model)`.
  - Apply `flattenOrphans` and `compactMcpHistory` to `messagesForModel` only when
    `hasMcpParts(ctx.uiMessages)`.
  - `tools: { ...chatTools, ...plan.tools }`.
  - Step limit: `stepLimit + 3` when the plan has tools. Pass it through `ctx` or a local, and
    keep the `prepareStep` last-step logic consistent.
  - `experimental_telemetry`: `recordInputs: false` and `recordOutputs: false` when the plan has
    tools or `hasMcpParts`.
  - `onError`: for MCP turns log `{ chatId, code: error.name }` only.
  - `close()` on `onFinish`, the `consumeStream().finally`, `turnAbort.onForcedAbort`, and a
    `setTimeout(close, maxDurationMs - DEADLINE_MARGIN_MS)` timer, unref'd and cleared on close.
- **Acceptance:**
  - A unit test, or an extended handler test if one exists, shows that with no
    `integrationIds` the `streamText` call receives the identical `tools` key set and
    telemetry as before.
  - `pnpm check` green.
- **Depends on:** M1-T6, M1-T7.

#### M1-T9 — Chat UI: types, run-card, composer picker

- **`lib/types.ts`:** `McpToolUIPart` type (a `tool-mcp_${string}` template literal, plus
  `state`, `input`, `output`), and `isMcpToolPart(part): part is McpToolUIPart`. No `any`.
- **`lib/messages/group-tool-runs.ts`:** no change in M1 (`startsWith("tool-")` already groups).
  Add a test that MCP parts group.
- **`components/tool-run-renderer.tsx`:** a `buildStep` case for MCP parts.
  - Label: `t("integrations.run.call", { integration, tool })`.
  - Error variant for `{ ok: false }`, with error codes mapped to i18n strings.
  - Each status variant in its own keyed element (gotcha 12).
- **`components/composer/integrations-picker.tsx`:**
  - A popover listing the user's active connections (SWR from a server action
    `listMyIntegrations`), with checkboxes and token estimates.
  - Disabled, with a hint, when `!supportsMcp(selectedModel)`.
  - Hidden when the flag is off or the user is free. The server passes `isIntegrationsAvailable`.
  - Copy advises against changing the selection mid-chat.
- **`components/multimodal-input.tsx` and `components/chat.tsx`:**
  - The selection lives in a ref, like `webSearchEnabledRef`, keyed per chat id in
    `localStorage`. Wrap storage access in try/catch.
  - Send `integrationIds` in `prepareSendMessagesRequest`.
- **`messages/ru.json`:** the `integrations` namespace.
- **Implementation notes (as built):**
  - `listMyIntegrations` is implemented for real in `app/integrations/actions.ts`; M1-T10 extends that
    file instead of creating it.
  - Pure helpers (part-name parsing, failure reading, stored-selection parsing) are in
    `lib/integrations/ui.ts`; the selection hook is `hooks/use-integration-selection.ts`, owned by
    `Chat` and passed to `MultimodalInput` as `integrationSelection` (absent when unavailable).
  - The chat pages compute `isIntegrationsAvailable` via `lib/integrations/availability.ts`.
  - The MCP run-card row lives in `components/tool-run-mcp-step.tsx` to keep the renderer small.
- **Acceptance:** component files under 200 lines, no hardcoded strings, `pnpm check` green.
- **Depends on:** M1-T8. The server action comes from M1-T10; until then, stub it in the same PR
  or order T10 first.

#### M1-T10 — `/integrations` page with no-auth connect

- **Files:**
  - `app/integrations/layout.tsx` and `page.tsx`, mirroring the `app/subscription` layout and
    `AccountPageTopNav`.
  - `app/integrations/actions.ts`.
  - `app/integrations/_components/{catalog-grid,integration-card,paywall-card}.tsx`.
  - `components/account-page-top-nav.tsx`: add the `integrations` key.
  - `proxy.ts`: add `/^\/integrations$/` to `PROTECTED_ROUTE_PATTERNS`.
- **Page:**
  - `auth()` guard; `notFound()` when the flag is off.
  - The paywall card when `isFreeUserById`.
  - Otherwise the catalog: built-ins with status, connect and disconnect.
- **Server actions** (Next's built-in Origin check; each one calls `auth()`, validates input with
  zod and re-checks the flag and paid status):
  - `connectBuiltinNoAuth(catalogId)`: `captureToolSnapshot`, then insert. On
    `missingAllowlisted.length > 0`, set `needs_review` and log `[integrations-drift]`.
  - `disconnectIntegration(id)`.
  - `refreshIntegrationTools(id)`: re-snapshot.
  - `listMyIntegrations()`.
  - Errors return user-friendly i18n keys, never raw messages.
- **Implementation notes (as built):**
  - Connect, disconnect and refresh logic lives in `lib/integrations/connect.ts` (tested in
    `__tests__/connect.test.ts`); `actions.ts` only does `auth()`, the flag and paid gate
    (`isIntegrationsAvailableForUser`), zod validation and `revalidatePath`.
  - Actions return `{ ok: true } | { ok: false, error }`; `error` is a key under
    `integrations.page.errors`. `connectBuiltinNoAuth` stores the localised catalog name as
    `displayName` and lists only `authType: "none"` entries on the page.
  - `listMyIntegrations` now returns `[]` when the flag is off or the user is free.
  - `refreshIntegrationTools` keeps the user's disabled tools and enables tools new to the snapshot.
  - `layout.tsx` only sets metadata (noindex); no `SessionProvider`, the page needs none.
- **Acceptance:** `pnpm check` green. Manual: a tester connects DeepWiki and sees it in the
  picker.
- **Depends on:** M1-T2, M1-T4.

#### M1-T11 — Schema eval and probe scripts (for G0)

- **Files:** `scripts/integrations/probe-server.ts`, `scripts/integrations/schema-eval.ts`.
- **`probe-server.ts <url> [--header k:v]`:** prints the `tools/list` names, sizes, the token
  estimate and the sanitised, normalised snapshot. It never prints header values.
- **`schema-eval.ts`:**
  - For each catalog entry's snapshot (captured live) and each model in a CLI list, call
    `generateText` through the gateway.
  - Use a trivial prompt with `toolChoice: "auto"` and `maxOutputTokens: 16`.
  - Print an accept/reject table.
  - Refuse to run without an explicit `--yes` (it costs money).
- **Acceptance:** typechecks, and is not part of unit tests. `pnpm check` green.
- **Depends on:** M1-T4.

### M2 — Secrets, custom MCP by URL, taint rule, Linear OAuth

#### M2-T1 — Sealing (`crypto.ts`)

- **Files:** `lib/integrations/crypto.ts`, tests, `scripts/check.ts` (placeholder
  `INTEGRATIONS_ENCRYPTION_KEY_1` and `INTEGRATIONS_ENCRYPTION_KEY_ID=1`), `.env.example`.
- **Functions:**
  - `seal({ plaintext, userId, connectionId, column })` returns
    `{ keyId, blob: base64(iv|tag|ct) }`.
  - `open(...)` reverses it.
  - The cipher is AES-256-GCM with a 12-byte random IV, and AAD `kid|userId|connectionId|column`.
- **Keys:**
  - Read from `INTEGRATIONS_ENCRYPTION_KEY_<kid>`, a base64 32-byte key, with the current kid
    from `INTEGRATIONS_ENCRYPTION_KEY_ID`.
  - Custom error `IntegrationCryptoError`.
  - `isIntegrationCryptoConfigured()` is used by the policy to fail closed.
- **Acceptance:** tests for round-trip, a wrong AAD (user, connection or column), a tampered
  tag, a missing key, and an unknown kid. `pnpm check` green.
- **Depends on:** none.

#### M2-T2 — Migration 0047: credentials and OAuth state

- **Files:** `0047_integration_credentials.sql`, journal, `schema.ts`,
  `lib/db/query/integration/{credential-*,oauth-state-*}.ts`.
- **`IntegrationCredential`:**
  - `connectionId` is the PK, an FK with cascade.
  - Columns: `sealedBlob` text, `keyId` text, `tokenVersion` int default 0,
    `refreshLeaseUntil` timestamptz nullable, `updatedAt`.
- **`IntegrationOAuthState`:** `stateHash` PK, `userId`, `provider`, `sealedPayload`,
  `expiresAt`.
- **Queries:**
  - `consumeOAuthState(hash, userId)` is
    `DELETE … WHERE stateHash=$1 AND expiresAt>now() RETURNING`.
  - `insertOAuthState` also deletes expired rows for that user in the same statement or right
    before it. No cron change.
- **Acceptance:** `pnpm check` green.
- **Depends on:** M1-T2.

#### M2-T3 — SSRF-guarded fetch

- **Files:** `package.json` (`undici` exact `7.16.0`), `lib/integrations/safe-fetch.ts`, tests,
  `client.ts` (default `fetch` becomes `safeFetch`).
- **`isBlockedAddress(ip)`:** a `node:net` `BlockList` covering `0/8`, `10/8`, `100.64/10`,
  `127/8`, `169.254/16`, `172.16/12`, `192.168/16`, `fc00::/7`, `fe80::/10`, `::1` and `::`,
  plus IPv4-mapped IPv6.
- **`safeFetch`:**
  - `undici.fetch` with an `Agent` whose `connect.lookup` resolves all addresses and rejects if
    any is blocked.
  - `https:` and port 443 only; no URL credentials.
  - `redirect: "error"`.
  - 5 s connect and 10 s headers timeouts.
  - A streaming 1 MB body cap that errors with `RESPONSE_TOO_LARGE`.
  - Custom error `UnsafeUrlError`.
- **Custom URL validation:** `validateCustomServerUrl(url)` is the pure pre-check used by forms.
- **Acceptance:**
  - Unit tests on `isBlockedAddress` and `validateCustomServerUrl`: decimal, octal, mapped and
    bracketed IPv6 forms; `http`; `:8443`; `user:pass@`.
  - Body-cap test with a local `ReadableStream`.
  - No network in unit tests.
  - `pnpm check` and `next build` green, with no `serverExternalPackages` change needed.
- **Depends on:** M1-T4.

#### M2-T4 — Taint rule and chat-scoped image guard

- **Files:** `lib/integrations/taint.ts`, tests, `lib/ai/tools/extract-url.ts`, `text-chat.ts`,
  `components/elements/response.tsx`, the message list component that renders `Response`.
- **`taint.ts`:**
  - `hasPrivateMcpResult(messages, sensitivityByToolName)` looks at `tool-mcp_*` parts whose
    integration is `private` or custom, with any output.
  - An unknown slug counts as private.
  - `userProvidedUrls(messages)` returns the set of `new URL(x).href` for URLs found in user-role
    `text` parts only, not attachments.
- **`extractUrl`:**
  - A new optional `isUrlAllowed?: (url: string) => boolean` parameter.
  - When it is set and any URL fails, return `{ error: "url_not_allowed", results: [] }`
    **before** `chargeUsage`.
  - `text-chat.ts` passes it when tainted.
  - The tool description is unchanged, so the bytes stay stable.
- **Image guard:**
  - The chat-level boolean `isChatTainted` is computed client-side from all messages with
    `isMcpToolPart` and private slugs. Conservative rule: any MCP part counts.
  - When true, `MarkdownImage` renders only `*.public.blob.vercel-storage.com` images (the
    existing blob host); otherwise it shows a small "external image hidden" i18n label.
- **Acceptance:**
  - Tests: no MCP parts means no restriction; a private part means only user URLs pass; a URL in
    an assistant message does not count; the refusal path does not call `chargeUsage` (mocked).
  - `pnpm check` green.
- **Depends on:** M1-T8, M1-T9.

#### M2-T5 — Credentials on the chat path and static-header auth

- **Files:** `turn-plan.ts`, `lib/integrations/headers.ts`, `policy.ts`, tests.
- **`buildAuthHeaders(connection, secret)`:**
  - Produces `{ [authHeaderName]: `${scheme} ${token}` }` plus `staticHeaders`.
  - Rejects header names outside an allowlist pattern `^[A-Za-z0-9-]{1,64}$` and CR/LF in
    values.
- **`connect()`:** loads and opens the credential (only here), and never logs it.
- **`policy.ts`:** connections whose `authType` is not `none` are skipped when
  `!isIntegrationCryptoConfigured()`.
- **Acceptance:** tests for header building, CRLF rejection, and that the secret never appears in
  a thrown error message. `pnpm check` green.
- **Depends on:** M2-T1, M2-T2, M2-T3.

#### M2-T6 — Custom MCP by URL (actions and form)

- **Files:** `app/integrations/actions.ts`,
  `app/integrations/_components/{custom-integration-form,tool-picker}.tsx`, `messages/ru.json`.
- **`testCustomIntegration({ url, headerName, scheme, token, staticHeaders })`:**
  - `validateCustomServerUrl`, then `captureToolSnapshot` via `safeFetch`.
  - Returns the tool list with sanitised descriptions and token estimates. Nothing is persisted.
- **`saveCustomIntegration(...)`:**
  - Re-tests, inserts the connection with `trustLevel: "custom"`, and seals the token into
    `IntegrationCredential`. Both happen in one transaction; no HTTP happens inside it.
  - Selected `enabledTools` and `readOnlyToolNames`.
- **Until M3:** only tools marked "run without confirmation" (`readOnlyToolNames`) are enabled.
  The form says the others need M3. Remove that sentence in M3-T6.
- **Form:**
  - Fields: URL, header name (default `Authorization`), scheme (default `Bearer`), token, and
    optional extra headers.
  - A plain warning about untrusted servers.
  - Caps: 25 tools and 6k tokens.
- **Drift:** `refreshIntegrationTools` on a custom connection whose hash changed sets
  `needs_review` and disables its tools until the user re-approves them in the picker.
- **Acceptance:** `pnpm check` green. Manual: add a public no-auth server (DeepWiki URL as custom)
  and a bearer-token test server.
- **Depends on:** M2-T5.

#### M2-T7 — OAuth connect and callback (SDK `auth()`), CIMD document

- **Files:**
  - `lib/integrations/oauth-provider.ts`, a Postgres-backed `OAuthClientProvider`. It saves the
    verifier, client information and AS metadata into the sealed OAuth-state payload, and tokens
    into `IntegrationCredential`.
  - `app/integrations/actions.ts` (`startOAuthConnect(catalogId)`).
  - `app/api/integrations/oauth/callback/route.ts`.
  - `app/oauth/client-metadata.json/route.ts`.
- **CIMD document:** the static client metadata, with `client_id` set to its own URL,
  `redirect_uris`, `token_endpoint_auth_method: "none"`, and grant types `authorization_code`
  and `refresh_token`.
- **Start:**
  - Only when `NEXT_PUBLIC_APP_URL` equals the production origin (a constant in `catalog.ts`).
  - 32-byte `state`, stored hashed.
  - Explicit `scope` from the catalog.
  - `redirect()` to the authorization URL.
- **Callback:**
  - `auth()` session, and the session user must equal the state's user.
  - `consumeOAuthState`.
  - Check `iss` when present.
  - Run the SDK `auth()` code exchange.
  - Seal tokens and store `accessTokenExpiresAt`.
  - Health check with `tools/list` and snapshot capture.
  - Redirect to `/integrations?connected=<id>` with `Cache-Control: no-store` and
    `Referrer-Policy: no-referrer`.
  - All failures redirect with an error key. The OAuth `error_description` is never echoed raw.
- **Acceptance:** unit tests for state hashing and consumption logic, and the origin check
  (pure parts). `pnpm check` green.
- **Depends on:** M2-T2, M2-T5.

#### M2-T8 — Proactive refresh with lease and CAS

- **Files:** `lib/integrations/refresh.ts`, `lib/db/query/integration/credential-lease.ts`,
  `turn-plan.ts` (`connect()` calls it), tests.
- **Flow:**
  1. When `accessTokenExpiresAt < now + 120 s`, take the lease:
     `UPDATE … SET refreshLeaseUntil = now() + 20s WHERE connectionId=$1 AND (lease IS NULL OR
     lease < now()) RETURNING tokenVersion, sealedBlob`.
  2. If no lease is granted, poll for 3 s for a `tokenVersion` change. Otherwise use the current
     token if it is still valid; if not, resolve `unauthorized`.
  3. With the lease, POST to the stored `token_endpoint` with an 8 s timeout via `safeFetch`. The
     body is `grant_type=refresh_token`, `refresh_token`, `client_id` and `resource`, plus the
     client secret only if the stored auth method needs it.
  4. Commit with a CAS
     `UPDATE … WHERE tokenVersion=$old` that writes the new blob, `tokenVersion+1`, the new expiry
     and `lease=NULL`. Zero rows means the result is discarded.
- **`invalid_grant`:** sets the connection to `needs_reauth`, terminal.
- **Logs:** `{ connectionId, outcome }` only.
- **Acceptance:** tests with mocked queries and fetch for: lease won and refreshed, lease lost and
  the new version picked up, lease lost and timed out with a still-valid token, CAS lost, and
  `invalid_grant`. `pnpm check` green.
- **Depends on:** M2-T7.

#### M2-T9 — Connected-integration settings: status, reconnect, disconnect and revoke

- **Files:** `app/integrations/_components/integration-settings.tsx`, `actions.ts`.
- **Status badges:** `active`, `needs_reauth` (Reconnect starts OAuth again), `needs_review`
  (Refresh tools), and `error`.
- **`disconnectIntegration`:** best-effort revocation (RFC 7009) when the AS metadata has a
  `revocation_endpoint`, 5 s timeout, errors logged and ignored. Then delete the connection,
  which cascades to the credential.
- **Allow changes:** a toggle placeholder, hidden until M3.
- **Acceptance:** `pnpm check` green. Manual: revoke Linear, then reconnect.
- **Depends on:** M2-T7.

#### M2-T10 — Linear catalog entry (read-only)

- **Files:** `catalog.ts`, `messages/ru.json`.
- **Entry:** `linear`, `serverUrl` `https://mcp.linear.app/mcp/readonly`, `readWriteServerUrl`
  `https://mcp.linear.app/mcp`, `authType: "oauth"`, `sensitivity: "private"`.
- **Allowlist:** at most 12 read tools with our descriptions. Exact names come from
  `probe-server.ts` after G1.
- **Acceptance:** G1 recorded in this plan; `pnpm check` green; manual connect, query, and
  `extractUrl` refused for a non-user URL.
- **Depends on:** G1, M2-T4, M2-T8.

### M3 — Write actions with confirmation

#### M3-T1 — Migration 0048: `IntegrationPendingAction`

- **Files:** `0048_integration_pending_action.sql`, journal, `schema.ts`,
  `lib/db/query/integration/pending-action-*.ts`.
- **Columns:** `id`, `userId`, `chatId`, `connectionId` (FK cascade), `toolName`, `args`
  (jsonb), `argsHash`, `toolDefHash`, `status`, `resultSummary` (≤2000), `createdAt`,
  `expiresAt` (+15 min), `decidedAt`. `status` is one of `pending`, `confirmed`, `denied`,
  `expired`, `failed` or `succeeded`.
- **Index:** `(chatId, status)`.
- **Query:** `claimPendingAction(id, userId)` is
  `UPDATE … SET status='confirmed', decidedAt=now() WHERE id AND userId AND status='pending' AND
  expiresAt>now() RETURNING *`.
- **Acceptance:** `pnpm check` green.
- **Depends on:** M2-T2.

#### M3-T2 — Write-class tools propose instead of execute

- **Files:** `lib/integrations/pending-actions.ts`, `turn-plan.ts`, `policy.ts`, tests.
- **Exposure:** write tools are included only when `connection.allowWrites`.
- **`execute`:** inserts the pending row (frozen args, `argsHash`, `toolDefHash` from the
  snapshot entry) and resolves `{ status: "awaiting_user_confirmation", actionId }`. It never
  contacts the server.
- **Mixed-chat rule:** if any custom connection is in the turn, built-in write tools are dropped.
- **Endpoint swap:** `allowWrites` on a built-in switches `serverUrl` to `readWriteServerUrl`,
  or the scope, on reconnect.
- **Acceptance:** tests showing the propose path makes no client call, the mixed-chat filter
  works, and the hashes are stable. `pnpm check` green.
- **Depends on:** M3-T1.

#### M3-T3 — Confirm or deny server action

- **Files:** `app/(chat)/integration-actions.ts` (server actions), `pending-actions.ts`, tests.
- **`decideIntegrationAction({ actionId, decision })`:**
  1. `auth()`, zod validation, then re-run the flag and paid gates.
  2. Deny: an atomic update to `denied`.
  3. Confirm:
     1. If a user message in the chat is newer than `createdAt`, set `expired`.
     2. `claimPendingAction`.
     3. Re-capture nothing. Compare `toolDefHash` to the current snapshot entry; a mismatch sets
        `failed`.
     4. Connect with credentials and call the tool once, with no retry and a 20 s timeout.
     5. Store a `resultSummary` truncated to 2,000 characters, and set `succeeded` or `failed`.
- **Returns:** a status plus an i18n key.
- **Acceptance:** tests (mocked DB and client): double confirm runs once, an expired action does
  not run, a hash mismatch does not run, a newer user message expires the action.
  `pnpm check` green.
- **Depends on:** M3-T2.

#### M3-T4 — Confirmation card in chat

- **Files:** `lib/messages/group-tool-runs.ts`, `components/integration-action-card.tsx`,
  the message renderer, `messages/ru.json`.
- **`isRunPart`:** returns false for MCP parts whose output status is
  `awaiting_user_confirmation`, so they render top-level.
- **Card:**
  - Live status through SWR from `getIntegrationActionStatus(id)`.
  - The preview shows the integration, the tool label from our catalog, and the frozen args as a
    key/value list rendered by our code. Long values are collapsed, never treated as markdown.
  - Confirm and Deny buttons.
  - Each status variant is its own keyed element.
- **Acceptance:** a `group-tool-runs` test covers the exclusion; the component is under 200
  lines; `pnpm check` green.
- **Depends on:** M3-T3.

#### M3-T5 — `applyActionOutcomes` in history

- **Files:** `history.ts`, `text-chat.ts`, tests.
- **Behaviour:** only when an `awaiting_user_confirmation` MCP part exists, load the matching
  pending rows (one query by ids) and rewrite that part's output for the model to
  `{ status: "confirmed", result }`, `{ status: "denied" }` or `{ status: "expired" }`.
- **Acceptance:** the pure function is tested, and nothing changes when there are no pending
  parts. `pnpm check` green.
- **Depends on:** M3-T3.

#### M3-T6 — Allow-changes toggle and custom write tools through confirmation

- **Files:** `integration-settings.tsx`, `custom-integration-form.tsx`, `actions.ts`,
  `messages/ru.json`.
- **Toggle:** "Allow changes" per connection, with a warning; built-ins require a reconnect to
  the read-write endpoint or scope.
- **Custom tools:** unmarked custom tools become enabled as confirm-required write tools. Remove
  the M2 limitation copy.
- **Acceptance:** `pnpm check` green. Manual: Linear "create issue" proposed, confirmed, then
  visible in Linear; also denied; and expired after a new message.
- **Depends on:** M3-T4, M3-T5.

### M4 — GitHub, Yandex Wiki, hardening

#### M4-T1 — GitHub

- **Files:** `catalog.ts`, `messages/ru.json`, and, if G2 passes, `oauth-provider.ts` support for
  a pre-registered client from `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET`.
- **Entry:** `github`, `serverUrl` `https://api.githubcopilot.com/mcp/readonly`,
  `sensitivity: "private"`, `staticHeaders` `X-MCP-Toolsets` set to a curated read toolset, and
  at most 12 allowlisted tools.
- **Auth:** GitHub App OAuth if G2 passed. Otherwise a fine-grained PAT paste through the
  static-header path, with a scope warning that recommends read-only permissions.
- **Acceptance:** `pnpm check` green; manual connect and query.
- **Depends on:** M2-T6, M2-T7, G2 for the OAuth part.

#### M4-T2 — Yandex Wiki (pasted token)

- **Files:** `catalog.ts`, connect form variant, `messages/ru.json`.
- **Entry:** `authType: "static_header"`, header `{ name: "Authorization", scheme: "OAuth" }`,
  required static header `X-Org-Id` entered by the user.
- **Help text:** how to obtain a `wiki:read` token and find the org id. `sensitivity: "private"`.
- **Acceptance:** `pnpm check` green; manual connect with a test org.
- **Depends on:** M2-T6.

#### M4-T3 — Redaction and logging audit

- **Files:** `text-chat.ts`, `lib/integrations/*`, and the `/api/log` client paths that touch
  MCP parts.
- **Change:** grep every `console.*` in the new code and the chat handler for MCP args, outputs
  or headers. Make sure the client does not send MCP outputs to `/api/log`.
- **Tests:** a unit test that the `buildAuthHeaders` and `refresh` errors never include the
  token.
- **Acceptance:** `pnpm check` green.
- **Depends on:** M2-T8, M3-T3.

#### M4-T4 — E2E and docs

- **Files:**
  - `tests/e2e/integrations.test.ts`: flag off gives 404, a free user sees the paywall, a paid
    tester sees the catalog. Use the existing auth helpers and no live MCP.
  - `CLAUDE.md`: an "Integrations (MCP)" section under Architecture, plus a gotcha about
    `onInputStart` and the stable tool names.
  - `.env.example`.
  - This plan: `status: done`.
  - The ADR's status stays `accepted`.
- **Acceptance:** `pnpm check` green; Playwright file passes locally.
- **Depends on:** all previous tasks.
