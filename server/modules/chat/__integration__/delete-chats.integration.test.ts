import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteUsers,
  readFootprint,
  readMessageIds,
  readVotedMessageIds,
  refuseDeletesOf,
  seedChat,
  seedMessage,
  seedStream,
  seedUser,
  seedVote,
} from "@/server/modules/chat/__integration__/seed-chat-data";
import { deleteAllChatsForUser } from "@/server/modules/chat/delete-all-chats";
import { deleteChatForUser } from "@/server/modules/chat/delete-chat";
import { removeMessagesFrom } from "@/server/modules/chat/remove-messages-from";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const createdUserIds: string[] = [];

const seedTestUser = async (): Promise<string> => {
  const userId = await seedUser();
  createdUserIds.push(userId);

  return userId;
};

type SeededChat = { chatId: string; messageIds: string[] };

/** A chat with two voted messages and one stream. */
const seedFullChat = async ({
  userId,
  createdAt = "2026-04-01 10:00:00",
  title = "Chat",
}: {
  userId: string;
  createdAt?: string;
  title?: string;
}): Promise<SeededChat> => {
  const chatId = await seedChat({ userId, createdAt, title });
  const messageIds = [
    await seedMessage({ chatId, createdAt: "2026-04-01 10:00:01" }),
    await seedMessage({
      chatId,
      createdAt: "2026-04-01 10:00:02",
      role: "assistant",
    }),
  ];
  for (const messageId of messageIds) {
    await seedVote({ chatId, messageId });
  }
  await seedStream(chatId);

  return { chatId, messageIds };
};

const FULL_CHAT_FOOTPRINT = { chats: 1, messages: 2, votes: 2, streams: 1 };
const NO_FOOTPRINT = { chats: 0, messages: 0, votes: 0, streams: 0 };

