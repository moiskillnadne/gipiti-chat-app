---
date: 2026-10-30
status: done
branch: claude/jolly-pasteur-x7i56p
---

# Bill text turns that end with a stream error

## Goal

A text chat turn whose stream fails (provider or network error, not a user
stop) is charged nothing today, even for cost that was already spent: the
in-chat `generateImage` cost in `ctx.imageUsageAccumulator` and the gateway cost
of steps that finished before the error.

After this change such a turn is charged **once** for:

- the finished steps (gateway-reported cost, TokenLens as the fallback);
- the image-tool cost already in the accumulator.

The step that failed is **not** estimated: the user did not get its output.

## What the SDK does (probed with `streamText` + `MockLanguageModelV3`, ai 6.0.73)

| Failure | `onError` | `onFinish` | `onAbort` | Billed before |
| --- | --- | --- | --- | --- |
| error part, then `finish` | yes | yes (real usage) | no | yes (normal path) |
| error part, stream closes (step 2) | yes | yes | no | yes (normal path) |
| step 2 request rejects | yes | yes (step 1 usage) | no | yes (normal path) |
| stream errors mid-response (dropped connection) | `consumeStream` only | **no** | no | **no** |
| first request rejects | yes | **no** | no | **no** |

`onFinish` always completes before `consumeStream` resolves, so the turn can be
settled as errored in `streamEnded` without racing the normal charge.

## Files

- `app/(chat)/api/chat/_lib/turn-lifecycle.ts` — new `errored` outcome and
  `billErrored` option. `onStreamError` without a stop only marks the stream as
  errored; `streamEnded` settles it through the same `settled` once-guard as the
  stop path (shared `settleOnce`).
- `app/(chat)/api/chat/_lib/usage.ts` — `computeErroredTurnUsage`: summed
  finished-step usage, gateway cost first, TokenLens fallback, plus the
  accumulator; no finished step prices the text at zero.
- `app/(chat)/api/chat/_lib/handlers/text-chat.ts` — `billErrored` charges
  "Chat completion (error)" via `chargeUsageSafe`; skipped when nothing was
  spent. Shared `chargeSettledTurn` helper for the stop and error paths.
- Tests: `__tests__/turn-lifecycle.test.ts` (real `streamText` +
  `MockLanguageModelV3`), `__tests__/usage.test.ts`.

## Risks

- Double charge: avoided by the single `settled` flag; covered by tests (error
  part + finish, rejected step 2 request, stop + error).
- A tool still running when the stream fails books its cost after billing has
  read the accumulator; that cost stays unbilled (same as before).

## Verification

- `pnpm vitest run "app/(chat)/api/chat/_lib/__tests__/turn-lifecycle.test.ts"`
- `pnpm check`
