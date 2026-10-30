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
aborting running tools (e.g. `generateImage` inside a text turn).

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
- Stop is keyed by `chatId`; value = server timestamp. Producer aborts only if `stopAt >= turnStartedAt`.
  The client awaits a pending stop request before it sends the next message, so a late stop never kills the next turn.

Interrupted mark = data part `{ type: "data-interrupted", data: { reason: "user" } }` in `parts` — no migration.

Rejected: only `request.signal` (breaks resume, can't cross instances); stop by `streamId` (client doesn't know it
while `submitted`); polling a DB flag (too many queries); turning off resumable streams (loses a feature).

## Files

1. `lib/types.ts` — `CustomUIDataTypes.interrupted: { reason: "user" }`.
2. `lib/messages/interrupted.ts` (new) — `isInterruptedMessage`, `finalizeInterruptedMessage`
   (drop tool parts in `input-streaming`/`input-available`, `streaming` → `done`, append mark, idempotent),
   `markLastAssistantInterrupted`.
3. `app/(chat)/api/chat/_lib/stop-signal.ts` (new) — `requestChatStop(chatId)`, `watchChatStop({ chatId, startedAt, onStop, maxLifetimeMs })`
   → cleanup fn; in-process + Redis (`redis` v5 `createClient` publisher + `duplicate()` subscriber, key/channel
   `gipiti:chat-stop:${chatId}`, `EX 120`). Errors logged, never thrown.
4. `app/(chat)/api/chat/[id]/stop/route.ts` (new) — `POST`: auth, ownership check, `requestChatStop`, `204`.
5. `app/(chat)/api/chat/_lib/context.ts` — `startedAt`, `abortSignal`, `abortSettlement: { value?: Promise<void> }`.
6. `app/(chat)/api/chat/_lib/prepare-chat-turn.ts` — accept and store the turn fields.
7. `app/(chat)/api/chat/route.ts` — controller, signal (link `request.signal` only without stream context),
   watcher for text mode, `onFinish` awaits settlement then persists with `{ aborted, finishedAt }`, cleanup in
   `finally` and in `catch`; `after()` keeps the function alive when there is no stream context.
8. `app/(chat)/api/chat/_lib/persist-assistant-turn.ts` — `opts: { aborted, finishedAt }`; aborted messages go through
   `finalizeInterruptedMessage` instead of `ensureMessageHasTextPart`.
9. `app/(chat)/api/chat/_lib/usage.ts` — `estimateTokens` (Cyrillic ≈ 2.5 chars/token, other ≈ 4),
   `createInFlightStepTracker`, `priceUsageUsd`, `computeAbortedTurnUsage`.
10. `app/(chat)/api/chat/_lib/handlers/text-chat.ts` — `abortSignal`, sync `onChunk` tracker, `onStepFinish` reset,
    `onAbort` → settle once, `onFinish` guarded by the same `settled` flag; `ignoreIncompleteToolCalls: true`.
11. `hooks/use-chat-stop.ts` (new) — `handleStop` (POST stop with `keepalive` + `stop()` + abort resume read),
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

- Clock skew between instances (ms on Vercel) — covered by waiting for the stop before the next send.
- Hidden reasoning (OpenAI o-series / GPT-5) is under-charged on stop: only visible reasoning summary is counted.
- Input of the running step is estimated, image tokens not counted.
- With Redis the server may save a few more words than the client showed (Redis round trip).
- `onAbort` is not awaited by the SDK — correctness relies on awaiting `ctx.abortSettlement` in the UI-stream `onFinish`
  and on `waitUntil` / `after()`.
- +2 Redis TCP connections per instance.

## Verification

- Unit tests: `lib/messages/__tests__/interrupted.test.ts`, `app/(chat)/api/chat/_lib/__tests__/usage.test.ts` (extend),
  `app/(chat)/api/chat/_lib/__tests__/stop-signal.test.ts` (in-process backend, fake timers).
- `pnpm check:fast` while iterating, full `pnpm check` at the end.
- Manual (with and without Redis, GPT / Claude thinking / Gemini): stop mid-text and mid-reasoning; reload shows partial
  text + label; `Transaction` has a partial amount; new message right after stop; stop after auto-resume; stop while
  `submitted`.
