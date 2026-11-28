import { beforeEach, describe, expect, it, vi } from "vitest";

import { createHandler } from "@/server/api/_kit/create-handler";
import { encodeCursor } from "@/server/api/_kit/pagination";
import { v1Router } from "@/server/api/v1/router";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";
import { deleteAllChatsForUser } from "@/server/modules/chat/delete-all-chats";
import { deleteChatForUser } from "@/server/modules/chat/delete-chat";
import { getChat } from "@/server/modules/chat/get-chat";
import { listChatVotes } from "@/server/modules/chat/list-chat-votes";
import { listChats } from "@/server/modules/chat/list-chats";
import { removeMessagesFrom } from "@/server/modules/chat/remove-messages-from";
import { setMessageVote } from "@/server/modules/chat/set-message-vote";

// The handler, the router, the middlewares, the schemas, the mappers and the
// cursor codec are real. The chat services and what reaches outside the
// process are replaced, as in `prompts-quiz-http.test.ts`.
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/connection", () => ({ db: {} }));
vi.mock("@/server/flags", () => ({
  isSignupEnabled: vi.fn(),
  isTopupEnabled: { run: vi.fn() },
}));
vi.mock("@/server/modules/auth/cookie-session", () => ({
  getCookieSessionUserId: vi.fn(),
}));
vi.mock("@/server/modules/auth/sessions", () => ({
  resolveBearerSession: vi.fn(),
}));
vi.mock("@/server/modules/auth/authenticate-credentials", () => ({
  authenticateCredentials: vi.fn(),
}));
vi.mock("@/server/modules/auth/change-password", () => ({
  changePassword: vi.fn(),
}));
vi.mock("@/server/modules/auth/register-user", () => ({
  registerUser: vi.fn(),
}));
vi.mock("@/server/modules/auth/request-password-reset", () => ({
  requestPasswordReset: vi.fn(),
}));
vi.mock("@/server/modules/auth/reset-password", () => ({
  resetPassword: vi.fn(),
}));
vi.mock("@/server/modules/auth/send-verification-code", () => ({
  sendVerificationCode: vi.fn(),
}));
vi.mock("@/server/modules/auth/verify-email-code", () => ({
  verifyEmailCode: vi.fn(),
}));
vi.mock("@/server/modules/billing/currencies", () => ({
  getMinorUnits: vi.fn(),
}));
vi.mock("@/server/modules/billing/subscriptions", () => ({
  listActiveSubscriptionsWithPrices: vi.fn(),
}));
vi.mock("@/server/modules/billing/balance", () => ({ getBalance: vi.fn() }));
vi.mock("@/server/modules/users/queries/get-by-id", () => ({
  getUserById: vi.fn(),
}));
vi.mock(
  "@/server/modules/subscription/queries/get-active-user-subscription",
  () => ({
    getActiveUserSubscription: vi.fn(),
  })
);
vi.mock("@/server/modules/chat/delete-all-chats", () => ({
  deleteAllChatsForUser: vi.fn(),
}));
vi.mock("@/server/modules/chat/delete-chat", () => ({
  deleteChatForUser: vi.fn(),
}));
vi.mock("@/server/modules/chat/get-chat", () => ({ getChat: vi.fn() }));
vi.mock("@/server/modules/chat/list-chat-votes", () => ({
  listChatVotes: vi.fn(),
}));
vi.mock("@/server/modules/chat/list-chats", () => ({ listChats: vi.fn() }));
vi.mock("@/server/modules/chat/remove-messages-from", () => ({
  removeMessagesFrom: vi.fn(),
}));
vi.mock("@/server/modules/chat/set-message-vote", () => ({
  setMessageVote: vi.fn(),
}));

const ORIGIN = "https://gipiti.test";
const PREFIX = "/api/v1";
const USER_ID = "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e";
const SESSION_ID = "9d1b3f0c-1b7e-4a52-8c0a-6e5d4c3b2a1d";
const CHAT_ID = "5a1e0f64-2b7c-4d3e-9a8b-0c1d2e3f4a5b";
const OTHER_CHAT_ID = "8c2d4e6f-1a3b-4c5d-8e7f-9a0b1c2d3e4f";
const MESSAGE_ID = "c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f";
const ACCESS_TOKEN = "header.payload.signature";

const BEARER = { authorization: `Bearer ${ACCESS_TOKEN}` };
const STALE_BEARER = { authorization: "Bearer stale.token.value" };
const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

