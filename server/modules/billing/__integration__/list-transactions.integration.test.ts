import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/server/api/_kit/pagination";
import { db } from "@/server/db/connection";
import { listTransactions } from "@/server/modules/billing/list-transactions";
import {
  buildCountUserTransactionsQuery,
  buildTransactionPageQuery,
  countUserTransactions,
} from "@/server/modules/billing/queries/list-transactions-page";
import { seedChat } from "@/server/modules/chat/__integration__/seed-chat-data";
import {
  closeDatabaseConnection,
  resetMoneyTables,
  seedCurrency,
  seedUserWithBalance,
} from "@/tests/integration/helpers";
import { seedTransaction } from "./seed-billing-data";

const RANGE_ON_CREATED_AT_PATTERN = /Index Cond:.*created_at <=/;

/** Reads a whole list the way a client does: every cursor goes through the real codec. */
const walkPages = async ({
  userId,
  limit,
  firstCursor = null,
}: {
  userId: string;
  limit: number;
  firstCursor?: string | null;
}): Promise<{ ids: string[][]; totals: number[] }> => {
  const ids: string[][] = [];
  const totals: number[] = [];
  let cursor = firstCursor;

  do {
    const decoded = cursor === null ? null : decodeCursor(cursor);
    if (decoded?.status === "invalid") {
      throw new Error("the service produced a cursor the codec refuses");
    }

    const page = await listTransactions({
      userId,
      limit,
      after: decoded?.position ?? null,
    });
    ids.push(page.transactions.map((row) => row.id));
    totals.push(page.totalCount);

    const last = page.transactions.at(-1);
    cursor =
      page.hasMore && last
        ? encodeCursor({ createdAt: last.createdAtText, id: last.id })
        : null;
  } while (cursor !== null);

  return { ids, totals };
};

const explain = async (queryText: string, params: unknown[]) =>
  await db.$client.begin(async (transaction) => {
    // The planner is told not to scan the table, so the answer shows which
    // index it would pick, whatever the size of the test table.
    await transaction.unsafe("SET LOCAL enable_seqscan = off");
    const rows = await transaction.unsafe(
      `EXPLAIN ${queryText}`,
      params as string[]
    );

    return rows.map((row) => String(row["QUERY PLAN"])).join("\n");
  });

