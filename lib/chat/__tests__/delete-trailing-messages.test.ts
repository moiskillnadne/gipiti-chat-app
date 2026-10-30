import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSDKError } from "@/lib/errors";

const {
  getMessageByIdMock,
  getChatByIdMock,
  deleteMessagesByChatIdAfterTimestampMock,
} = vi.hoisted(() => ({
  getMessageByIdMock: vi.fn(),
  getChatByIdMock: vi.fn(),
  deleteMessagesByChatIdAfterTimestampMock: vi.fn(),
}));

vi.mock("@/lib/db/query/chat/get-message-by-id", () => ({
  getMessageById: getMessageByIdMock,
}));
vi.mock("@/lib/db/query/chat/get-chat-by-id", () => ({
  getChatById: getChatByIdMock,
}));
vi.mock(
  "@/lib/db/query/chat/delete-messages-by-chat-id-after-timestamp",
  () => ({
    deleteMessagesByChatIdAfterTimestamp:
      deleteMessagesByChatIdAfterTimestampMock,
  })
);

import { deleteTrailingMessagesForUser } from "../delete-trailing-messages";

const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const CHAT_ID = "33333333-3333-4333-8333-333333333333";
const MESSAGE_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = new Date("2026-10-30T10:00:00.000Z");

beforeEach(() => {
  getMessageByIdMock.mockReset();
  getChatByIdMock.mockReset();
  deleteMessagesByChatIdAfterTimestampMock.mockReset();

  getMessageByIdMock.mockResolvedValue([
    { id: MESSAGE_ID, chatId: CHAT_ID, createdAt: CREATED_AT },
  ]);
  getChatByIdMock.mockResolvedValue({ id: CHAT_ID, userId: OWNER_ID });
  deleteMessagesByChatIdAfterTimestampMock.mockResolvedValue(undefined);
});

// Resolves to the "{type}:{surface}" code of the thrown ChatSDKError.
const getErrorCode = async (promise: Promise<void>) => {
  const error = await promise.catch((caught: unknown) => caught);
  return error instanceof ChatSDKError
    ? `${error.type}:${error.surface}`
    : error;
};

describe("deleteTrailingMessagesForUser", () => {
  it("deletes the message and everything after it for the chat owner", async () => {
    // Act
    await deleteTrailingMessagesForUser({
      messageId: MESSAGE_ID,
      userId: OWNER_ID,
    });

    // Assert
    expect(getChatByIdMock).toHaveBeenCalledWith({ id: CHAT_ID });
    expect(deleteMessagesByChatIdAfterTimestampMock).toHaveBeenCalledWith({
      chatId: CHAT_ID,
      timestamp: CREATED_AT,
    });
  });

  it("throws forbidden:chat and deletes nothing when the chat belongs to another user", async () => {
    expect(
      await getErrorCode(
        deleteTrailingMessagesForUser({
          messageId: MESSAGE_ID,
          userId: OTHER_USER_ID,
        })
      )
    ).toBe("forbidden:chat");

    expect(deleteMessagesByChatIdAfterTimestampMock).not.toHaveBeenCalled();
  });

  it("returns quietly when the message does not exist", async () => {
    getMessageByIdMock.mockResolvedValue([]);

    await deleteTrailingMessagesForUser({
      messageId: MESSAGE_ID,
      userId: OWNER_ID,
    });

    expect(getChatByIdMock).not.toHaveBeenCalled();
    expect(deleteMessagesByChatIdAfterTimestampMock).not.toHaveBeenCalled();
  });

  it("throws not_found:chat when the message's chat is missing", async () => {
    getChatByIdMock.mockResolvedValue(null);

    expect(
      await getErrorCode(
        deleteTrailingMessagesForUser({
          messageId: MESSAGE_ID,
          userId: OWNER_ID,
        })
      )
    ).toBe("not_found:chat");

    expect(deleteMessagesByChatIdAfterTimestampMock).not.toHaveBeenCalled();
  });
});