const CREATED_AT = new Date("2026-03-04T05:06:07.123Z");

const makeChatRow = (id: string, createdAtText: string) => ({
  id,
  title: `Chat ${id.slice(0, 4)}`,
  createdAt: CREATED_AT,
  createdAtText,
});

type ErrorBody = {
  defined: boolean;
  code: string;
  status: number;
  data?: { reason?: string };
};

const handlers = createHandler(v1Router, { prefix: PREFIX });

type CallInit = { headers?: Record<string, string>; body?: unknown };

const call = (
  method: "GET" | "PUT" | "DELETE",
  path: string,
  { headers = {}, body }: CallInit = {}
): Promise<Response> =>
  handlers[method](
    new Request(`${ORIGIN}${PREFIX}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  );

const useBrowserSession = (): void => {
  vi.mocked(getCookieSessionUserId).mockResolvedValue(USER_ID);
};

const NOT_AUTHENTICATED = {
  code: "UNAUTHORIZED",
  data: { reason: "not_authenticated" },
};

const readReason = async (response: Response): Promise<string | undefined> =>
  ((await response.json()) as ErrorBody).data?.reason;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCookieSessionUserId).mockResolvedValue(null);
  vi.mocked(resolveBearerSession).mockImplementation(async (token) =>
    token === ACCESS_TOKEN ? { userId: USER_ID, sessionId: SESSION_ID } : null
  );
  vi.mocked(listChats).mockResolvedValue({ chats: [], hasMore: false });
  vi.mocked(getChat).mockResolvedValue({
    status: "ok",
    chat: { id: CHAT_ID, title: "Hello", createdAt: CREATED_AT },
  });
  vi.mocked(deleteChatForUser).mockResolvedValue({ status: "deleted" });
  vi.mocked(deleteAllChatsForUser).mockResolvedValue({ deletedCount: 2 });
  vi.mocked(listChatVotes).mockResolvedValue({ status: "ok", votes: [] });
  vi.mocked(setMessageVote).mockResolvedValue({ status: "voted" });
  vi.mocked(removeMessagesFrom).mockResolvedValue({ status: "removed" });
});

describe("GET /chats", () => {
  it("lists the caller's chats newest first, with no next cursor on the last page", async () => {
    // Arrange
    vi.mocked(listChats).mockResolvedValue({
      chats: [
        makeChatRow(CHAT_ID, "2026-03-04 05:06:07.123456"),
        makeChatRow(OTHER_CHAT_ID, "2026-03-03 00:00:00"),
      ],
      hasMore: false,
    });

    // Act
    const response = await call("GET", "/chats", { headers: BEARER });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        {
          id: CHAT_ID,
          title: `Chat ${CHAT_ID.slice(0, 4)}`,
          createdAt: "2026-03-04T05:06:07.123Z",
        },
        {
          id: OTHER_CHAT_ID,
          title: `Chat ${OTHER_CHAT_ID.slice(0, 4)}`,
          createdAt: "2026-03-04T05:06:07.123Z",
        },
      ],
      nextCursor: null,
    });
    expect(listChats).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      limit: 20,
      after: null,
    });
  });

  it("answers an empty list when there are no chats", async () => {
    // Act
    const response = await call("GET", "/chats", { headers: BEARER });

    // Assert
    expect(await response.json()).toEqual({ items: [], nextCursor: null });
  });

  it("gives a next cursor at the position of the last chat when more follow", async () => {
    // Arrange
    const lastPosition = {
      createdAt: "2026-03-04 05:06:07.123456",
      id: OTHER_CHAT_ID,
    };
    vi.mocked(listChats).mockResolvedValue({
      chats: [
        makeChatRow(CHAT_ID, "2026-03-04 05:06:08"),
        makeChatRow(OTHER_CHAT_ID, lastPosition.createdAt),
      ],
      hasMore: true,
    });

    // Act
    const response = await call("GET", "/chats?limit=2", { headers: BEARER });

    // Assert
    const body = (await response.json()) as { nextCursor: string };
    expect(body.nextCursor).toBe(encodeCursor(lastPosition));
  });

  it("passes the limit and the position of a cursor to the service", async () => {
    // Arrange
    const position = { createdAt: "2026-03-04 05:06:07.5", id: CHAT_ID };

    // Act
    const response = await call(
      "GET",
      `/chats?limit=50&cursor=${encodeCursor(position)}`,
      { headers: BEARER }
    );

    // Assert
    expect(response.status).toBe(200);
    expect(listChats).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      limit: 50,
      after: position,
    });
  });

  it.each(["not-a-cursor", "!!!", "e30", "a"])(
    "answers 400 invalid_cursor for the cursor %s",
    async (cursor) => {
      // Act
      const response = await call("GET", `/chats?cursor=${cursor}`, {
        headers: BEARER,
      });

      // Assert
      expect(response.status).toBe(400);
      expect(await readReason(response)).toBe("invalid_cursor");
      expect(listChats).not.toHaveBeenCalled();
    }
  );

  it.each(["0", "101", "-5", "abc", "1.5", ""])(
    "answers 400 for the limit %j",
    async (limit) => {
      // Act
      const response = await call("GET", `/chats?limit=${limit}`, {
        headers: BEARER,
      });

      // Assert
      expect(response.status).toBe(400);
      expect(listChats).not.toHaveBeenCalled();
    }
  );

  it.each(["1e1", "0x10", "%205", "5%20", "+5", "-5", "1000", "٥", "5.0"])(
    "answers 400 for the limit %s, which is not one to three decimal digits",
    async (limit) => {
      // Act
      const response = await call("GET", `/chats?limit=${limit}`, {
        headers: BEARER,
      });

      // Assert
      expect(response.status).toBe(400);
      expect(listChats).not.toHaveBeenCalled();
    }
  );

  it.each(["/chats?limit[]=5", "/chats?limit=5&limit=6"])(
    "answers 400 for %s, which is not a single number",
    async (path) => {
      // Act
      const response = await call("GET", path, { headers: BEARER });

      // Assert
      expect(response.status).toBe(400);
      expect(listChats).not.toHaveBeenCalled();
    }
  );

  it("accepts a limit written with a leading zero as the number it spells", async () => {
    // Act
    const response = await call("GET", "/chats?limit=05", { headers: BEARER });

    // Assert
    expect(response.status).toBe(200);
    expect(listChats).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5 })
    );
  });

  it("accepts the limits 1 and 100", async () => {
    // Act
    const lowest = await call("GET", "/chats?limit=1", { headers: BEARER });
    const highest = await call("GET", "/chats?limit=100", { headers: BEARER });

    // Assert
    expect([lowest.status, highest.status]).toEqual([200, 200]);
  });

  it("serves a browser session", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("GET", "/chats");

    // Assert
    expect(response.status).toBe(200);
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("GET", "/chats");

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(listChats).not.toHaveBeenCalled();
  });

  it("refuses a stale access token with 401 invalid_token", async () => {
    // Act
    const response = await call("GET", "/chats", { headers: STALE_BEARER });

    // Assert
    expect(response.status).toBe(401);
    expect(await readReason(response)).toBe("invalid_token");
  });
});

describe("GET /chats/{chatId}", () => {
  it("answers the chat without its owner or context", async () => {
    // Act
    const response = await call("GET", `/chats/${CHAT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: CHAT_ID,
      title: "Hello",
      createdAt: "2026-03-04T05:06:07.123Z",
    });
    expect(getChat).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      chatId: CHAT_ID,
    });
  });

  it("answers 404 for a chat that is missing or another user's", async () => {
    // Arrange
    vi.mocked(getChat).mockResolvedValue({ status: "chat_not_found" });

    // Act
    const response = await call("GET", `/chats/${CHAT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("answers 400 for an id that is not a uuid", async () => {
    // Act
    const response = await call("GET", "/chats/not-a-uuid", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(getChat).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("GET", `/chats/${CHAT_ID}`);

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(getChat).not.toHaveBeenCalled();
  });
});

describe("DELETE /chats/{chatId}", () => {
  it("deletes the chat and answers 204 with no body", async () => {
    // Act
    const response = await call("DELETE", `/chats/${CHAT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteChatForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      chatId: CHAT_ID,
    });
  });

  it("answers 404 for a chat that is missing or another user's", async () => {
    // Arrange
    vi.mocked(deleteChatForUser).mockResolvedValue({
      status: "chat_not_found",
    });

    // Act
    const response = await call("DELETE", `/chats/${CHAT_ID}`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("answers 400 for an id that is not a uuid", async () => {
    // Act
    const response = await call("DELETE", "/chats/not-a-uuid", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(400);
    expect(deleteChatForUser).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("DELETE", `/chats/${CHAT_ID}`);

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(deleteChatForUser).not.toHaveBeenCalled();
  });

  it("refuses a browser session without same-origin proof with 403", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("DELETE", `/chats/${CHAT_ID}`);

    // Assert
    expect(response.status).toBe(403);
    expect(await readReason(response)).toBe("cross_site_request");
    expect(deleteChatForUser).not.toHaveBeenCalled();
  });

  it("serves a browser session that comes from a page of this site", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("DELETE", `/chats/${CHAT_ID}`, {
      headers: SAME_ORIGIN,
    });

    // Assert
    expect(response.status).toBe(204);
  });
});

