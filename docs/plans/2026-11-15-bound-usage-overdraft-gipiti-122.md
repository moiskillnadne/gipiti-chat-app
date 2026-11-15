---
date: 2026-11-15
status: done
branch: fix/gipiti-122-bound-usage-overdraft
issue: GIPITI-122
---

# Bound usage overdraft per chat turn (GIPITI-122)

## Goal

Cost is charged after inference and floors at zero, so the pre-inference gate must keep the
amount a turn can spend beyond the balance bounded. This change:

1. limits turns in flight per user: 1 media turn (image or video) and 3 text turns, held from
   before the balance read until the turn's charge has settled;
2. replaces the "balance above zero" gate with a minimum balance per turn, by mode (text: a
   constant floor; media: the model's cost estimate converted with the cached FX rate and
   `USAGE_MARKUP`, or a per-mode floor when there is no estimate or no FX rate);
3. adds a per-user sliding-window rate limit on `POST /api/chat` (30 requests per minute);
4. records the shortfall when a usage charge is floored at zero (Transaction metadata and a
   structured warning). No schema change.

## Files

- `lib/billing/constants.ts` — slot limits, minimum turn balances.
- `lib/billing/turn-slots.ts` (new) — per-user slot limiter: Redis backend (sorted set, one Lua
  script for acquire, `ZREM` for release, TTL per slot) and in-memory backend with the same
  semantics; Redis absent → in-memory; a Redis error on acquire → in-memory for that turn.
- `lib/billing/turn-balance.ts` (new) — pure `requiredTurnBalanceMinor` and `checkTurnBalance`.
- `lib/billing/fx.ts` — `getCurrencyPricing` (minor units + latest FX rate), shared by
  `chargeUsage` and the gate; same two queries on the same connection as today.
- `lib/billing/balance.ts` — remove `hasPositiveBalance`; `chargeUsage` records the shortfall.
  `grantQuizBonus` is not touched.
- `lib/ai/models.ts` — optional `estimatedCostUsd` on `ImageGenConfig` / `VideoGenConfig` and a
  `getMediaCostEstimateUsd` getter. No values filled (see Risks).
- `lib/rate-limit.ts` — `checkChatRateLimit` (allows the request when Redis is absent, like the
  existing limiters).
- `app/(chat)/api/chat/_lib/resolve-mode.ts` — `resolveRequestedModel` (hidden → default), so
  the route knows the mode before `prepareChatTurn`.
- `app/(chat)/api/chat/_lib/turn-slot.ts` (new) — acquire with a 429 `ChatSDKError`, and
  `runHoldingTurnSlot`, which releases a text slot on the turn settlement and a media slot when
  the handler returns (both after the charge).
- `app/(chat)/api/chat/_lib/prepare-chat-turn.ts`, `context.ts`, `enforce-balance.ts` — the
  context carries a `TurnBalanceCheck` instead of `hasBalance`.
- `app/(chat)/api/chat/route.ts` — rate limit and slot acquisition after auth, before
  `prepareChatTurn`; release on every path.
- `messages/ru.json` — Russian messages for the two 429 cases. The existing balance notice
  already reads "not enough funds", so it serves the new minimum unchanged.

The USD → minor-units arithmetic stays in the existing pure `usdToMinorUnits` (`money.ts`),
which both `chargeUsage` and the gate call with `USAGE_MARKUP`.

## Order of work

1. Tests for the slot module, the minimum-balance function, the gate, release ordering and the
   shortfall (failing).
2. Constants, `turn-slots.ts`, `turn-balance.ts`, `getCurrencyPricing`, shortfall recording.
3. Route wiring, `prepareChatTurn` / `enforceBalance`, rate limit, messages.
4. `pnpm lint`, `pnpm typecheck`, unit tests, `next build`.

## Risks

- A slot released too early would let a second media turn read a balance without the first
  turn's charge. Release is tied to the settlement (text) or the handler's return (media), both
  of which come after `chargeUsageSafe` resolves; the catch path releases only when no handler
  started.
- A slot never released (crash, killed function) blocks the user until its TTL
  (`maxDuration`) expires.
- In-memory fallback is per process: with several instances and no Redis the limit is per
  instance. Accepted (decision 1).
- Missing FX rate: the media minimum falls back to the per-mode floor (in that state
  `chargeUsage` does not charge at all).
- Per-mode floors are minor units of the user's currency (RUB by default), like
  `LOW_BALANCE_THRESHOLD_MINOR`.
- No per-model estimates are filled: per-generation cost at default settings depends on
  resolution, mode and audio, and is left for the owner to fill from the AI Gateway catalog.

## Verification

- `pnpm vitest run --exclude ".claude/**"` (new tests in `lib/billing/__tests__/` and
  `app/(chat)/api/chat/_lib/__tests__/`; existing stop/billing tests unchanged)
- `pnpm lint`, `pnpm typecheck`, `pnpm exec next build`
