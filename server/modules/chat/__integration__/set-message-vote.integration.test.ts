import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/connection";
import { vote } from "@/server/db/schema";
import {
  deleteUsers,
  seedChat,
  seedMessage,
  seedUser,
} from "@/server/modules/chat/__integration__/seed-chat-data";
import { listChatVotes } from "@/server/modules/chat/list-chat-votes";
import { setMessageVote } from "@/server/modules/chat/set-message-vote";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const createdUserIds: string[] = [];

const seedTestUser = async (): Promise<string> => {
  const userId = await seedUser();
  createdUserIds.push(userId);

  return userId;
};

const readVoteRows = async (chatId: string) =>
  await db.select().from(vote).where(eq(vote.chatId, chatId));

describe("voting on messages against a real database", () => {
  beforeEach(() => {
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    await deleteUsers(createdUserIds);
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("stores a vote, replaces it on a second call, and lists it", async () => {
    // Arrange
    const userId = await seedTestUser();
    const chatId = await seedChat({ userId, createdAt: "2026-06-01 10:00:00" });
    const messageId = await seedMessage({
      chatId,
      createdAt: "2026-06-01 10:00:01",
    });

    // Act
    const up = await setMessageVote({
      userId,
      chatId,
      messageId,
      isUpvoted: true,
    });
    const upAgain = await setMessageVote({
      userId,
      chatId,
      messageId,
      isUpvoted: true,
    });
    const down = await setMessageVote({
      userId,
      chatId,
      messageId,
      isUpvoted: false,
    });
    const listed = await listChatVotes({ userId, chatId });

    // Assert
    expect([up, upAgain, down]).toEqual([
      { status: "voted" },
      { status: "voted" },
      { status: "voted" },
    ]);
    expect(await readVoteRows(chatId)).toHaveLength(1);
    expect(listed).toEqual({
      status: "ok",
      votes: [{ messageId, isUpvoted: false }],
    });
  });

  it("reports a message of another chat as not found and stores nothing", async () => {
    // Arrange
    const userId = await seedTestUser();
    const chatId = await seedChat({ userId, createdAt: "2026-06-01 10:00:00" });
    const otherChatId = await seedChat({
      userId,
      createdAt: "2026-06-02 10:00:00",
    });
    const messageInOtherChat = await seedMessage({
      chatId: otherChatId,
      createdAt: "2026-06-02 10:00:01",
    });

    // Act
    const result = await setMessageVote({
      userId,
      chatId,
      messageId: messageInOtherChat,
      isUpvoted: true,
    });

    // Assert
    expect(result).toEqual({ status: "message_not_found" });
    expect(await readVoteRows(chatId)).toHaveLength(0);
    expect(await readVoteRows(otherChatId)).toHaveLength(0);
  });

  it("reports another user's chat as not found for both voting and listing", async () => {
    // Arrange
    const callerId = await seedTestUser();
    const ownerId = await seedTestUser();
    const chatId = await seedChat({
      userId: ownerId,
      createdAt: "2026-06-01 10:00:00",
    });
    const messageId = await seedMessage({
      chatId,
      createdAt: "2026-06-01 10:00:01",
    });

    // Act
    const voted = await setMessageVote({
      userId: callerId,
      chatId,
      messageId,
      isUpvoted: true,
    });
    const listed = await listChatVotes({ userId: callerId, chatId });

    // Assert
    expect(voted).toEqual({ status: "chat_not_found" });
    expect(listed).toEqual({ status: "chat_not_found" });
    expect(await readVoteRows(chatId)).toHaveLength(0);
  });
});
