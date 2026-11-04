---
date: 2026-11-03
status: accepted
issue: GIPITI-28
plan: docs/plans/2026-11-03-mcp-integrations.md
---

# ADR 0001: MCP integrations in GIPITI

## Context

GIPITI-28 asks for MCP (Model Context Protocol) integrations: a paid user connects remote MCP
servers (a curated catalog plus any URL), and the chat model calls their tools. The product owner
fixed the MVP frame: remote Streamable HTTP servers only, paid users only (read from the DB at
runtime), OAuth for popular servers and manual tokens for custom ones.

The constraints that shaped the decision, in priority order:

1. **Billing.** GIPITI is pure pay-per-use with a 2x markup on provider cost. Every tool definition
   is resent on every model step and billed. A user who has not asked for MCP on a turn must pay
   exactly what they pay today.
2. **Security.** MCP results are attacker-writable text: Linear and GitHub issues, community docs,
   and anything a custom server returns. That text can prompt-inject the model. The chat already
   has an exfiltration channel the model controls, `extractUrl`, which makes Tavily fetch a
   model-chosen URL, and it renders external images from assistant markdown
   (`components/elements/response.tsx`). OAuth tokens must be stored encrypted.
3. **Platform.** The chat route runs on Vercel with `maxDuration = 800`
   (`app/(chat)/api/chat/route.ts:36`). Stop is deferred while a tool is pending
   (`turn-lifecycle.ts:98`, `setAbortGate(() => tracker.pendingToolCalls() === 0)`), with a 45 s
   cap (`turn-abort.ts`). The DB client is default `postgres()` pooling
   (`lib/db/connection.ts`), so no long transactions and no session locks.
4. **Types.** `ai@6.0.73` and `@ai-sdk/mcp@1.0.101` ship different `provider-utils` copies.
   Passing `client.tools()` into `streamText` fails typecheck (TS2322). This was tested in a
   copy of the repo.
5. **Market.** Users are in Russia. Google, Notion and Atlassian are out for reachability and
   legal reasons. Linear and GitHub reachability is unconfirmed.

Three designs were proposed (mvp-first, security-first, cost-latency-first), critiqued, and the
winner was refined with grafts from the other two. This ADR records the result and the corrections
the judge made on top of the refined design.

## Decision

### 1. MCP is opt-in per request

`POST /api/chat` gains `integrationIds?: string[]` (uuid, max 5). Tools are attached only when:

- the list is non-empty;
- the `isIntegrationsEnabled` flag is on for the user;
- the user is paid by a DB-fresh check (`isFreeUserById` semantics; see the open question on
  top-up-only users);
- the model has `capabilities.mcp`, an allowlist guarded by `model-registry.test.ts`.

A turn without integrations is byte-identical to today: same tools array, same prompt, same bill,
same cache prefix.

### 2. Static `tool()` wrappers over pinned snapshots

At connect time we run `tools/list`. The allowlisted definitions are sanitised, their schemas are
normalised, and the result is stored as a snapshot on the connection. At chat time each snapshot
entry becomes `tool({ description, inputSchema: jsonSchema(normalised), execute, onInputStart })`,
with a stable mangled name (`mcp_<slug>__<tool>`, at most 64 characters, charset
`[a-zA-Z0-9_]`, starting with a letter, with a hash suffix on collision).

- **No `tools/list` on the chat path.** Execute calls `toolsFromDefinitions(snapshot)[original]`.
- **Built-in descriptions are ours.** The vendor's text is not used. This removes tool poisoning
  on built-ins and saves tokens.
- **History stays readable.** Parts persist as `tool-mcp_*`, so the existing run-card groups them
  (`lib/messages/group-tool-runs.ts`) and needs only one `buildStep` case.
- **Names never change.** The mangled name is stored in the snapshot, so persisted parts keep
  mapping to the same tool.

### 3. Lazy connect, never awaited in the stream

`onInputStart` starts a memoised `connect()` without awaiting it. `ai` awaits `onInputStart`
inside the stream transform (`node_modules/ai/dist/index.mjs:6878`), so awaiting an 850 ms
connect there would freeze the stream. `execute` calls the same memoised `connect()` itself,
because providers that do not stream tool input never emit `tool-input-start`.

`connect()` does three things:

- proactively refreshes the token if it expires within 120 s;
- builds the static auth header from the connection's header descriptor `{name, scheme}` plus any
  plaintext `staticHeaders`;
- calls `createMCPClient` through the SSRF-guarded fetch.