describe("deleting chats against a real database", () => {
  beforeEach(() => {
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    await deleteUsers(createdUserIds);
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  describe("deleteChatForUser", () => {
    it("removes the chat with its votes, messages and streams and leaves other chats alone", async () => {
      // Arrange
      const userId = await seedTestUser();
      const otherUserId = await seedTestUser();
      const target = await seedFullChat({ userId });
      const sameUsersOtherChat = await seedFullChat({ userId });
      const strangersChat = await seedFullChat({ userId: otherUserId });

      // Act
      const result = await deleteChatForUser({
        userId,
        chatId: target.chatId,
      });

      // Assert
      expect(result).toEqual({ status: "deleted" });
      expect(await readFootprint([target.chatId])).toEqual(NO_FOOTPRINT);
      expect(await readFootprint([sameUsersOtherChat.chatId])).toEqual(
        FULL_CHAT_FOOTPRINT
      );
      expect(await readFootprint([strangersChat.chatId])).toEqual(
        FULL_CHAT_FOOTPRINT
      );
    });

    it("changes nothing for another user's chat and reports not found", async () => {
      // Arrange
      const callerId = await seedTestUser();
      const ownerId = await seedTestUser();
      const ownersChat = await seedFullChat({ userId: ownerId });

      // Act
      const result = await deleteChatForUser({
        userId: callerId,
        chatId: ownersChat.chatId,
      });

      // Assert
      expect(result).toEqual({ status: "chat_not_found" });
      expect(await readFootprint([ownersChat.chatId])).toEqual(
        FULL_CHAT_FOOTPRINT
      );
    });

    it("reports not found for a chat that does not exist", async () => {
      // Arrange
      const userId = await seedTestUser();

      // Act
      const result = await deleteChatForUser({
        userId,
        chatId: "00000000-0000-4000-8000-000000000000",
      });

      // Assert
      expect(result).toEqual({ status: "chat_not_found" });
    });

    it("rolls everything back when a statement in the middle fails", async () => {
      // Arrange
      const userId = await seedTestUser();
      const doomed = await seedFullChat({ userId, title: "it-refuse" });
      const allowDeletes = await refuseDeletesOf({
        table: "Chat",
        column: "title",
        value: "it-refuse",
      });

      // Act: the votes, messages and streams are deleted first and the chat
      // row last, where the database refuses.
      let failure: unknown;
      try {
        await deleteChatForUser({ userId, chatId: doomed.chatId });
      } catch (error) {
        failure = error;
      } finally {
        await allowDeletes();
      }

      // Assert
      expect(failure).toBeInstanceOf(Error);
      expect(await readFootprint([doomed.chatId])).toEqual(FULL_CHAT_FOOTPRINT);
    });
  });

  describe("deleteAllChatsForUser", () => {
    it("removes every chat of the caller and none of anyone else's", async () => {
      // Arrange
      const userId = await seedTestUser();
      const otherUserId = await seedTestUser();
      const first = await seedFullChat({ userId });
      const second = await seedFullChat({
        userId,
        createdAt: "2026-04-02 10:00:00",
      });
      const strangersChat = await seedFullChat({ userId: otherUserId });

      // Act
      const result = await deleteAllChatsForUser({ userId });

      // Assert
      expect(result).toEqual({ deletedCount: 2 });
      expect(await readFootprint([first.chatId, second.chatId])).toEqual(
        NO_FOOTPRINT
      );
      expect(await readFootprint([strangersChat.chatId])).toEqual(
        FULL_CHAT_FOOTPRINT
      );
    });

    it("answers a count of zero for a user with no chats", async () => {
      // Arrange
      const userId = await seedTestUser();

      // Act
      const result = await deleteAllChatsForUser({ userId });

      // Assert
      expect(result).toEqual({ deletedCount: 0 });
    });

    it("rolls everything back when one chat cannot be deleted", async () => {
      // Arrange
      const userId = await seedTestUser();
      const fine = await seedFullChat({ userId });
      const doomed = await seedFullChat({
        userId,
        createdAt: "2026-04-02 10:00:00",
        title: "it-refuse",
      });
      const allowDeletes = await refuseDeletesOf({
        table: "Chat",
        column: "title",
        value: "it-refuse",
      });

      // Act
      let failure: unknown;
      try {
        await deleteAllChatsForUser({ userId });
      } catch (error) {
        failure = error;
      } finally {
        await allowDeletes();
      }

      // Assert: the votes, messages and streams of both chats came back.
      expect(failure).toBeInstanceOf(Error);
      expect(await readFootprint([fine.chatId, doomed.chatId])).toEqual({
        chats: 2,
        messages: 4,
        votes: 4,
        streams: 2,
      });
    });
  });

  describe("removeMessagesFrom", () => {
    const seedFourMessages = async (
      userId: string
    ): Promise<{ chatId: string; messageIds: string[] }> => {
      const chatId = await seedChat({
        userId,
        createdAt: "2026-05-01 09:00:00",
      });
      const messageIds: string[] = [];
      for (const second of ["01", "02", "03", "04"]) {
        const messageId = await seedMessage({
          chatId,
          createdAt: `2026-05-01 10:00:${second}`,
        });
        await seedVote({ chatId, messageId });
        messageIds.push(messageId);
      }

      return { chatId, messageIds };
    };

    it("removes the message and every later one with their votes and keeps the earlier ones", async () => {
      // Arrange
      const userId = await seedTestUser();
      const { chatId, messageIds } = await seedFourMessages(userId);

      // Act
      const result = await removeMessagesFrom({
        userId,
        chatId,
        messageId: messageIds[1],
      });

      // Assert
      expect(result).toEqual({ status: "removed" });
      expect(await readMessageIds(chatId)).toEqual([messageIds[0]]);
      expect(await readVotedMessageIds(chatId)).toEqual([messageIds[0]]);
    });

    it("does not remove a message that is a few microseconds older than the one named", async () => {
      // Arrange
      const userId = await seedTestUser();
      const chatId = await seedChat({
        userId,
        createdAt: "2026-05-01 09:00:00",
      });
      const olderInTheSameMillisecond = await seedMessage({
        chatId,
        createdAt: "2026-05-01 10:00:00.123455",
      });
      const named = await seedMessage({
        chatId,
        createdAt: "2026-05-01 10:00:00.123456",
      });
      const later = await seedMessage({
        chatId,
        createdAt: "2026-05-01 10:00:00.123457",
      });

      // Act
      await removeMessagesFrom({ userId, chatId, messageId: named });

      // Assert
      const remaining = await readMessageIds(chatId);
      expect(remaining).toEqual([olderInTheSameMillisecond]);
      expect(remaining).not.toContain(later);
    });

    it("deletes nothing for a message of another chat", async () => {
      // Arrange
      const userId = await seedTestUser();
      const target = await seedFourMessages(userId);
      const elsewhere = await seedFourMessages(userId);

      // Act
      const result = await removeMessagesFrom({
        userId,
        chatId: target.chatId,
        messageId: elsewhere.messageIds[0],
      });

      // Assert
      expect(result).toEqual({ status: "removed" });
      expect(await readMessageIds(target.chatId)).toHaveLength(4);
      expect(await readMessageIds(elsewhere.chatId)).toHaveLength(4);
    });

    it("deletes nothing for a message that does not exist", async () => {
      // Arrange
      const userId = await seedTestUser();
      const { chatId } = await seedFourMessages(userId);

      // Act
      const result = await removeMessagesFrom({
        userId,
        chatId,
        messageId: "00000000-0000-4000-8000-000000000000",
      });

      // Assert
      expect(result).toEqual({ status: "removed" });
      expect(await readMessageIds(chatId)).toHaveLength(4);
      expect(await readVotedMessageIds(chatId)).toHaveLength(4);
    });

    it("reports not found and deletes nothing for another user's chat", async () => {
      // Arrange
      const callerId = await seedTestUser();
      const ownerId = await seedTestUser();
      const { chatId, messageIds } = await seedFourMessages(ownerId);

      // Act
      const result = await removeMessagesFrom({
        userId: callerId,
        chatId,
        messageId: messageIds[0],
      });

      // Assert
      expect(result).toEqual({ status: "chat_not_found" });
      expect(await readMessageIds(chatId)).toHaveLength(4);
      expect(await readVotedMessageIds(chatId)).toHaveLength(4);
    });

    it("brings the votes back when the messages cannot be deleted", async () => {
      // Arrange
      const userId = await seedTestUser();
      const chatId = await seedChat({
        userId,
        createdAt: "2026-05-01 09:00:00",
      });
      const kept = await seedMessage({
        chatId,
        createdAt: "2026-05-01 10:00:01",
      });
      const named = await seedMessage({
        chatId,
        createdAt: "2026-05-01 10:00:02",
      });
      const refused = await seedMessage({
        chatId,
        createdAt: "2026-05-01 10:00:03",
        role: "it-refuse",
      });
      for (const messageId of [kept, named, refused]) {
        await seedVote({ chatId, messageId });
      }
      const allowDeletes = await refuseDeletesOf({
        table: "Message_v2",
        column: "role",
        value: "it-refuse",
      });

      // Act: the votes of the three messages go first, then the delete of
      // the messages fails on the refused one.
      let failure: unknown;
      try {
        await removeMessagesFrom({ userId, chatId, messageId: named });
      } catch (error) {
        failure = error;
      } finally {
        await allowDeletes();
      }

      // Assert
      expect(failure).toBeInstanceOf(Error);
      expect(await readMessageIds(chatId)).toHaveLength(3);
      expect((await readVotedMessageIds(chatId)).sort()).toEqual(
        [kept, named, refused].sort()
      );
    });
  });
});
