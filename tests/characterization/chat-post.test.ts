import type { Session } from "next-auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/server/modules/auth/next-auth";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

import { chatPost } from "./targets/chat-post";

type ErrorBody = { code: string; message: string; cause?: string };

type SavedMessage = {
  chatId: string;
  id: string;
  role: string;
  parts: Array<{ type: string; text?: string }>;
};

type StoredChat = { id: string; userId: string };

type RateLimitResult = { success: boolean; remaining?: number; reset?: number };

type TurnSlotRequest = { userId: string; kind: string; ttlMs: number };

type HeldTurnSlot = {
  release: () => Promise<void>;
  whenReleased: Promise<void>;
};

type TurnBalanceRequest = {
  userId: string;
  mode: string;
  estimatedCostUsd?: number;
};

type TurnBalance = {
  isSufficient: boolean;
  requiredMinor: number;
  availableMinor: number;
};

/** The part of the turn context the stand-in text handler touches. */
type SettlingTurnContext = {
  turnOutcome?: string;
  turnSettlement: { resolve: () => void };
};

type ModeHandler = (ctx: SettlingTurnContext, writer: unknown) => Promise<void>;

const {
  afterMock,
  recordUserActivityMock,
  checkChatRateLimitMock,
  acquireTurnSlotMock,
  releaseTurnSlotMock,
  checkTurnBalanceMock,
  getChatByIdMock,
  getMessagesByChatIdMock,
  saveChatMock,
  saveMessagesMock,
  createStreamIdMock,
  runTextChatMock,
  runImageGenerationMock,
  runVideoGenerationMock,
  persistAssistantTurnMock,
} = vi.hoisted(() => ({
  afterMock: vi.fn<(task: unknown) => void>(),
  recordUserActivityMock: vi.fn<(userId: string) => void>(),
  checkChatRateLimitMock: vi.fn<(userId: string) => Promise<RateLimitResult>>(),
  acquireTurnSlotMock:
    vi.fn<(input: TurnSlotRequest) => Promise<HeldTurnSlot | null>>(),
  releaseTurnSlotMock: vi.fn<() => Promise<void>>(),
  checkTurnBalanceMock:
    vi.fn<(input: TurnBalanceRequest) => Promise<TurnBalance>>(),
  getChatByIdMock:
    vi.fn<(input: { id: string }) => Promise<StoredChat | null>>(),
  getMessagesByChatIdMock: vi.fn<(input: { id: string }) => Promise<never[]>>(),
  saveChatMock:
    vi.fn<
      (input: { id: string; userId: string; title: string }) => Promise<void>
    >(),
  saveMessagesMock:
    vi.fn<(input: { messages: SavedMessage[] }) => Promise<void>>(),
  createStreamIdMock:
    vi.fn<(input: { streamId: string; chatId: string }) => Promise<void>>(),
  runTextChatMock: vi.fn<ModeHandler>(),
  runImageGenerationMock: vi.fn<ModeHandler>(),
  runVideoGenerationMock: vi.fn<ModeHandler>(),
  persistAssistantTurnMock: vi.fn<() => Promise<void>>(),
}));

// Safety net: nothing below may reach a real database.
vi.mock("server-only", () => ({}));
vi.mock("@/server/db/connection", () => ({ db: {} }));

vi.mock("@/server/modules/auth/next-auth", () => ({ auth: vi.fn() }));
// `after` callbacks (slot keep-alive, background title) are recorded, not run.
vi.mock("next/server", async () => {
  const actual =
    await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: afterMock };
});
vi.mock("@vercel/functions", () => ({ geolocation: () => ({}) }));
vi.mock("@/lib/activity/record-user-activity", () => ({
  recordUserActivity: recordUserActivityMock,
}));
vi.mock("@/server/http/rate-limit", () => ({
  checkChatRateLimit: checkChatRateLimitMock,
}));
vi.mock("@/lib/billing/turn-slots", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/billing/turn-slots")
  >("@/lib/billing/turn-slots");
  return { ...actual, acquireTurnSlot: acquireTurnSlotMock };
});
vi.mock("@/lib/billing/turn-balance", () => ({
  checkTurnBalance: checkTurnBalanceMock,
}));
vi.mock("@/lib/ai/generate-chat-title", () => ({
  generateTitleFromUserMessage: vi.fn(),
}));

