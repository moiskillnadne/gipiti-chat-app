---
date: 2026-11-15
status: done
branch: fix/gipiti-119-remove-unpaid-subscription-activation
issue: GIPITI-119
---

# Remove unpaid subscription activation (GIPITI-119)

## Goal

`POST /api/subscription` and its helper `upgradeToPlan` activate a plan outside the CloudPayments
payment flow. Subscriptions must be created only by the CloudPayments `pay` webhook. The finding
and its reproduction are in GIPITI-119.

No client code calls this `POST` (only `DELETE` and `GET` have callers), and `upgradeToPlan` has
no other caller. So the fix is to delete both.

Out of scope, tracked separately:

- The renewal rules of the `reset-quotas` cron (GIPITI-113).
- The production data check described in the issue; the owner runs it.

## Files

- `app/(chat)/api/subscription/route.ts`: delete the `POST` handler, the `UpgradeRequestBody`
  type and the `upgradeToPlan` import. `GET` and `DELETE` are untouched.
- `lib/subscription/subscription-init.ts`: delete `upgradeToPlan` and the imports only it used.
  `assignFreePlan` stays (used by the `cleanup-cancelled` cron).
- `app/(chat)/api/subscription/__tests__/route.test.ts` (new): the route module exports no
  `POST`, and `subscription-init` exports no `upgradeToPlan`.

## Order of work

1. Write the test and see it fail on the current code.
2. Delete the handler and the function.
3. `pnpm check`.
4. Verify in the running app: `POST /api/subscription` returns 405, and the test user's balance
   and `UserSubscription` rows are unchanged.

## Risks

- A hidden caller of the `POST`. Checked with `git grep "api/subscription"`: the only fetches are
  the two `DELETE` calls in `cancel-flow-dialog.tsx` and `use-cancel-subscription.ts`.
- Scripts or tests importing `upgradeToPlan`. Checked with `git grep upgradeToPlan`: none.

## Verification

- `pnpm vitest run "app/(chat)/api/subscription/__tests__/route.test.ts"`
- `pnpm check`
- Local dev server: `POST /api/subscription` with a plan code as the signed-in test user returns
  405; `GET /api/subscription` shows the same balance before and after.
