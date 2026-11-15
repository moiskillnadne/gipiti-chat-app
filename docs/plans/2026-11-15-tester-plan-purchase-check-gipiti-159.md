---
date: 2026-11-15
status: done
branch: fix/gipiti-159-tester-plan-purchase-check
issue: GIPITI-159
---

# Enforce tester-only plans on the server (GIPITI-159)

## Goal

The `tester_paid` plan is for internal testers only. Today that rule lives only in the seed file
and in a client-side plan choice. Enforce it on the server, reading `User.isTester` from the
database, at every step of the subscription payment flow: intent creation, the CloudPayments
`check` webhook and (as defence in depth) the `pay` webhook. Details are in GIPITI-159.

No schema change: the `Subscription` table has no tester flag, and this branch must not add a
migration. The server-side source of truth is a named constant in `lib/billing/tester-plans.ts`,
guarded against drift from the seed by a unit test. The long-term home of this fact is a column on
`Subscription` (for example `isTesterOnly`), which can replace the constant once the parallel
migration work has landed.

## Files

- `lib/billing/tester-plans.ts` (new): `TESTER_ONLY_SUBSCRIPTION_CODES`,
  `isTesterOnlySubscriptionCode(code)`, pure `isSubscriptionPurchaseAllowed({ code, isTester })`,
  async `canPurchaseSubscription({ userId, code })` (reads `isTester` from `User`).
- `lib/validation/subscription-intent.ts` (new): zod schema for the create-intent body.
- `app/api/payment/create-intent/route.ts`: validate the body (400), refuse a tester-only plan for
  a non-tester (403, no `PaymentIntent` row). Top-up intents (`/api/topup/create-intent`) are not
  touched.
- `app/api/webhooks/cloudpayments/lib/handlers/check.ts`: one call after the plan lookup; decline
  with code 13 (the code used for a rejected plan).
- `app/api/webhooks/cloudpayments/lib/handlers/pay.ts`: one guard after the user lookup; do not
  activate, log that manual reconciliation is required, acknowledge with code 0.
- Tests: `lib/billing/__tests__/tester-plans.test.ts`,
  `app/api/payment/create-intent/__tests__/route.test.ts`,
  `app/api/webhooks/cloudpayments/lib/handlers/__tests__/tester-plan.test.ts`.

## Order of work

1. Tests for `tester-plans`, then the module.
2. Tests for create-intent, then the schema and route change.
3. Tests for `check` and `pay`, then the two call sites.
4. Lint, typecheck, unit tests, build.

## Risks

- A tester whose `isTester` flag is later cleared would have a renewal `Pay` for `tester_paid`
  acknowledged without extending the subscription. This is the intended rule; the log line asks
  for manual reconciliation.
- `check.ts` is edited in parallel for GIPITI-113; the change there is kept to one small block
  next to the plan lookup.
- The constant can drift from the seed; the unit test fails if it does.

## Verification

- `pnpm lint`, `pnpm typecheck`, `pnpm vitest run --exclude ".claude/**"`, `pnpm exec next build`.