vi.mock("@/server/modules/chat/queries/get-chat-by-id", () => ({
  getChatById: getChatByIdMock,
}));
vi.mock("@/server/modules/chat/queries/get-messages-by-chat-id", () => ({
  getMessagesByChatId: getMessagesByChatIdMock,
}));
vi.mock("@/server/modules/chat/queries/save-chat", () => ({
  saveChat: saveChatMock,
}));
vi.mock("@/server/modules/chat/queries/save-messages", () => ({
  saveMessages: saveMessagesMock,
}));
vi.mock("@/server/modules/chat/queries/create-stream-id", () => ({
  createStreamId: createStreamIdMock,
}));
vi.mock("@/server/modules/chat/queries/update-chat-title", () => ({
  updateChatTitle: vi.fn(),
}));
vi.mock("@/server/modules/chat/queries/delete-chat-by-id", () => ({
  deleteChatById: vi.fn(),
}));
vi.mock("@/server/modules/projects/queries/get-project-by-id", () => ({
  getProjectById: vi.fn(),
}));
vi.mock("@/server/modules/projects/queries/increment-project-usage", () => ({
  incrementProjectUsage: vi.fn(),
}));

vi.mock("@/app/(chat)/api/chat/_lib/handlers/text-chat", () => ({
  runTextChat: runTextChatMock,
}));
vi.mock("@/app/(chat)/api/chat/_lib/handlers/image-generation", () => ({
  runImageGeneration: runImageGenerationMock,
}));
vi.mock("@/app/(chat)/api/chat/_lib/handlers/video-generation", () => ({
  runVideoGeneration: runVideoGenerationMock,
}));
vi.mock("@/app/(chat)/api/chat/_lib/persist-assistant-turn", () => ({
  persistAssistantTurn: persistAssistantTurnMock,
}));
vi.mock("@/app/(chat)/api/chat/_lib/stream-context", () => ({
  getStreamContext: () => null,
}));
vi.mock("@/app/(chat)/api/chat/_lib/stop-signal", () => ({
  watchChatStop: () => () => Promise.resolve(),
}));

// `auth` is overloaded (route wrapper and session getter); tests use the getter.
const mockedAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

const USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const CHAT_ID = "3f0b2c1e-6f0a-4d53-9f0e-1c2d3e4f5a6b";
const MESSAGE_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const MESSAGE_TEXT = "Hello";
const MAX_MESSAGE_LENGTH = 50_000;
const ROUTE_MAX_DURATION_MS = 800_000;
const OVER_LENGTH_MESSAGE =
  "Your message is too long. Please reduce it to 50000 characters or less.";
const SUFFICIENT_BALANCE: TurnBalance = {
  isSufficient: true,
  requiredMinor: 100,
  availableMinor: 5000,
};
const INSUFFICIENT_BALANCE: TurnBalance = {
  isSufficient: false,
  requiredMinor: 100,
  availableMinor: 0,
};

const validBody = (text: string = MESSAGE_TEXT): Record<string, unknown> => ({
  id: CHAT_ID,
  message: {
    id: MESSAGE_ID,
    role: "user",
    parts: [{ type: "text", text }],
  },
  selectedChatModel: DEFAULT_CHAT_MODEL,
});

const createRequest = (body: string): Request =>
  new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });

const postValidBody = (): Promise<Response> =>
  chatPost(createRequest(JSON.stringify(validBody())));

const readErrorBody = async (response: Response): Promise<ErrorBody> =>
  (await response.json()) as ErrorBody;

/**
 * Reads the response stream to its end. The route streams string chunks, which
 * `Response.text()` refuses outside the Next.js runtime, so read them directly.
 */
const drainResponseStream = async (response: Response): Promise<void> => {
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }
  let isDone = false;
  while (!isDone) {
    ({ done: isDone } = await reader.read());
  }
};

const savedMessages = (): SavedMessage[] =>
  saveMessagesMock.mock.calls.flatMap(([{ messages }]) => messages);

