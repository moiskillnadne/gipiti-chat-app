---
date: 2026-10-30
status: done
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
- Stop is matched to the TURN, not to the clock and not to the user message (regenerate and edit re-send the same
  user message): key/channel `gipiti:chat-stop:${userId}:${chatId}:${turnId}`. The client mints a `turnId` for every chat
  POST (`prepareSendMessagesRequest`), sends it in the body (`turnId`, optional in the schema) and names it in the stop
  POST (`{ turnId }`). The server watches `body.turnId ?? message.id` (old clients keep working). A resumed stream did
  not make the POST, so the server writes a transient `data-turnId` part first and the client remembers it. The user
  id in the key makes cross-user stops impossible. The marker (`EX 60`) is consumed when it fires and deleted when the
  watching turn ends; with a local watcher the Redis round trip is skipped.
- The watcher is started without awaiting the Redis subscription (off the time-to-first-token path); cleanup waits for
  a subscription still in flight, and the stored-marker check after subscribing covers an early stop.
- Abort with `new DOMException("user-stop", "AbortError")`, never a string: a fetch aborted with a string rejects its
  body with that string, `streamText` errors the stream instead of aborting, and neither `onAbort` nor `onFinish`
  runs (nothing charged). Safety net: a stream error while the signal is aborted settles the turn as stopped.
- Tool deferral: the stop goes through `ctx.turnAbort.requestAbort()`. While tool calls are pending (`tool-call` seen,
  `tool-result` not yet) the abort is held and released ONLY in `onStepFinish`: the step then ends with its real usage
  (aborting on the tool result would drop the finish-step and force a char estimate), a tool error (never reported by
  `onChunk`) is covered the same way, and the lifecycle marks the abort as `atStepBoundary` so no phantom next step is
  estimated. The wait is bounded: after `min(45s after the stop, startedAt + maxDuration - 30s)` the abort is forced
  (`[chat-stop] forced abort, tool still running`), the turn is settled from the timer (a hung tool never lets the
  stream report the abort) and the UI stream is closed so the partial message is still saved. While a `generateImage`
  call is pending (the tracker knows tool names) only the function deadline forces, because its cost is booked when
  it returns and settlement would leave it unbilled. The timer ends with the settlement (not with the stop watcher), so
  a hung tool is still settled after the 15s persist-time wait expired.
- Pre-abort skip: if the signal is already aborted before the handler would run (route `execute`, or the text handler
  right before `streamText`), nothing runs: no model call, no charge, no assistant message persisted.
- Settlement: `ctx.turnSettlement` is created up front and resolved by the text handler on every terminal path (normal
  finish after its charge, stop settlement after its charge, stream end, handler throw). The route awaits it (capped
  15s) before persisting and registers it in `after()` uncapped (`maxDuration` bounds it), so a disconnect without
  Redis (UI `onFinish` runs before `onAbort`) is still charged. If the cap expires while a stop was requested, the
  message is still persisted as interrupted. The stop watcher's cleanup never blocks `onFinish` (kept alive by `after()`).
  `ctx.turnOutcome` (`completed | aborted | skipped`) decides whether the message is marked interrupted, so an answer that finished when Stop landed stays normal. An interrupted message gets
  `createdAt = stop request time` so it sorts before a message sent right after.
- Stale answers: an interrupted answer is not persisted if the turn's OWN user message (looked up by id) is gone (edit of
  an earlier message) or was re-saved with another `createdAt` (edit of the last one). A next message sent before the
  save is irrelevant: the answer sorts before it.

Interrupted mark = data part `{ type: "data-interrupted", data: { reason: "user" } }` in `parts` — no migration.

Rejected: only `request.signal` (breaks resume, can't cross instances); stop by `streamId` (client doesn't know it
while `submitted`); polling a DB flag (too many queries); turning off resumable streams (loses a feature).

## Files

1. `lib/types.ts` — `CustomUIDataTypes.interrupted: { reason: "user" }`.
2. `lib/messages/interrupted.ts` (new) — `isInterruptedMessage`, `finalizeInterruptedMessage`
   (drop tool parts in `input-streaming`/`input-available`, `streaming` → `done`, append mark, idempotent),
   `markLastAssistantInterrupted`.
3. `app/(chat)/api/chat/_lib/stop-signal.ts` (new) — `requestChatStop({ userId, chatId, turnId })`,
   `watchChatStop({ userId, chatId, turnId, onStop, maxLifetimeMs })` → cleanup fn (sync return); in-process + Redis
   (`redis` v5 `createClient` publisher + `duplicate()` subscriber, key/channel `gipiti:chat-stop:${userId}:${chatId}:${turnId}`,
   `EX 60`, consumed on fire, deleted on cleanup). Errors logged, never thrown.
4. `app/(chat)/api/chat/[id]/stop/route.ts` (new) — `POST { turnId }` (zod): auth, ownership check, `requestChatStop`, `204`.
5. `app/(chat)/api/chat/_lib/context.ts` — `turnAbort`, `turnSettlement`, `turnOutcome`.
5a. `app/(chat)/api/chat/_lib/turn-abort.ts` (new) — `createTurnAbort()`: AbortError abort, tool-deferral gate with the forced-abort timer, `requestedAt`.
5b. `app/(chat)/api/chat/_lib/turn-lifecycle.ts` (new) — which terminal path bills the turn (once), safety net, snapshot of
   finished steps + in-flight text, `beginFinish` (the `onFinish` decision), step-boundary flag, settlement promise,
   `waitForSettlement`, `closeStreamOnForcedAbort`. Unit-tested with a real `streamText`.
5c. `persist-assistant-turn.ts` + `turn-superseded.ts` — an interrupted answer is not persisted if its own user message
   was deleted/re-saved (edit); one `getMessageById` query, billing still happens.
5d. `_lib/stop-body.ts` — stop body `{ turnId } | { messageId }` (legacy cached clients), `turnId ?? messageId`.
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
11. `hooks/use-chat-stop.ts` (new) — `beginTurn` / `rememberTurn` / `handleStop` (POST stop `{ turnId }` with `keepalive` + `stop()` + abort resume read),
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

- A stop that reaches the server after its turn ended leaves a marker for up to 60s, but it names a turn id that is never
  reused, so it cannot hit a later turn (only an old client without `turnId`, falling back to the message id, could).
- Stop during tools: the stop is delayed until the step with the running tools finishes (up to the 45s cap); the client
  is already stopped, only the server work and the final charge wait. A tool that outlives the cap is left behind and its
  cost, if any, is not charged.
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
  charges once, stop in step 2, string-reason safety net, tool deferral with billed amounts (success / error), forced abort
  with fake timers, parallel tools, step-finish snapshot), `turn-superseded.test.ts`, `stop-body.test.ts`.
- `pnpm check:fast` while iterating, full `pnpm check` at the end.
- Manual (with and without Redis, GPT / Claude thinking / Gemini): stop mid-text and mid-reasoning; reload shows partial
  text + label; `Transaction` has a partial amount; new message right after stop; stop after auto-resume; stop while
  `submitted`.
