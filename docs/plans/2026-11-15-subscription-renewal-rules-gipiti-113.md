---
date: 2026-11-15
status: done
branch: fix/gipiti-113-subscription-renewal-rules
issue: GIPITI-113
---

# Subscription renewal rules for non-recurring subscriptions (GIPITI-113)

## Goal

A paid period must be backed by a payment. Subscriptions that CloudPayments renews carry an
`externalSubscriptionId`; the `reset-quotas` cron must not extend any other subscription by
default. At period end, an active subscription without `externalSubscriptionId`:

- is renewed (period extended, subscription pool reset to the plan price) only when its owner is
  an internal tester (`User.isTester`, read from the DB in the same query);
- is otherwise expired (`status: "expired"`) and the user is moved to the free state with
  `assignFreePlan`, like `cleanup-cancelled` does.

Details of the finding are in GIPITI-113.

The second part of the brief (validating the widget's recurrence parameters in the `check`
webhook) is not implemented: neither the CloudPayments docs nor the existing code confirm that the
`Check` notification's `Data` echoes the `CloudPayments.recurrent` object, so a validator would be
built on a guessed payload shape. See "Out of scope" in the PR.

## Files

- `lib/subscription/period-end-action.ts` (new) — pure `decidePeriodEndAction` (`renew` /
  `expire` / `skip`).
- `lib/subscription/__tests__/period-end-action.test.ts` (new) — unit tests.
- `app/api/cron/reset-quotas/route.ts` — join `User.isTester`, branch on the decision, expire and
  downgrade non-tester rows, per-row try/catch, `expired` count in the response.
- `app/api/cron/reset-quotas/__tests__/route.test.ts` (new) — route test with a mocked DB.

## Order of work

1. Tests for the pure function and the route (fail first).
2. Pure function.
3. Route changes.
4. Lint, typecheck, unit tests, build.

## Risks

- Existing active non-recurring subscriptions of non-testers in production will expire at their
  period end instead of renewing. The owner should list them before deploying (see PR).
- `assignFreePlan` failure leaves a row `expired` with a non-empty pool until the next downgrade;
  it is logged with context and does not stop the loop (same as `cleanup-cancelled`).
- Cron auth is unchanged (tracked in GIPITI-174).

## Verification

- `pnpm lint`, `pnpm typecheck`
- `pnpm vitest run --exclude ".claude/**"`
- `pnpm exec next build`