describe("DELETE /chats", () => {
  it("deletes every chat of the caller and answers 204 with no body", async () => {
    // Act
    const response = await call("DELETE", "/chats?confirm=true", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(deleteAllChatsForUser).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
    });
  });

  it("answers 204 also when the caller has no chats", async () => {
    // Arrange
    vi.mocked(deleteAllChatsForUser).mockResolvedValue({ deletedCount: 0 });

    // Act
    const response = await call("DELETE", "/chats?confirm=true", {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(204);
  });

  it.each(["", "?confirm=false", "?confirm=1", "?confirm=TRUE", "?confirm="])(
    "answers 400 and deletes nothing for the query %j",
    async (query) => {
      // Act
      const response = await call("DELETE", `/chats${query}`, {
        headers: BEARER,
      });

      // Assert
      expect(response.status).toBe(400);
      expect(deleteAllChatsForUser).not.toHaveBeenCalled();
    }
  );

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("DELETE", "/chats?confirm=true");

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(deleteAllChatsForUser).not.toHaveBeenCalled();
  });

  it("refuses a browser session without same-origin proof with 403", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("DELETE", "/chats?confirm=true");

    // Assert
    expect(response.status).toBe(403);
    expect(await readReason(response)).toBe("cross_site_request");
    expect(deleteAllChatsForUser).not.toHaveBeenCalled();
  });
});