There is no `authProvider` on chat-time clients, so interactive OAuth can never start mid-turn.

### 4. Stop reaches MCP reads at once

`TurnAbort` gains `readonly stopRequested: AbortSignal`. It is aborted at the top of
`requestAbort()`, before the gate. MCP `execute` races
`AbortSignal.any([turnSignal, stopRequested, AbortSignal.timeout(20_000)])` and *resolves*
`{ ok: false, error: "cancelled_by_user" | "timeout" }`. It never throws.

The abort then lands at the step boundary, and billing uses real usage. In the prototype this gave
`steps: 1, atStepBoundary: true`, against the lossy forced path that MCP turns take today.
Non-MCP tools in the same step keep the gate.

### 5. Secrets

- **Storage.** Credentials live in a separate `IntegrationCredential` table, one sealed
  AES-256-GCM blob per connection. AAD is `kid|userId|connectionId|column`. The key comes from a
  dedicated `INTEGRATIONS_ENCRYPTION_KEY_<kid>`, never `AUTH_SECRET`, and production fails closed
  if it is missing.
- **Refresh.** A refresh uses a single-statement lease (`refreshLeaseUntil`) and a `tokenVersion`
  compare-and-swap. `invalid_grant` is terminal and sets `needs_reauth`.
- **OAuth.** The SDK's `auth()` is used only in the connect and callback routes.
  - The callback state is `sha256(state)`, consumed with `DELETE … RETURNING`.
  - The session user must match the state's user.
  - `iss` is checked when the server sends it.
  - The health check is `tools/list`.
  - The redirect sets `no-store` and `no-referrer`.
  - OAuth connect works only on the production origin.

### 6. Safety

- **Allowlists.** Every built-in has a curated tool allowlist with our own `read` or `write`
  class; server hints are ignored. Built-ins use their read-only endpoint or scope by default.
- **Writes: propose, then commit.** A write tool's `execute` never contacts the server. It stores
  frozen args and returns `awaiting_user_confirmation`.
  - The user confirms or denies on a top-level card, through a server action.
  - Confirmation is an atomic single-use `UPDATE`, with `toolDefHash` re-checked and no retry.
  - The card's preview is rendered by our code from the frozen args, never from text the model
    wrote.
  - The outcome reaches the model by rewriting that tool output in history
    (`applyActionOutcomes`).
- **Taint is derived from the chat history**, not from the current turn. If any
  private-sensitivity MCP result is in the chat:
  - `extractUrl.execute` accepts only URLs that appear in the user's own text parts, and refuses
    before it charges;
  - assistant markdown images are limited to our blob host for the whole chat.

  Both are enforced in code, not through `activeTools`, so the tools array stays byte-stable for
  the prompt cache.
- **Mixed chats.** If a custom integration is in the turn, built-in write tools are removed from
  that turn.
- **SSRF.** All MCP transport traffic goes through an `undici` `Agent` with a `connect.lookup`
  check against a `node:net` `BlockList`. It allows https on port 443 only, sets
  `redirect: "error"`, applies connect and header timeouts, and caps responses at 1 MB.
- **Definition sanitiser.** It strips `\p{Cf}`, bidi characters and the tag block, and caps
  sizes. Server `instructions` are dropped, and no sampling or elicitation capability is
  advertised.
- **Telemetry.** Spans set `recordInputs` and `recordOutputs` to false whenever the turn has MCP
  tools *or* the history holds an MCP part. This matters because `ai.toolCall.*` attributes are
  controlled by `recordOutputs`, and history replay by `recordInputs`.

### 7. Scope of the MVP catalog

| Server | Auth | Notes |
|---|---|---|
| DeepWiki | none | |
| Context7 | none | |
| Linear | OAuth via a CIMD public client; DCR fallback | |
| GitHub | GitHub App OAuth if its gate passes; otherwise a fine-grained PAT | |
| Yandex Wiki | pasted `Authorization: OAuth <token>` plus `X-Org-Id` | |
| Custom URL | none, or a static header token | Its tools are write-class until the user marks them read-only |

### 8. Delivery

The work ships behind the flag in four milestones, and each milestone has its own additive
migration.

- **M1** is a vertical slice with the no-auth built-ins, end to end.
- **M2** adds secrets, custom URLs, the taint rule and Linear OAuth.
- **M3** adds confirmed writes.
- **M4** adds GitHub, Yandex Wiki and hardening.

## Settled disagreements

