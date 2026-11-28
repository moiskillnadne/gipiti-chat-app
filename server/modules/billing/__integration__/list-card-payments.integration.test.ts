import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/server/api/_kit/pagination";
import { db } from "@/server/db/connection";
import { listCardPayments } from "@/server/modules/billing/list-card-payments";
import { getCardPayments } from "@/server/modules/billing/payment-history";
import { buildCardPaymentPageQuery } from "@/server/modules/billing/queries/list-card-payments-page";
import {
  closeDatabaseConnection,
  resetMoneyTables,
  seedCurrency,
  seedUserWithBalance,
} from "@/tests/integration/helpers";
import { seedTransaction } from "./seed-billing-data";

const walkPayments = async (
  userId: string,
  limit: number
): Promise<{ id: string; chargedMinor: number }[][]> => {
  const pages: { id: string; chargedMinor: number }[][] = [];
  let cursor: string | null = null;

  do {
    const decoded = cursor === null ? null : decodeCursor(cursor);
    if (decoded?.status === "invalid") {
      throw new Error("the service produced a cursor the codec refuses");
    }

    const page = await listCardPayments({
      userId,
      limit,
      after: decoded?.position ?? null,
    });
    pages.push(
      page.payments.map(({ id, chargedMinor }) => ({ id, chargedMinor }))
    );

    const last = page.payments.at(-1);
    cursor =
      page.hasMore && last
        ? encodeCursor({ createdAt: last.createdAtText, id: last.id })
        : null;
  } while (cursor !== null);

  return pages;
};

const SUBSCRIPTION_METADATA = { subscriptionCode: "basic_monthly" };

/**
 * Real card charges (a purchase, a renewal, a top-up), rows no card paid for
 * (a tester's cron renewal, the reset to zero of a free plan, a welcome bonus,
 * a usage debit, a refund), and the paid rows written the way the webhooks
 * write them.
 */
const seedPaymentHistory = async (userId: string): Promise<void> => {
  await seedTransaction({
    userId,
    createdAt: "2026-01-01 10:00:00",
    type: "welcome",
    pool: "topup",
    amount: 10_000,
  });
  await seedTransaction({
    userId,
    createdAt: "2026-01-02 10:00:00",
    type: "subscription_purchase",
    amount: 99_000,
    subscriptionBalanceAfter: 99_000,
    referenceType: "subscription",
    referenceId: "2001",
    metadata: SUBSCRIPTION_METADATA,
  });
  await seedTransaction({
    userId,
    createdAt: "2026-01-03 10:00:00",
    type: "usage_debit",
    amount: -5000,
  });
  // A renewal by CloudPayments: the pool is reset, so `amount` is the delta.
  await seedTransaction({
    userId,
    createdAt: "2026-02-02 10:00:00",
    type: "subscription_renewal",
    amount: 40_000,
    subscriptionBalanceAfter: 99_000,
    referenceType: "subscription",
    referenceId: "sc_provider",
    metadata: SUBSCRIPTION_METADATA,
  });
  await seedTransaction({
    userId,
    createdAt: "2026-02-10 10:00:00",
    type: "topup_purchase",
    pool: "topup",
    amount: 50_000,
    subscriptionBalanceAfter: 12_345,
    referenceType: "payment_intent",
    referenceId: randomUUID(),
  });
  await seedTransaction({
    userId,
    createdAt: "2026-02-11 10:00:00",
    type: "refund",
    amount: -50_000,
  });
};

/** The rows `getCardPayments` lists that no card paid for. */
const seedNonCardRows = async (userId: string): Promise<string[]> => [
  // assignFreePlan: the pool is reset to 0 when a subscription ends.
  await seedTransaction({
    userId,
    createdAt: "2026-02-20 10:00:00",
    type: "subscription_renewal",
    amount: -99_000,
    subscriptionBalanceAfter: 0,
    metadata: { previousSubscriptionAmount: 99_000 },
  }),
  // The reset-quotas cron renewing a tester: a plan price, no card.
  await seedTransaction({
    userId,
    createdAt: "2026-02-21 10:00:00",
    type: "subscription_renewal",
    amount: 99_000,
    subscriptionBalanceAfter: 99_000,
    referenceType: "subscription",
    referenceId: randomUUID(),
    metadata: { previousSubscriptionAmount: 0 },
  }),
];