describe("GET /chats/{chatId}/votes", () => {
  it("lists the votes of the chat", async () => {
    // Arrange
    vi.mocked(listChatVotes).mockResolvedValue({
      status: "ok",
      votes: [
        { messageId: MESSAGE_ID, isUpvoted: true },
        { messageId: CHAT_ID, isUpvoted: false },
      ],
    });

    // Act
    const response = await call("GET", `/chats/${CHAT_ID}/votes`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [
        { messageId: MESSAGE_ID, isUpvoted: true },
        { messageId: CHAT_ID, isUpvoted: false },
      ],
    });
    expect(listChatVotes).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      chatId: CHAT_ID,
    });
  });

  it("answers an empty list for a chat with no votes", async () => {
    // Act
    const response = await call("GET", `/chats/${CHAT_ID}/votes`, {
      headers: BEARER,
    });

    // Assert
    expect(await response.json()).toEqual({ items: [] });
  });

  it("answers 404 for a chat that is missing or another user's", async () => {
    // Arrange
    vi.mocked(listChatVotes).mockResolvedValue({ status: "chat_not_found" });

    // Act
    const response = await call("GET", `/chats/${CHAT_ID}/votes`, {
      headers: BEARER,
    });

    // Assert
    expect(response.status).toBe(404);
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("GET", `/chats/${CHAT_ID}/votes`);

    // Assert
    expect(response.status).toBe(401);
    expect(listChatVotes).not.toHaveBeenCalled();
  });
});

