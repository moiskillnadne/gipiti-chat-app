---
date: 2026-10-13
status: done
branch: feat/cloudpayments-refund-webhook
session: 8337cf75-7bf9-4efe-83fb-5aae46cef3df
---

# CloudPayments refund webhook handler

## Context

A user asked for a refund; it will be issued from the CloudPayments back office. Today the
webhook route (`app/api/webhooks/cloudpayments/route.ts`) only knows
`check/pay/fail/recurrent/cancel` — a Refund notification gets a 400 and nothing in the DB
changes, so the user would keep the refunded money on their GIPITI balance (and a refunded
subscription would keep renewing). Goal: a `type=refund` handler that automatically takes the
refunded money back off the balance and, for a fully refunded subscription, stops it.

Refund notification payload (CP docs, `cloudpayments-documentation.en.md` §Refund):
`TransactionId` (refund txn), `PaymentTransactionId` (original payment), `Amount` (major
units), `DateTime`, `OperationType`, optional `InvoiceId`, `AccountId`, `Email`, `Data`.
Only valid response: `{"code":0}`.

## Behaviour

1. Find the original payment: `PaymentIntent` by `externalTransactionId = PaymentTransactionId`
   (the pay handler writes it for both top-ups and subscription purchases/renewals). If
   `AccountId` is present it must match `intent.userId`.
   Not found / mismatch → `console.error` with all ids ("manual reconciliation required"),
   respond `code: 0` (retries can't fix it).
2. Convert `Amount` to minor units with `getMinorUnits(intent.currencyCode)` +
   `majorToMinorUnits` (`lib/billing/money.ts`, `currencies.ts`).
3. In one DB transaction with `Balance` row locked `FOR UPDATE` (same pattern as
   `grantEmailVerificationBonus` in `lib/billing/balance.ts`):
   - **Idempotency**: if a `Transaction` with `type='refund'`, `referenceType='cloudpayments_refund'`,
     `referenceId=<refund TransactionId>` exists → return `duplicate` (covered by
     `transaction_reference_idx`).
   - Debit the pool the payment went into (`topup` for kind topup, `subscription` for kind
     subscription): `debit = min(refundMinor, poolBalance)` — floors at zero, never touches the
     other pool (the user's separately paid money stays theirs).
   - Insert a `refund` Transaction: `amount = -debit` (0 allowed, still recorded for audit +
     idempotency), balances after, `metadata = { refundOf, paymentIntentId, refundedAmount }`.
   - `isFullyRefunded` = sum of `metadata.refundedAmount` over prior refunds of the same payment
     + this refund ≥ `intent.amount` (supports several partial refunds adding up to full).
4. Subscription payment **fully** refunded and its `UserSubscription` still `active`:
   - Cancel the CloudPayments recurrent via existing `cancelSubscription()`
     (`lib/payments/cloudpayments.ts`) when `externalSubscriptionId` is set. Failure → loud
     `console.error` asking to cancel it manually in the back office; still respond 0.
   - Close it immediately in DB: `status='cancelled'`, `cancelledAt=now`,
     `currentPeriodEnd=now`, `cancelAtPeriodEnd=true`. (The follow-up `cancel` webhook only
     sets `cancelAtPeriodEnd`, so it won't undo this.)
   - Partial subscription refund (goodwill/compensation) → only the balance debit.
5. Unexpected exceptions → `code: 13` so CP retries; the idempotency key makes retries safe.

`PaymentIntent.status` stays `succeeded` (no `refunded` enum value; avoids a migration) — the
refund is linked via the Transaction row.

## Files

- `lib/payments/cloudpayments-types.ts` — add `CloudPaymentsRefundWebhook`.
- `lib/billing/refund.ts` (new) — pure `planRefundDebit()` + `applyPaymentRefund()` (step 3).
- `lib/billing/balance.ts` + `lib/db/schema.ts` — add `refundedAmount?: number` to the
  Transaction metadata type (jsonb `$type` only, no migration).
- `app/api/webhooks/cloudpayments/lib/handlers/refund.ts` (new) — steps 1, 2, 4, 5.
- `app/api/webhooks/cloudpayments/route.ts` — accept `type=refund`, dispatch.
- `lib/billing/__tests__/refund.test.ts` (new) — `planRefundDebit`: full refund, partial,
  pool already spent (floors at 0), several partials adding up to full, over-refund.
- Docs: CLAUDE.md Payments line + `.cursor/rules/cloudpayments.mdc` list `refund`.

## Order of work

Branch `feat/cloudpayments-refund-webhook` from `origin/main` → types → `lib/billing/refund.ts` +
tests → handler → route → docs → `pnpm check`.

## Risks

- Webhook must be **deployed and configured before** the refund is issued: in CP back office
  → Settings → Notifications → Refund: `https://<prod-domain>/api/webhooks/cloudpayments?type=refund`.
  A refund done earlier won't be replayed — fall back to the manual SQL from the previous answer.
- Old payments made before `PaymentIntent.externalTransactionId` was written → not found →
  logged for manual handling.
- Refunding an old month of a still-running subscription in full would cancel that
  subscription — acceptable (a full refund means the customer is leaving); partials don't.

## Verification

- `pnpm check` (typecheck, Biome, unit tests incl. new `refund.test.ts`, build).
- Signed-request smoke test is not possible locally without `CLOUDPAYMENTS_API_SECRET` + DB; after
  deploy, check Vercel logs for `[CloudPayments:Refund]` on the real refund and verify the
  `Transaction`/`Balance` rows with a SELECT.

## Changes during implementation (review findings)

- `pay.ts` stored `externalTransactionId` only when CP sent `TransactionId` as a number; form-urlencoded
  notifications send strings, so refunds could never be matched. Shared `toTransactionId()` in
  `handlers/utils.ts` now normalizes both (used by pay + refund).
- `pay.ts` reused the session intent for recurrent charges (CP echoes the widget `Data`), overwriting
  the purchase's transaction id. A session intent is now reused only for its own payment; otherwise a
  `cp_txn_<id>` intent is inserted.
- `recurrent.ts` `Cancelled`/`Expired` set `status: "active"` — the Cancelled notification triggered by
  our own recurrent cancel would resurrect a refunded subscription. Already-cancelled rows are now left
  alone.
- Known limitation: a full refund of an older subscription payment debits the current subscription pool
  (funded by the latest payment) and ends the current period.
