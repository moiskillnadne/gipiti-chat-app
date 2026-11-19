import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/app/(auth)/auth";
import type { Chat, DBMessage } from "@/server/db/schema";

import { PATCH } from "../route";

const { getChatByIdMock, getMessageByIdMock, voteMessageMock } = vi.hoisted(
  () => ({
    getChatByIdMock: vi.fn(),
    getMessageByIdMock: vi.fn(),
    voteMessageMock: vi.fn(),
  })
);

vi.mock("@/app/(auth)/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/query/chat/get-chat-by-id", () => ({
  getChatById: getChatByIdMock,
}));
vi.mock("@/lib/db/query/chat/get-message-by-id", () => ({
  getMessageById: getMessageByIdMock,
}));
vi.mock("@/lib/db/query/chat/get-votes-by-chat-id", () => ({
  getVotesByChatId: vi.fn(),
}));
vi.mock("@/lib/db/query/chat/vote-message", () => ({
  voteMessage: voteMessageMock,
}));

// `auth` is overloaded (route wrapper and session getter); tests use the getter.
const mockedAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CHAT_ID = "22222222-2222-4222-8222-222222222222";
const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

type VoteRequestBody = {
  chatId?: unknown;
  messageId?: unknown;
  type?: unknown;
};

const validBody: VoteRequestBody = {
  chatId: CHAT_ID,
  messageId: MESSAGE_ID,
  type: "up",
};

const createRequest = (body: string): Request =>
  new Request("http://localhost/api/vote", { method: "PATCH", body });

const createVoteRequest = (body: VoteRequestBody = validBody): Request =>
  createRequest(JSON.stringify(body));

const arrangeSession = (): void => {
  mockedAuth.mockResolvedValue({
    user: { id: USER_ID },
    expires: "",
  } as Session);
};

const arrangeChat = (ownerId: string = USER_ID): void => {
  getChatByIdMock.mockResolvedValue({ id: CHAT_ID, userId: ownerId } as Chat);
};

const arrangeMessage = (messageChatId: string = CHAT_ID): void => {
  getMessageByIdMock.mockResolvedValue([
    { id: MESSAGE_ID, chatId: messageChatId } as DBMessage,
  ]);
};

describe("PATCH /api/vote", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers 401 without a session, before reading the body", async () => {
    // Arrange
    mockedAuth.mockResolvedValue(null);

    // Act
    const response = await PATCH(createRequest("not json"));

    // Assert
    expect(response.status).toBe(401);
    expect(getChatByIdMock).not.toHaveBeenCalled();
    expect(voteMessageMock).not.toHaveBeenCalled();
  });

  it.each([
    ["a body that is not JSON", "not json"],
    ["a JSON body that is not an object", JSON.stringify("up")],
    [
      "a chatId that is not a uuid",
      JSON.stringify({ ...validBody, chatId: "chat-1" }),
    ],
    [
      "a messageId that is not a uuid",
      JSON.stringify({ ...validBody, messageId: "message-1" }),
    ],
    ["a missing messageId", JSON.stringify({ chatId: CHAT_ID, type: "up" })],
    ["an unknown type", JSON.stringify({ ...validBody, type: "sideways" })],
    [
      "a missing type",
      JSON.stringify({ chatId: CHAT_ID, messageId: MESSAGE_ID }),
    ],
  ])("answers 400 for %s", async (_label, body) => {
    // Arrange
    arrangeSession();

    // Act
    const response = await PATCH(createRequest(body));

    // Assert
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "bad_request:api" });
    expect(getChatByIdMock).not.toHaveBeenCalled();
    expect(voteMessageMock).not.toHaveBeenCalled();
  });

  it("answers 404 for a chat that does not exist", async () => {
    // Arrange
    arrangeSession();
    getChatByIdMock.mockResolvedValue(null);

    // Act
    const response = await PATCH(createVoteRequest());

    // Assert
    expect(response.status).toBe(404);
    expect(getMessageByIdMock).not.toHaveBeenCalled();
    expect(voteMessageMock).not.toHaveBeenCalled();
  });

  it("answers 403 for a chat the user does not own", async () => {
    // Arrange
    arrangeSession();
    arrangeChat(OTHER_USER_ID);
    arrangeMessage();

    // Act
    const response = await PATCH(createVoteRequest());

    // Assert
    expect(response.status).toBe(403);
    expect(getMessageByIdMock).not.toHaveBeenCalled();
    expect(voteMessageMock).not.toHaveBeenCalled();
  });

  it("answers the same 404 for a message of another chat and for an unknown message", async () => {
    // Arrange
    arrangeSession();
    arrangeChat();

    // Act
    arrangeMessage(OTHER_CHAT_ID);
    const foreignMessageResponse = await PATCH(createVoteRequest());
    getMessageByIdMock.mockResolvedValue([]);
    const unknownMessageResponse = await PATCH(createVoteRequest());

    // Assert
    expect(foreignMessageResponse.status).toBe(404);
    expect(unknownMessageResponse.status).toBe(404);
    const foreignMessageBody: unknown = await foreignMessageResponse.json();
    expect(foreignMessageBody).toMatchObject({ code: "not_found:vote" });
    expect(await unknownMessageResponse.json()).toEqual(foreignMessageBody);
    expect(getMessageByIdMock).toHaveBeenCalledWith({ id: MESSAGE_ID });
    expect(voteMessageMock).not.toHaveBeenCalled();
  });

  it.each([["up"], ["down"]] as const)(
    "stores a valid %s vote once and answers 200",
    async (type) => {
      // Arrange
      arrangeSession();
      arrangeChat();
      arrangeMessage();

      // Act
      const response = await PATCH(createVoteRequest({ ...validBody, type }));

      // Assert
      expect(response.status).toBe(200);
      expect(voteMessageMock).toHaveBeenCalledTimes(1);
      expect(voteMessageMock).toHaveBeenCalledWith({
        chatId: CHAT_ID,
        messageId: MESSAGE_ID,
        type,
      });
    }
  );
});