describe("PUT /chats/{chatId}/messages/{messageId}/vote", () => {
  const votePath = `/chats/${CHAT_ID}/messages/${MESSAGE_ID}/vote`;

  it.each([true, false])(
    "records isUpvoted %s and answers 204 with no body",
    async (isUpvoted) => {
      // Act
      const response = await call("PUT", votePath, {
        headers: BEARER,
        body: { isUpvoted },
      });

      // Assert
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
      expect(setMessageVote).toHaveBeenCalledExactlyOnceWith({
        userId: USER_ID,
        chatId: CHAT_ID,
        messageId: MESSAGE_ID,
        isUpvoted,
      });
    }
  );

  it("answers 204 again when repeated", async () => {
    // Act
    const first = await call("PUT", votePath, {
      headers: BEARER,
      body: { isUpvoted: true },
    });
    const second = await call("PUT", votePath, {
      headers: BEARER,
      body: { isUpvoted: true },
    });

    // Assert
    expect([first.status, second.status]).toEqual([204, 204]);
  });

  it("answers 404 for a chat that is missing or another user's", async () => {
    // Arrange
    vi.mocked(setMessageVote).mockResolvedValue({ status: "chat_not_found" });

    // Act
    const response = await call("PUT", votePath, {
      headers: BEARER,
      body: { isUpvoted: true },
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("answers the same 404 for a message that is not in the chat", async () => {
    // Arrange
    vi.mocked(setMessageVote).mockResolvedValue({
      status: "message_not_found",
    });

    // Act
    const response = await call("PUT", votePath, {
      headers: BEARER,
      body: { isUpvoted: true },
    });

    // Assert
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    ["a string", { isUpvoted: "yes" }],
    ["a number", { isUpvoted: 1 }],
    ["null", { isUpvoted: null }],
    ["no field", {}],
  ])("answers 400 when isUpvoted is %s", async (_name, body) => {
    // Act
    const response = await call("PUT", votePath, { headers: BEARER, body });

    // Assert
    expect(response.status).toBe(400);
    expect(setMessageVote).not.toHaveBeenCalled();
  });

  it("answers 400 for a body that is missing", async () => {
    // Act
    const response = await call("PUT", votePath, { headers: BEARER });

    // Assert
    expect(response.status).toBe(400);
    expect(setMessageVote).not.toHaveBeenCalled();
  });

  it.each([
    [`/chats/not-a-uuid/messages/${MESSAGE_ID}/vote`],
    [`/chats/${CHAT_ID}/messages/not-a-uuid/vote`],
  ])("answers 400 for an id that is not a uuid in %s", async (path) => {
    // Act
    const response = await call("PUT", path, {
      headers: BEARER,
      body: { isUpvoted: true },
    });

    // Assert
    expect(response.status).toBe(400);
    expect(setMessageVote).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call("PUT", votePath, {
      body: { isUpvoted: true },
    });

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(setMessageVote).not.toHaveBeenCalled();
  });

  it("refuses a browser session without same-origin proof with 403", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call("PUT", votePath, {
      body: { isUpvoted: true },
    });

    // Assert
    expect(response.status).toBe(403);
    expect(await readReason(response)).toBe("cross_site_request");
    expect(setMessageVote).not.toHaveBeenCalled();
  });
});

describe("DELETE /chats/{chatId}/messages", () => {
  const messagesPath = `/chats/${CHAT_ID}/messages`;

  it("deletes the message and the later ones and answers 204 with no body", async () => {
    // Act
    const response = await call(
      "DELETE",
      `${messagesPath}?fromMessageId=${MESSAGE_ID}`,
      { headers: BEARER }
    );

    // Assert
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(removeMessagesFrom).toHaveBeenCalledExactlyOnceWith({
      userId: USER_ID,
      chatId: CHAT_ID,
      messageId: MESSAGE_ID,
    });
  });

  it("answers 404 for a chat that is missing or another user's", async () => {
    // Arrange
    vi.mocked(removeMessagesFrom).mockResolvedValue({
      status: "chat_not_found",
    });

    // Act
    const response = await call(
      "DELETE",
      `${messagesPath}?fromMessageId=${MESSAGE_ID}`,
      { headers: BEARER }
    );

    // Assert
    expect(response.status).toBe(404);
  });

  it.each(["", "?fromMessageId=", "?fromMessageId=not-a-uuid"])(
    "answers 400 for the query %j",
    async (query) => {
      // Act
      const response = await call("DELETE", `${messagesPath}${query}`, {
        headers: BEARER,
      });

      // Assert
      expect(response.status).toBe(400);
      expect(removeMessagesFrom).not.toHaveBeenCalled();
    }
  );

  it("refuses an anonymous caller with 401 not_authenticated", async () => {
    // Act
    const response = await call(
      "DELETE",
      `${messagesPath}?fromMessageId=${MESSAGE_ID}`
    );

    // Assert
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject(NOT_AUTHENTICATED);
    expect(removeMessagesFrom).not.toHaveBeenCalled();
  });

  it("refuses a browser session without same-origin proof with 403", async () => {
    // Arrange
    useBrowserSession();

    // Act
    const response = await call(
      "DELETE",
      `${messagesPath}?fromMessageId=${MESSAGE_ID}`
    );

    // Assert
    expect(response.status).toBe(403);
    expect(await readReason(response)).toBe("cross_site_request");
    expect(removeMessagesFrom).not.toHaveBeenCalled();
  });
});
