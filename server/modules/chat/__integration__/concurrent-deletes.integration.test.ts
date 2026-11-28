import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deleteUsers,
  readFootprint,
  seedChat,
  seedMessage,
  seedStream,
  seedUser,
  seedVote,
} from "@/server/modules/chat/__integration__/seed-chat-data";
import { deleteAllChatsForUser } from "@/server/modules/chat/delete-all-chats";
import { deleteChatForUser } from "@/server/modules/chat/delete-chat";
import { removeMessagesFrom } from "@/server/modules/chat/remove-messages-from";
import { setMessageVote } from "@/server/modules/chat/set-message-vote";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const ROUNDS = 20;
const CHATS_PER_ROUND = 6;

const createdUserIds: string[] = [];

type RoundData = { userId: string; chatIds: string[]; messageIds: string[] };

/** A user with several chats, each with two voted messages and a stream. */
const seedRound = async (): Promise<RoundData> => {
  const userId = await seedUser();
  createdUserIds.push(userId);
  const chatIds: string[] = [];
  const messageIds: string[] = [];

  for (let index = 0; index < CHATS_PER_ROUND; index += 1) {
    const chatId = await seedChat({
      userId,
      createdAt: `2026-07-01 10:00:0${index}`,
    });
    chatIds.push(chatId);
    for (const second of ["10", "11"]) {
      const messageId = await seedMessage({
        chatId,
        createdAt: `2026-07-01 11:00:${second}`,
      });
      await seedVote({ chatId, messageId });
      if (second === "10") {
        messageIds.push(messageId);
      }
    }
    await seedStream(chatId);
  }

  return { userId, chatIds, messageIds };
};

const rejectionsOf = (results: PromiseSettledResult<unknown>[]): unknown[] =>
  results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : []
  );

/**
 * Deletes that overlap must not deadlock (Postgres aborts one side of a
 * deadlock with 40P01, which the caller would see as a 500). Every write
 * locks the chat row before its children, delete-all included, so they
 * cannot wait for each other in a cycle.
 */
describe("overlapping chat writes of one user", () => {
  beforeEach(() => {
    createdUserIds.length = 0;
  });

  afterEach(async () => {
    await deleteUsers(createdUserIds);
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it(`never rejects when delete-one and delete-all overlap (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Arrange
      const { userId, chatIds } = await seedRound();

      // Act
      const results = await Promise.allSettled([
        deleteAllChatsForUser({ userId }),
        ...chatIds.map((chatId) => deleteChatForUser({ userId, chatId })),
      ]);

      // Assert
      expect(rejectionsOf(results)).toEqual([]);
      expect(await readFootprint(chatIds)).toEqual({
        chats: 0,
        messages: 0,
        votes: 0,
        streams: 0,
      });
    }
  });

  it(`never rejects when votes and trailing deletes overlap delete-all (${ROUNDS} rounds)`, async () => {
    for (let round = 0; round < ROUNDS; round += 1) {
      // Arrange
      const { userId, chatIds, messageIds } = await seedRound();

      // Act
      const results = await Promise.allSettled([
        deleteAllChatsForUser({ userId }),
        ...chatIds.flatMap((chatId, index) => [
          setMessageVote({
            userId,
            chatId,
            messageId: messageIds[index],
            isUpvoted: false,
          }),
          removeMessagesFrom({ userId, chatId, messageId: messageIds[index] }),
        ]),
      ]);

      // Assert
      expect(rejectionsOf(results)).toEqual([]);
      expect(await readFootprint(chatIds)).toEqual({
        chats: 0,
        messages: 0,
        votes: 0,
        streams: 0,
      });
    }
  });
});