1. **`webSearch` stays enabled after a private result; `extractUrl` gets the provenance rule.**
   - A Tavily search query does not reach a URL an attacker sees directly, while `extractUrl`
     does.
   - Residual risk: search queries can leak small amounts of data to indexed attacker pages, and
     markdown links need a click. Both are documented gaps.
2. **Taint comes from history, not the turn.** Results are persisted and replayed, so a
   turn-scoped flag forgets the injection on the next turn. The judge adds that the image guard
   must also be chat-scoped. A per-message guard lets turn N+1 exfiltrate what turn N read.
3. **Stop does not touch pending actions.** They block nothing in the loop. Staleness is checked
   lazily at confirm time: a user message newer than the action expires it.
4. **`warm()` is removed in favour of `onInputStart`,** with the judge's correction:
   fire-and-forget only, and `execute` connects on its own.
5. **GitHub targets a GitHub App with read-only permissions and expiring tokens,** but it is gated
   (G2) on the remote server accepting App user tokens. The PAT path is built regardless, because
   it is the same static-header code as custom MCP.
6. **The SDK's `auth()` runs only in connect and callback.** The refresh POST is ours. It must
   send `client_id`, the stored client auth method, and the RFC 8707 `resource`.
7. **Security-first extras are cut:** the audit table, the drift cron, per-row HKDF, the CSP
   rollout and the drift-review UI. Drift is handled by `needs_review` plus a manual "refresh
   tools" action.
8. **Mutations are server actions, not new route handlers with a hand-written
   `assertSameOrigin`.** Next.js server actions already compare Origin with Host. Only the GET
   OAuth callback and the CIMD document are route handlers.

## Alternatives considered

- **mvp-first.** It attached every connected server to every message of a paid user. That is a
  silent per-message surcharge on a 2x-markup product, and it changes the cache prefix of all
  their chats. Approvals blocked inside `execute` for up to 120 s, but the assistant row is saved
  only when the stream finishes. Without Redis, a reload replays from the DB, finds no row, and the
  approval is lost. Rejected. Kept from it: M0 spikes, Yandex Wiki token paste, orphan flattening,
  the paywall card.
- **security-first.** It had the strongest security primitives, most of which were grafted. But
  its Stop reasoning was false: the signal `execute` receives is the gated `turnAbort.signal`.
  Its scope of about 45 days cut nothing, including an audit log, a drift cron, a key-ring HKDF,
  a CSP rollout and a red-team suite. Rejected as a whole.
- **SDK tools passed directly** (`streamText({ tools: await client.tools() })`). Rejected: the
  types are incompatible (TS2322), it would call `tools/list` on every turn, and vendor
  descriptions would reach the model unchanged.
- **An `authProvider` on chat-time clients.** Rejected: a 401 adds a round trip plus discovery
  fetches, and it can trigger `redirectToAuthorization` side effects in a request that cannot
  redirect.
- **Restricting tools through `activeTools` for taint.** Rejected: it changes the tools array
  and invalidates the Anthropic cache (tools, then system, then messages).
- **`pg_advisory_xact_lock` around refresh.** Rejected: it holds a transaction open across an
  outbound HTTP call on a pooled client.

## Consequences

- **Cost.** No change for non-MCP turns. MCP turns pay for definitions on every step: at most
  6k tokens per step by budget, partly offset by prompt caching on providers that support it.
  Results are capped at 8,000 characters, and old results are compacted to 600.
- **Latency.** No change for non-MCP turns. Connect (about 850 ms measured) overlaps with the
  model streaming the call arguments. Stop on an MCP read takes about 1 ms instead of up to 45 s.
- **New surface to maintain.**
  - Four tables, added in three migrations (0046 to 0048).
  - `lib/integrations/*`.
  - An `/integrations` page.
  - A new env var per key id.
  - A user-targeted flag.
  - One more `TurnAbort` field.
- **Vendor allowlists will drift.** DeepWiki has already renamed its tools. A missing allowlisted
  tool sets `needs_review` and logs an alert.
- **Plaintext results in `Message_v2`.** MCP results are stored as plaintext tool outputs, bounded
  in size. This needs PO acceptance and a disclosure in the UI.
- **The acceptance criterion needs rewording.** "5 built-ins via OAuth" is not reachable for
  Russian users in the MVP. The honest statement is: 5 built-ins (2 OAuth-capable, Linear and
  GitHub; 1 token; 2 no-auth) plus custom URL.
- **Spec drift.** The MCP spec (stateless transport, DCR deprecated) will move on. All MCP code sits
  behind `lib/integrations/turn-plan.ts` and `oauth-provider.ts`, and CIMD comes first.
