---
date: 2026-11-16
status: done
branch: claude/wonderful-borg-6c726b
issue: GIPITI-228
---

# Fix the connection-pool deadlock in usage charging (GIPITI-228)

## Goal

`chargeUsage` opens a transaction, locks the user's `Balance` row and then reads the currency's
minor units and FX rate through the global `db`. Each charge therefore holds one pool connection
and waits for a second. With as many charges in that window as the pool has connections (10),
every lookup waits for a connection that is never released: the instance's pool hangs, and
`chargeUsageSafe` catches errors, not hangs.

After this change no query goes through the global `db` while a billing transaction callback is
running. Amounts, `Transaction` rows, return values and the `null` results stay the same.

## Approach

Give the lookup functions an optional executor (the pooled `db` by default) and pass the
transaction to them from `chargeUsage`.

Reading the pricing before the transaction was rejected: the currency comes from the balance row,
so it would need an unlocked read of that row first, then a re-check after the lock. That is one
more query per charge and a new edge case. With the executor the statements and their order are
unchanged: lock the row, then price it in the locked row's currency, on one connection.

## Files

- `lib/db/connection.ts` — export the `DatabaseExecutor` type (pooled `db` or a transaction).
- `lib/billing/currencies.ts` — `getCurrencyByCode`, `getMinorUnits` take an optional executor.
- `lib/billing/fx.ts` — `getLatestFxRate`, `getCurrencyPricing` take an optional executor.
- `lib/billing/balance.ts` — `chargeUsage` passes `tx` to `getCurrencyPricing`.
- `lib/billing/__integration__/charge-usage.integration.test.ts` — charges above the pool size,
  for different users and for one user, with a deadline; `CONCURRENT_CHARGES` above the pool size.
- `tests/integration/helpers.ts` — pool size and the deadline helper.
- `lib/billing/__tests__/charge-usage-executor.test.ts` (new) — unit test that the pricing lookup
  receives the transaction, so `pnpm check` guards the fix without a database.

## Audit of the other lock-then-update functions

Checked every `db.transaction` callback in `lib/billing/balance.ts` and `lib/billing/refund.ts`.
Only `chargeUsage` queries through the global `db` inside its callback. `creditBalance`,
`creditTopupForIntent`, `grantEmailVerificationBonus`, `grantQuizBonus`, `resetSubscriptionPool`
and `applyPaymentRefund` do their global reads (`ensureBalance`, `getBalance`, `getMinorUnits`,
`assertEmailVerified`) before the transaction opens and use only `tx` inside it.

## Order of work

1. Regression tests in the integration file; run `pnpm test:integration` and see them fail.
2. Executor parameter and the `chargeUsage` change; unit test.
3. `pnpm test:integration`, then `pnpm check`.

## Risks

- A deadlocked test leaves transactions holding row locks. The deadline helper destroys the pool
  on timeout so the locks are released and the run ends quickly; later tests in the same file then
  fail with `CONNECTION_ENDED`, so the two regression cases are the last ones in the file.
- Unit tests that mock `getCurrencyPricing` keep working: the new argument is optional and
  `turn-balance.ts` still calls it with the currency code only.

## Verification

- `pnpm test:integration`: the new cases fail before the fix and pass after it.
- `pnpm check`.
