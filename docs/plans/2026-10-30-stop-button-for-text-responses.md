---
date: 2026-10-30
status: in-progress
branch: claude/peaceful-bell-9pifw3
issue: GIPITI-104
---

# Stop button for text responses (GIPITI-104)

## Goal

When the user clicks "Stop" while a text answer streams:

1. The client stops at once; the composer is back to `ready`, a new message can be sent.
2. The provider request is aborted on the server (`AbortSignal` → `streamText` → gateway `fetch`).
3. The partial assistant message is saved to `Message_v2` with an "interrupted" mark that survives reload.
4. The user pays only for finished steps (real gateway cost) + an estimate for the running step.
5. Works on a resumed stream (after reload) and when the stop request lands on another serverless instance.

Out of scope: image / video handlers (the button still shows, the server finishes them as before);
aborting running tools (e.g. `generateImage` inside a text turn) -- the stop waits for them instead (see "Tool deferral").

## Key facts (checked in `ai@6.0.73`, `resumable-stream@2.2.12` source)

- AI SDK docs: abort and resumable streams are incompatible, no official workaround.
- Client `stop()` aborts only the POST fetch. On a resumed stream (GET reconnect) it does not abort the read at all.
- `resumable-stream` always drains the producer; no cancel API.
- `streamText.onAbort({ steps })` — only FINISHED steps, no usage for the running step.
  `streamText.onFinish` is not called if 0 steps finished; `result.usage/totalUsage` reject on abort.
- `createUIMessageStream.onFinish({ messages, isAborted })` runs on abort with the partial message.
- `@ai-sdk/gateway` forwards `abortSignal` to `fetch`.
- No tokenizer installed (`tokenlens` is pricing only) → estimate tokens from characters.

## Approach

One server `AbortController` per turn + a stop endpoint that reaches the producer:

- Redis pub/sub (+ key as a fallback for the early-stop race) when `REDIS_URL` is set — works across instances.
- In-process registry as fast path (the only path without Redis).
- Without Redis (no resume), `request.signal` is also linked: a dropped connection means stop.
- Stop is matched to the TURN, not to the clock: key/channel `gipiti:chat-stop:${chatId}:${messageId}`, where `messageId`
  is the last user message. The client sends `{ messageId }` (last user message of its `messages` at stop time) in the
  stop POST body; the server watches the `message.id` of the chat POST. Both are the same message in every trigger:
  new message, regenerate and edit all POST `messages.at(-1)` (a user message), a resumed stream belongs to the last
  user message of the history. No timestamps, so clock skew / cold starts cannot drop an early stop, a late stop cannot
  hit the next turn, and two tabs on one chat do not stop each other. The marker (`EX 60`) is deleted when the watching
  turn ends, so regenerating the same user message right after a stop is not killed by it.
- The watcher is started without awaiting the Redis subscription (off the time-to-first-token path); cleanup waits for
  a subscription still in flight, and the stored-marker check after subscribing covers an early stop.
- Abort with `new DOMException("user-stop", "AbortError")`, never a string: a fetch aborted with a string rejects its
  body with that string, `streamText` errors the stream instead of aborting, and neither `onAbort` nor `onFinish`
  runs (nothing charged). Safety net: a stream error while the signal is aborted settles the turn as stopped.
- Tool deferral: the stop goes through `ctx.turnAbort.requestAbort()`. While tool calls are pending (`tool-call` seen,
  `tool-result` not yet; a tool error ends at the step finish) the abort is held, then performed from `onChunk` /
  `onStepFinish`. Otherwise the tool result would be dropped while its cost (image generation) is already counted, and
  parallel tools would leak cost after settlement.
- Pre-abort skip: if the signal is already aborted before the handler would run (route `execute`, or the text handler
  right before `streamText`), nothing runs: no model call, no charge, no assistant message persisted.
- Settlement: `ctx.turnSettlement` is created up front and resolved by the text handler on every terminal path (normal
  finish after its charge, stop settlement after its charge, stream end, handler throw). The route awaits it (capped
  15s) before persisting and registers it in `after()`, so a disconnect without Redis (UI `onFinish` runs before
  `onAbort`) is still charged. `ctx.turnOutcome` (`completed | aborted | skipped`) decides whether the message is marked
  interrupted, so an answer that finished when Stop landed stays normal. An interrupted message gets
  `createdAt = stop request time` so it sorts before a message sent right after.

Interrupted mark = data part `{ type: "data-interrupted", data: { reason: "user" } }` in `parts` — no migration.

Rejected: only `request.signal` (breaks resume, can't cross instances); stop by `streamId` (client doesn't know it
while `submitted`); polling a DB flag (too many queries); turning off resumable streams (loses a feature).

## Files

1. `lib/types.ts` — `CustomUIDataTypes.interrupted: { reason: "user" }`.
2. `lib/messages/interrupted.ts` (new) — `isInterruptedMessage`, `finalizeInterruptedMessage`
   (drop tool parts in `input-streaming`/`input-available`, `streaming` → `done`, append mark, idempotent),
   `markLastAssistantInterrupted`.