describe("listing card payments by cursor against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("returns the rows getCardPayments returns minus the ones no card paid for", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedPaymentHistory(userId);
    const nonCardIds = await seedNonCardRows(userId);

    // Act
    const page = await listCardPayments({ userId, limit: 100, after: null });
    const legacy = await getCardPayments({ userId, limit: 100 });

    // Assert
    expect(legacy.map((row) => row.id)).toEqual(
      expect.arrayContaining(nonCardIds)
    );
    expect(
      page.payments.map(({ id, type, chargedMinor, createdAt }) => ({
        id,
        type,
        chargedMinor,
        createdAt,
      }))
    ).toEqual(legacy.filter((row) => !nonCardIds.includes(row.id)));
    expect(page.payments.map((row) => row.chargedMinor)).toEqual([
      50_000, // a top-up is charged what it credited
      99_000, // a renewal is charged the plan price, not the pool delta
      99_000, // a purchase
    ]);
    expect(page.payments.every((row) => row.chargedMinor > 0)).toBe(true);
  });

  it("leaves out a free-plan reset and a tester's cron renewal, and pages correctly after the filter", async () => {
    // Arrange: non-card rows between card rows must not shorten or end a page
    const userId = await seedUserWithBalance();
    await seedPaymentHistory(userId);
    await seedNonCardRows(userId);

    // Act
    const pages = await walkPayments(userId, 1);

    // Assert
    expect(pages.map((page) => page.length)).toEqual([1, 1, 1]);
    expect(pages.flat().map((row) => row.chargedMinor)).toEqual([
      50_000, 99_000, 99_000,
    ]);
  });

  it("pages newest first with no gap and no repeat", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedPaymentHistory(userId);
    for (const day of ["03", "04"]) {
      await seedTransaction({
        userId,
        createdAt: `2026-03-${day} 10:00:00.000001`,
        type: "topup_purchase",
        pool: "topup",
        amount: 1000,
        referenceType: "payment_intent",
      });
    }
    const legacy = await getCardPayments({ userId, limit: 100 });

    // Act
    const pages = await walkPayments(userId, 2);

    // Assert
    expect(pages.map((page) => page.length)).toEqual([2, 2, 1]);
    expect(pages.flat().map((row) => row.id)).toEqual(
      legacy.map((row) => row.id)
    );
  });

  it("lists only the caller's payments, also for another user's cursor, and nothing for a user who never paid", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const otherUserId = await seedUserWithBalance();
    await seedPaymentHistory(userId);
    const foreignId = await seedTransaction({
      userId: otherUserId,
      createdAt: "2026-02-05 10:00:00",
      type: "topup_purchase",
      pool: "topup",
      amount: 7000,
      referenceType: "payment_intent",
    });
    const idleUserId = await seedUserWithBalance();

    // Act
    const own = await walkPayments(userId, 100);
    const fromForeignCursor = await listCardPayments({
      userId,
      limit: 100,
      after: { createdAt: "2026-02-05 10:00:00.000000", id: foreignId },
    });
    const idle = await listCardPayments({
      userId: idleUserId,
      limit: 100,
      after: null,
    });

    // Assert
    expect(own.flat().map((row) => row.id)).not.toContain(foreignId);
    expect(own.flat()).toHaveLength(3);
    expect(fromForeignCursor.payments.map((row) => row.chargedMinor)).toEqual([
      99_000, 99_000,
    ]);
    expect(idle).toEqual({ payments: [], hasMore: false });
  });

  it("serves the page from transaction_user_created_idx", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedPaymentHistory(userId);
    const { sql: queryText, params } = buildCardPaymentPageQuery({
      userId,
      limit: 20,
      after: null,
    }).toSQL();

    // Act
    const plan = await db.$client.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL enable_seqscan = off");
      const rows = await transaction.unsafe(
        `EXPLAIN ${queryText}`,
        params as string[]
      );

      return rows.map((row) => String(row["QUERY PLAN"])).join("\n");
    });

    // Assert
    expect(plan).toContain("transaction_user_created_idx");
  });
});