/** How many times any of the three mode handlers ran. */
const handlerRunCount = (): number =>
  runTextChatMock.mock.calls.length +
  runImageGenerationMock.mock.calls.length +
  runVideoGenerationMock.mock.calls.length;

/** A signed-in user with a free slot and enough balance, on a new chat. */
const arrangeReadyTurn = (): void => {
  mockedAuth.mockResolvedValue({
    user: { id: USER_ID },
    expires: "",
  } as Session);
  checkChatRateLimitMock.mockResolvedValue({ success: true });
  releaseTurnSlotMock.mockResolvedValue(undefined);
  acquireTurnSlotMock.mockResolvedValue({
    release: releaseTurnSlotMock,
    whenReleased: Promise.resolve(),
  });
  checkTurnBalanceMock.mockResolvedValue(SUFFICIENT_BALANCE);
  getChatByIdMock.mockResolvedValue(null);
  getMessagesByChatIdMock.mockResolvedValue([]);
  saveChatMock.mockResolvedValue(undefined);
  saveMessagesMock.mockResolvedValue(undefined);
  createStreamIdMock.mockResolvedValue(undefined);
  persistAssistantTurnMock.mockResolvedValue(undefined);
  // Like the real text handler on every terminal path: report the outcome and
  // settle the turn, otherwise the stream waits for billing before it closes.
  runTextChatMock.mockImplementation((ctx) => {
    ctx.turnOutcome = "completed";
    ctx.turnSettlement.resolve();
    return Promise.resolve();
  });
  runImageGenerationMock.mockResolvedValue(undefined);
  runVideoGenerationMock.mockResolvedValue(undefined);
};