3. `app/(chat)/api/chat/_lib/stop-signal.ts` (new) — `requestChatStop({ chatId, messageId })`,
   `watchChatStop({ chatId, messageId, onStop, maxLifetimeMs })` → cleanup fn (sync return); in-process + Redis
   (`redis` v5 `createClient` publisher + `duplicate()` subscriber, key/channel `gipiti:chat-stop:${chatId}:${messageId}`,
   `EX 60`, deleted on cleanup). Errors logged, never thrown.
4. `app/(chat)/api/chat/[id]/stop/route.ts` (new) — `POST { messageId }` (zod): auth, ownership check, `requestChatStop`, `204`.
5. `app/(chat)/api/chat/_lib/context.ts` — `turnAbort`, `turnSettlement`, `turnOutcome`.
5a. `app/(chat)/api/chat/_lib/turn-abort.ts` (new) — `createTurnAbort()`: AbortError abort, tool-deferral gate, `requestedAt`.
5b. `app/(chat)/api/chat/_lib/turn-lifecycle.ts` (new) — which terminal path bills the turn (once), safety net, snapshot of
   finished steps + in-flight text, settlement promise, `waitForSettlement`. Unit-tested with a real `streamText`.
6. `app/(chat)/api/chat/_lib/prepare-chat-turn.ts` — accept and store the turn fields.
7. `app/(chat)/api/chat/route.ts` — `turnAbort` (link `request.signal` only without stream context),
   watcher for text mode (not awaited), pre-abort skip, `onFinish` awaits the settlement then persists with
   `{ aborted, finishedAt }`, cleanup in `finally` and in `catch`; `after()` keeps the function alive when there is no
   stream context.
8. `app/(chat)/api/chat/_lib/persist-assistant-turn.ts` — `opts: { aborted, finishedAt }`; aborted messages go through
   `finalizeInterruptedMessage` instead of `ensureMessageHasTextPart`.
9. `app/(chat)/api/chat/_lib/usage.ts` — `estimateTokens` (Cyrillic ≈ 2.5 chars/token, other ≈ 4),
   `createInFlightStepTracker`, `priceUsageUsd`, `computeAbortedTurnUsage`.
10. `app/(chat)/api/chat/_lib/handlers/text-chat.ts` — `turnAbort.signal`, lifecycle callbacks (sync `onChunk` tracker incl.
    pending tool calls, `onStepFinish` reset, `onAbort` → settle once, `onError` / `consumeStream` safety net),
    `onFinish` guarded by the lifecycle; `ignoreIncompleteToolCalls: true`.
11. `hooks/use-chat-stop.ts` (new) — `handleStop` (POST stop `{ messageId }` with `keepalive` + `stop()` + abort resume read),
    `waitForPendingStop` (capped ~3s), `fetchWithResumeAbort` (adds a signal to the GET reconnect).
12. `components/chat.tsx` — use the hook; async `prepareSendMessagesRequest` awaits pending stop; client `onFinish`
    marks the last assistant message interrupted on `isAbort` (text models only); remove `console.log`s.
13. `components/multimodal-input.tsx` — stop button calls only `stop()`.
14. `components/message.tsx` — small "interrupted" note (`data-testid="message-interrupted"`).
15. `messages/ru.json` — `chat.messages.interrupted: "Генерация остановлена"` (exact namespace per existing file).

## Order of work

1. Types + `interrupted.ts` + tests.
2. `usage.ts` helpers + tests.
3. `stop-signal.ts` + tests, stop endpoint.
4. Context → prepare-chat-turn → route → persist.
5. `text-chat.ts`.
6. Client: hook, `chat.tsx`, `multimodal-input.tsx`, `message.tsx`, `ru.json`.
7. `pnpm check`, review, fixes.

## Risks

- Residual: a stop that reaches the server after its turn already ended leaves a marker for up to 60s; regenerating the
  same user message in that window would be stopped at once. The client waits for a pending stop before the next send.
- Stop during tools: the stop is delayed until the running tools return (can be tens of seconds for image generation);
  the client is already stopped, only the server work and the final charge wait.
- Hidden reasoning (OpenAI o-series / GPT-5) is under-charged on stop: only visible reasoning summary is counted.
- Input of the running step is estimated, image tokens not counted.
- With Redis the server may save a few more words than the client showed (Redis round trip).
- `onAbort` is not awaited by the SDK — correctness relies on awaiting `ctx.turnSettlement` in the UI-stream `onFinish`
  and on `waitUntil` / `after()`.
- +2 Redis TCP connections per instance.

## Verification

- Unit tests: `lib/messages/__tests__/interrupted.test.ts`, `app/(chat)/api/chat/_lib/__tests__/usage.test.ts` (extend),
  `app/(chat)/api/chat/_lib/__tests__/stop-signal.test.ts` (in-process backend, fake timers),
  `app/(chat)/api/chat/_lib/__tests__/turn-lifecycle.test.ts` (real `streamText` + `MockLanguageModelV3`: stop mid-stream
  charges once, string-reason safety net, tool deferral, parallel tools, step-finish snapshot).
- `pnpm check:fast` while iterating, full `pnpm check` at the end.
- Manual (with and without Redis, GPT / Claude thinking / Gemini): stop mid-text and mid-reasoning; reload shows partial
  text + label; `Transaction` has a partial amount; new message right after stop; stop after auto-resume; stop while
  `submitted`.