describe("listing transactions by cursor against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("walks three pages newest first with no gap and no repeat, over equal and microsecond-apart timestamps", async () => {
    // Arrange: two rows share a timestamp exactly, two differ by one microsecond
    const userId = await seedUserWithBalance();
    const stamps = [
      "2026-01-01 10:00:00",
      "2026-01-02 10:00:00",
      "2026-01-03 10:00:00",
      "2026-01-03 10:00:00",
      "2026-01-04 10:00:00.000001",
      "2026-01-04 10:00:00.000002",
      "2026-01-05 10:00:00",
    ];
    const seededIds: string[] = [];
    for (const createdAt of stamps) {
      seededIds.push(await seedTransaction({ userId, createdAt }));
    }
    const expectedOrder = (
      await db.$client`SELECT id FROM "Transaction" WHERE user_id = ${userId} ORDER BY created_at DESC, id DESC`
    ).map((row) => String(row.id));

    // Act
    const { ids, totals } = await walkPages({ userId, limit: 3 });

    // Assert
    expect(ids.map((page) => page.length)).toEqual([3, 3, 1]);
    expect(ids.flat()).toEqual(expectedOrder);
    expect(new Set(ids.flat())).toEqual(new Set(seededIds));
    expect(totals).toEqual([7, 7, 7]);
  });

  it("reports no next page when the list ends exactly at a page boundary", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedTransaction({ userId, createdAt: "2026-01-01 10:00:00" });
    await seedTransaction({ userId, createdAt: "2026-01-02 10:00:00" });

    // Act
    const page = await listTransactions({ userId, limit: 2, after: null });

    // Assert
    expect(page.transactions).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it("counts and lists only the caller's rows, and an empty list for a user without any", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const otherUserId = await seedUserWithBalance();
    await seedTransaction({ userId, createdAt: "2026-01-01 10:00:00" });
    await seedTransaction({ userId, createdAt: "2026-01-02 10:00:00" });
    await seedTransaction({
      userId: otherUserId,
      createdAt: "2026-01-03 10:00:00",
    });
    const idleUserId = await seedUserWithBalance();

    // Act
    const own = await listTransactions({ userId, limit: 20, after: null });
    const idle = await listTransactions({
      userId: idleUserId,
      limit: 20,
      after: null,
    });

    // Assert
    expect(own.totalCount).toBe(2);
    expect(own.transactions).toHaveLength(2);
    expect(await countUserTransactions(otherUserId)).toBe(1);
    expect(idle).toEqual({ transactions: [], hasMore: false, totalCount: 0 });
  });

  it("returns only the caller's rows for a cursor taken from another user's list", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const otherUserId = await seedUserWithBalance();
    const ownIds = [
      await seedTransaction({ userId, createdAt: "2026-01-01 10:00:00" }),
      await seedTransaction({ userId, createdAt: "2026-01-05 10:00:00" }),
    ];
    const foreignId = await seedTransaction({
      userId: otherUserId,
      createdAt: "2026-01-03 10:00:00",
    });
    const foreignCursor = encodeCursor({
      createdAt: "2026-01-03 10:00:00.000000",
      id: foreignId,
    });

    // Act
    const { ids } = await walkPages({
      userId,
      limit: 20,
      firstCursor: foreignCursor,
    });

    // Assert: the position is a time, not a row: only the caller's older row is left
    expect(ids.flat()).toEqual([ownIds[0]]);
  });

  it("carries the chat title of a usage debit, the description of a credit, and the signed amount", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const chatId = await seedChat({
      userId,
      createdAt: "2026-01-01 09:00:00",
      title: "Trip plan",
    });
    await seedTransaction({
      userId,
      createdAt: "2026-01-01 10:00:00",
      chatId,
      modelId: "openai/gpt-5",
      amount: -1250,
    });
    await seedTransaction({
      userId,
      createdAt: "2026-01-02 10:00:00",
      type: "welcome",
      pool: "topup",
      amount: 10_000,
      description: "Welcome bonus",
    });

    // Act
    const page = await listTransactions({ userId, limit: 20, after: null });

    // Assert
    expect(page.transactions).toMatchObject([
      {
        type: "welcome",
        pool: "topup",
        amount: 10_000,
        currencyCode: "RUB",
        description: "Welcome bonus",
        chatTitle: null,
      },
      {
        type: "usage_debit",
        amount: -1250,
        modelId: "openai/gpt-5",
        chatTitle: "Trip plan",
      },
    ]);
  });

  it("serves the page from transaction_user_created_idx with a range on created_at", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedTransaction({ userId, createdAt: "2026-03-01 10:00:00" });
    const { sql: queryText, params } = buildTransactionPageQuery({
      userId,
      limit: 20,
      after: {
        createdAt: "2026-03-02 00:00:00.000001",
        id: "00000000-0000-4000-8000-000000000000",
      },
    }).toSQL();

    // Act
    const plan = await explain(queryText, params);

    // Assert
    expect(plan).toContain("transaction_user_created_idx");
    expect(plan).toMatch(RANGE_ON_CREATED_AT_PATTERN);
    expect(plan).toContain("Incremental Sort");
  });

  it("counts a user's transactions with an index-only scan, not a table scan", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    await seedTransaction({ userId, createdAt: "2026-03-01 10:00:00" });

    // Act
    const { sql: queryText, params } =
      buildCountUserTransactionsQuery(userId).toSQL();
    const plan = await explain(queryText, params);

    // Assert
    expect(plan).toContain(
      "Index Only Scan using transaction_user_created_idx"
    );
  });
});