describe("POST /api/chat guard branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrangeReadyTurn();
  });

  it.each([
    ["an empty object", JSON.stringify({})],
    ["a body that is not JSON", "not json"],
    [
      "an unknown model id",
      JSON.stringify({ ...validBody(), selectedChatModel: "no-such-model" }),
    ],
  ])(
    "answers 400 bad_request:api for %s before checking the session",
    async (_label, body) => {
      // Act
      const response = await chatPost(createRequest(body));

      // Assert
      expect(response.status).toBe(400);
      expect((await readErrorBody(response)).code).toBe("bad_request:api");
      expect(mockedAuth).not.toHaveBeenCalled();
      expect(acquireTurnSlotMock).not.toHaveBeenCalled();
      expect(saveMessagesMock).not.toHaveBeenCalled();
    }
  );

  it("answers 400 bad_request:api naming the limit for an over-length message", async () => {
    // Arrange
    const oversizedText = "a".repeat(MAX_MESSAGE_LENGTH + 1);

    // Act
    const response = await chatPost(
      createRequest(JSON.stringify(validBody(oversizedText)))
    );

    // Assert
    const errorBody = await readErrorBody(response);
    expect(response.status).toBe(400);
    expect(errorBody).toEqual({
      code: "bad_request:api",
      message: OVER_LENGTH_MESSAGE,
      // The actual length is not reported: the cause always says "unknown".
      cause: "Current length: unknown characters",
    });
    expect(mockedAuth).not.toHaveBeenCalled();
  });

  it.each<[string, Session | null]>([
    ["no session", null],
    ["a session without a user", { expires: "" } as Session],
  ])(
    "answers 401 unauthorized:chat for %s and takes no turn slot",
    async (_label, session) => {
      // Arrange
      mockedAuth.mockResolvedValue(session);

      // Act
      const response = await postValidBody();

      // Assert
      expect(response.status).toBe(401);
      expect((await readErrorBody(response)).code).toBe("unauthorized:chat");
      expect(recordUserActivityMock).not.toHaveBeenCalled();
      expect(checkChatRateLimitMock).not.toHaveBeenCalled();
      expect(acquireTurnSlotMock).not.toHaveBeenCalled();
      expect(saveMessagesMock).not.toHaveBeenCalled();
      expect(handlerRunCount()).toBe(0);
    }
  );

  it("answers 429 rate_limit:chat when rate limited, before taking a slot", async () => {
    // Arrange
    checkChatRateLimitMock.mockResolvedValue({
      success: false,
      remaining: 0,
      reset: Date.now() + 60_000,
    });

    // Act
    const response = await postValidBody();

    // Assert
    expect(response.status).toBe(429);
    expect((await readErrorBody(response)).code).toBe("rate_limit:chat");
    expect(checkChatRateLimitMock).toHaveBeenCalledWith(USER_ID);
    expect(acquireTurnSlotMock).not.toHaveBeenCalled();
    expect(saveChatMock).not.toHaveBeenCalled();
    expect(saveMessagesMock).not.toHaveBeenCalled();
    expect(handlerRunCount()).toBe(0);
  });

  it("answers 429 rate_limit:chat when no text turn slot is free, before saving", async () => {
    // Arrange
    acquireTurnSlotMock.mockResolvedValue(null);

    // Act
    const response = await postValidBody();

    // Assert
    expect(response.status).toBe(429);
    expect((await readErrorBody(response)).code).toBe("rate_limit:chat");
    expect(acquireTurnSlotMock).toHaveBeenCalledWith({
      userId: USER_ID,
      kind: "text",
      ttlMs: ROUTE_MAX_DURATION_MS,
    });
    expect(checkTurnBalanceMock).not.toHaveBeenCalled();
    expect(saveMessagesMock).not.toHaveBeenCalled();
    expect(handlerRunCount()).toBe(0);
  });

  it("answers 403 forbidden:chat for another user's chat and frees the slot", async () => {
    // Arrange
    getChatByIdMock.mockResolvedValue({ id: CHAT_ID, userId: OTHER_USER_ID });

    // Act
    const response = await postValidBody();

    // Assert
    expect(response.status).toBe(403);
    expect((await readErrorBody(response)).code).toBe("forbidden:chat");
    expect(saveChatMock).not.toHaveBeenCalled();
    expect(saveMessagesMock).not.toHaveBeenCalled();
    expect(releaseTurnSlotMock).toHaveBeenCalledTimes(1);
    expect(handlerRunCount()).toBe(0);
  });

  it("answers 429 quota_exceeded:chat, saves the notice and frees the slot", async () => {
    // Arrange
    checkTurnBalanceMock.mockResolvedValue(INSUFFICIENT_BALANCE);

    // Act
    const response = await postValidBody();

    // Assert
    expect(response.status).toBe(429);
    expect((await readErrorBody(response)).code).toBe("quota_exceeded:chat");
    expect(checkTurnBalanceMock).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, mode: "text" })
    );
    const [userMessage, assistantNotice, ...otherMessages] = savedMessages();
    expect(otherMessages).toHaveLength(0);
    expect(userMessage).toMatchObject({
      chatId: CHAT_ID,
      id: MESSAGE_ID,
      role: "user",
    });
    expect(assistantNotice).toMatchObject({
      chatId: CHAT_ID,
      role: "assistant",
    });
    expect(assistantNotice.parts).toHaveLength(1);
    expect(assistantNotice.parts[0].type).toBe("text");
    expect(assistantNotice.parts[0].text).toEqual(expect.any(String));
    expect(assistantNotice.parts[0].text).not.toBe("");
    expect(releaseTurnSlotMock).toHaveBeenCalledTimes(1);
    expect(persistAssistantTurnMock).not.toHaveBeenCalled();
    expect(handlerRunCount()).toBe(0);
  });

  it("answers 200 and runs only the text handler when the balance is sufficient", async () => {
    // Act
    const response = await postValidBody();
    await drainResponseStream(response);

    // Assert
    expect(response.status).toBe(200);
    expect(recordUserActivityMock).toHaveBeenCalledWith(USER_ID);
    expect(saveChatMock).toHaveBeenCalledWith({
      id: CHAT_ID,
      userId: USER_ID,
      title: MESSAGE_TEXT,
    });
    expect(savedMessages()).toHaveLength(1);
    expect(savedMessages()[0]).toMatchObject({
      chatId: CHAT_ID,
      id: MESSAGE_ID,
      role: "user",
    });
    expect(runTextChatMock).toHaveBeenCalledTimes(1);
    expect(runImageGenerationMock).not.toHaveBeenCalled();
    expect(runVideoGenerationMock).not.toHaveBeenCalled();
    expect(persistAssistantTurnMock).toHaveBeenCalledTimes(1);
  });
});
