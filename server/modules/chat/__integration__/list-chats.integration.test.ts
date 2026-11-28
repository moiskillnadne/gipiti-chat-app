import { sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "@/server/api/_kit/pagination";
import { db } from "@/server/db/connection";
import {
  deleteUsers,
  seedChat,
  seedUser,
} from "@/server/modules/chat/__integration__/seed-chat-data";
import { listChats } from "@/server/modules/chat/list-chats";
import {
  buildChatPageQuery,
  listChatsPage,
} from "@/server/modules/chat/queries/list-chats-page";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const RANGE_ON_CREATED_AT_PATTERN = /Index Cond:.*"createdAt" <=/;

const createdUserIds: string[] = [];

const seedTestUser = async (): Promise<string> => {
  const userId = await seedUser();
  createdUserIds.push(userId);

  return userId;
};

/**
 * Reads a whole list the way a client does: every cursor goes through the
 * real codec, exactly as `GET /chats` encodes and decodes it.
 */
const walkPages = async ({
  userId,
  limit,
}: {
  userId: string;
  limit: number;
}): Promise<string[][]> => {
  const pages: string[][] = [];
  let cursor: string | null = null;

  do {
    const decoded: ReturnType<typeof decodeCursor> | null =
      cursor === null ? null : decodeCursor(cursor);
    if (decoded?.status === "invalid") {
      throw new Error("the service produced a cursor the codec refuses");
    }

    const page = await listChats({
      userId,
      limit,
      after: decoded?.position ?? null,
    });
    pages.push(page.chats.map((chat) => chat.id));

    const last = page.chats.at(-1);
    cursor =
      page.hasMore && last
        ? encodeCursor({ createdAt: last.createdAtText, id: last.id })
        : null;
  } while (cursor !== null);

  return pages;
};

describe("listing chats by cursor against a real database", () => {
  beforeEach(() => {
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    await deleteUsers(createdUserIds);
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("walks three pages newest first with no gap and no repeat", async () => {
    // Arrange
    const userId = await seedTestUser();
    const chatIdsOldestFirst: string[] = [];
    for (const day of ["01", "02", "03", "04", "05"]) {
      chatIdsOldestFirst.push(
        await seedChat({ userId, createdAt: `2026-01-${day} 10:00:00` })
      );
    }
    const newestFirst = [...chatIdsOldestFirst].reverse();

    // Act
    const pages = await walkPages({ userId, limit: 2 });

    // Assert
    expect(pages).toEqual([
      newestFirst.slice(0, 2),
      newestFirst.slice(2, 4),
      newestFirst.slice(4),
    ]);
  });

  it("reports no next page when the list ends exactly at a page boundary", async () => {
    // Arrange
    const userId = await seedTestUser();
    await seedChat({ userId, createdAt: "2026-01-01 10:00:00" });
    await seedChat({ userId, createdAt: "2026-01-02 10:00:00" });

    // Act
    const page = await listChats({ userId, limit: 2, after: null });

    // Assert
    expect(page.chats).toHaveLength(2);
    expect(page.hasMore).toBe(false);
  });

  it("answers an empty page for a user with no chats", async () => {
    // Arrange
    const userId = await seedTestUser();

    // Act
    const page = await listChats({ userId, limit: 20, after: null });

    // Assert
    expect(page).toEqual({ chats: [], hasMore: false });
  });

  it("pages chats with an identical createdAt without skipping or repeating one", async () => {
    // Arrange
    const userId = await seedTestUser();
    const sameInstant = "2026-02-01 12:00:00.5";
    const chatIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      chatIds.push(await seedChat({ userId, createdAt: sameInstant }));
    }

    // Act
    const pages = await walkPages({ userId, limit: 2 });

    // Assert
    const walked = pages.flat();
    expect(pages.map((page) => page.length)).toEqual([2, 2, 1]);
    expect(new Set(walked).size).toBe(5);
    expect([...walked].sort()).toEqual([...chatIds].sort());
    // Ties are broken by id, newest (largest) first.
    expect(walked).toEqual([...chatIds].sort().reverse());
  });

  it("pages chats that differ only below the millisecond in their true order", async () => {
    // Arrange
    const userId = await seedTestUser();
    const microsecondTimes = [
      "2026-02-01 12:00:00.123100",
      "2026-02-01 12:00:00.123200",
      "2026-02-01 12:00:00.123300",
      "2026-02-01 12:00:00.123999",
      "2026-02-01 12:00:00.124000",
    ];
    const chatIdsOldestFirst: string[] = [];
    for (const createdAt of microsecondTimes) {
      chatIdsOldestFirst.push(await seedChat({ userId, createdAt }));
    }

    // Act
    const pagesOfOne = await walkPages({ userId, limit: 1 });
    const pagesOfTwo = await walkPages({ userId, limit: 2 });

    // Assert
    const newestFirst = [...chatIdsOldestFirst].reverse();
    expect(pagesOfOne.flat()).toEqual(newestFirst);
    expect(pagesOfTwo.flat()).toEqual(newestFirst);
  });

  it("keeps the full precision in the position it hands out", async () => {
    // Arrange
    const userId = await seedTestUser();
    await seedChat({ userId, createdAt: "2026-02-01 12:00:00.123456" });

    // Act
    const page = await listChats({ userId, limit: 1, after: null });

    // Assert
    expect(page.chats[0].createdAtText).toBe("2026-02-01 12:00:00.123456");
    expect(page.chats[0].createdAt.toISOString()).toBe(
      "2026-02-01T12:00:00.123Z"
    );
  });

  it("returns only the caller's chats for a position taken from another user's list", async () => {
    // Arrange
    const callerId = await seedTestUser();
    const strangerId = await seedTestUser();
    const callerNewest = await seedChat({
      userId: callerId,
      createdAt: "2026-03-05 10:00:00",
    });
    const callerMiddle = await seedChat({
      userId: callerId,
      createdAt: "2026-03-03 10:00:00",
    });
    const callerOldest = await seedChat({
      userId: callerId,
      createdAt: "2026-03-01 10:00:00",
    });
    const strangerChat = await seedChat({
      userId: strangerId,
      createdAt: "2026-03-04 10:00:00",
    });
    const strangerPage = await listChats({
      userId: strangerId,
      limit: 1,
      after: null,
    });
    const strangerPosition = {
      createdAt: strangerPage.chats[0].createdAtText,
      id: strangerPage.chats[0].id,
    };

    // Act
    const page = await listChats({
      userId: callerId,
      limit: 20,
      after: strangerPosition,
    });

    // Assert
    expect(strangerPosition.id).toBe(strangerChat);
    expect(page.chats.map((chat) => chat.id)).toEqual([
      callerMiddle,
      callerOldest,
    ]);
    expect(page.chats.map((chat) => chat.id)).not.toContain(callerNewest);
    expect(page.chats.map((chat) => chat.id)).not.toContain(strangerChat);
  });

  it("returns nothing of another user's for a position that names no chat at all", async () => {
    // Arrange
    const callerId = await seedTestUser();
    const strangerId = await seedTestUser();
    await seedChat({ userId: strangerId, createdAt: "2026-03-04 10:00:00" });
    const callerChat = await seedChat({
      userId: callerId,
      createdAt: "2026-03-01 10:00:00",
    });

    // Act
    const page = await listChats({
      userId: callerId,
      limit: 20,
      after: {
        createdAt: "2030-01-01 00:00:00",
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      },
    });

    // Assert
    expect(page.chats.map((chat) => chat.id)).toEqual([callerChat]);
  });

  it.each(["German", "SQL, DMY", "Postgres, MDY"])(
    "walks two pages under the DateStyle %s",
    async (dateStyle) => {
      // Arrange
      const userId = await seedTestUser();
      const chatIdsOldestFirst: string[] = [];
      for (const createdAt of [
        "2026-01-01 10:00:00.000001",
        "2026-01-02 10:00:00",
        "2026-01-03 10:00:00.5",
      ]) {
        chatIdsOldestFirst.push(await seedChat({ userId, createdAt }));
      }

      // Act: both pages are read on one connection with another DateStyle.
      const pages = await db.transaction(async (transaction) => {
        await transaction.execute(
          sql.raw(`SET LOCAL DateStyle = '${dateStyle}'`)
        );
        const first = await listChatsPage(
          { userId, limit: 2, after: null },
          transaction
        );
        const last = first.rows[1];
        const decoded = decodeCursor(
          encodeCursor({ createdAt: last.createdAtText, id: last.id })
        );
        if (decoded.status === "invalid") {
          throw new Error("the cursor text was refused");
        }
        const second = await listChatsPage(
          { userId, limit: 2, after: decoded.position },
          transaction
        );

        return [first.rows, second.rows];
      });

      // Assert
      expect(pages.map((rows) => rows.map((row) => row.id))).toEqual([
        [chatIdsOldestFirst[2], chatIdsOldestFirst[1]],
        [chatIdsOldestFirst[0]],
      ]);
    }
  );

  it("can use chat_user_created_idx for a page after a position", async () => {
    // Arrange
    const userId = await seedTestUser();
    await seedChat({ userId, createdAt: "2026-03-01 10:00:00" });
    const { sql: queryText, params } = buildChatPageQuery({
      userId,
      limit: 20,
      after: {
        createdAt: "2026-03-02 00:00:00.000001",
        id: "00000000-0000-4000-8000-000000000000",
      },
    }).toSQL();

    // Act: the planner is told not to scan the table, so the answer shows
    // which index it would pick, whatever the size of the test table.
    const plan = await db.$client.begin(async (transaction) => {
      await transaction.unsafe("SET LOCAL enable_seqscan = off");
      const rows = await transaction.unsafe(
        `EXPLAIN ${queryText}`,
        params as string[]
      );

      return rows.map((row) => String(row["QUERY PLAN"])).join("\n");
    });

    // Assert
    expect(plan).toContain("chat_user_created_idx");
    expect(plan).toMatch(RANGE_ON_CREATED_AT_PATTERN);
  });
});
