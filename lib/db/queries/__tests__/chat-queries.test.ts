import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppUsage } from "../../../usage";
import { resetMock, setError, setResult, setResults } from "./db-mock";

vi.mock("../connection", async () => {
  const mod = await import("./db-mock");
  return { db: mod.mockDb };
});

import {
  createStreamId,
  deleteAllChatsByUserId,
  deleteChatById,
  deleteMessagesByChatIdAfterTimestamp,
  getChatById,
  getChatsByUserId,
  getMessageById,
  getMessageCountByUserId,
  getMessagesByChatId,
  getStreamIdsByChatId,
  getVotesByChatId,
  saveChat,
  saveMessages,
  updateChatLastContextById,
  voteMessage,
} from "../chat-queries";

const DB_ERROR = new Error("connection lost");

describe("chat-queries", () => {
  beforeEach(() => {
    resetMock();
  });

  // ── saveChat ──────────────────────────────────────────────────────

  describe("saveChat", () => {
    it("returns insert result on success", async () => {
      setResult({ rowCount: 1 });
      const result = await saveChat({
        id: "c1",
        userId: "u1",
        title: "Chat",
      });
      expect(result).toEqual({ rowCount: 1 });
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        saveChat({ id: "c1", userId: "u1", title: "Chat" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── deleteChatById ────────────────────────────────────────────────

  describe("deleteChatById", () => {
    it("cascading deletes and returns deleted chat", async () => {
      const mockChat = {
        id: "c1",
        userId: "u1",
        title: "Chat",
        createdAt: new Date(),
      };
      setResult([mockChat]);
      const result = await deleteChatById({ id: "c1" });
      expect(result).toEqual(mockChat);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(deleteChatById({ id: "c1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── deleteAllChatsByUserId ────────────────────────────────────────

  describe("deleteAllChatsByUserId", () => {
    it("returns deletedCount when chats exist", async () => {
      setResult([{ id: "c1" }, { id: "c2" }]);
      const result = await deleteAllChatsByUserId({ userId: "u1" });
      expect(result).toEqual({ deletedCount: 2 });
    });

    it("returns deletedCount 0 when no chats exist", async () => {
      setResult([]);
      const result = await deleteAllChatsByUserId({ userId: "u1" });
      expect(result).toEqual({ deletedCount: 0 });
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        deleteAllChatsByUserId({ userId: "u1" })
      ).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── getChatsByUserId ──────────────────────────────────────────────

  describe("getChatsByUserId", () => {
    const baseParams = {
      id: "u1",
      limit: 2,
      startingAfter: null,
      endingBefore: null,
    };

    it("returns chats without pagination cursor", async () => {
      const chats = [
        { id: "c1", title: "A" },
        { id: "c2", title: "B" },
      ];
      setResult(chats);
      const result = await getChatsByUserId(baseParams);
      expect(result).toEqual({ chats, hasMore: false });
    });

    it("sets hasMore true when results exceed limit", async () => {
      const chats = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
      setResult(chats);
      const result = await getChatsByUserId(baseParams);
      expect(result.hasMore).toBe(true);
      expect(result.chats).toHaveLength(2);
    });

    it("paginates with startingAfter cursor", async () => {
      const cursorChat = { id: "cursor", createdAt: new Date("2024-01-01") };
      const resultChats = [{ id: "c1" }];
      setResults([cursorChat], resultChats);
      const result = await getChatsByUserId({
        ...baseParams,
        startingAfter: "cursor",
      });
      expect(result).toEqual({ chats: resultChats, hasMore: false });
    });

    it("paginates with endingBefore cursor", async () => {
      const cursorChat = { id: "cursor", createdAt: new Date("2024-01-01") };
      const resultChats = [{ id: "c2" }];
      setResults([cursorChat], resultChats);
      const result = await getChatsByUserId({
        ...baseParams,
        endingBefore: "cursor",
      });
      expect(result).toEqual({ chats: resultChats, hasMore: false });
    });

    it("throws ChatSDKError when cursor chat is not found", async () => {
      setResult([]);
      await expect(
        getChatsByUserId({ ...baseParams, startingAfter: "nonexistent" })
      ).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getChatsByUserId(baseParams)).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── getChatById ───────────────────────────────────────────────────

  describe("getChatById", () => {
    it("returns chat when found", async () => {
      const mockChat = { id: "c1", title: "Chat", userId: "u1" };
      setResult([mockChat]);
      const result = await getChatById({ id: "c1" });
      expect(result).toEqual(mockChat);
    });

    it("returns null when chat is not found", async () => {
      setResult([]);
      const result = await getChatById({ id: "nonexistent" });
      expect(result).toBeNull();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getChatById({ id: "c1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── saveMessages ──────────────────────────────────────────────────

  describe("saveMessages", () => {
    it("inserts messages with onConflictDoNothing", async () => {
      const mockResult = { rowCount: 2 };
      setResult(mockResult);
      const messages = [
        {
          id: "m1",
          chatId: "c1",
          role: "user",
          parts: [],
          attachments: [],
          createdAt: new Date(),
          modelId: null,
        },
      ];
      const result = await saveMessages({ messages });
      expect(result).toEqual(mockResult);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(saveMessages({ messages: [] })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── getMessagesByChatId ───────────────────────────────────────────

  describe("getMessagesByChatId", () => {
    it("returns messages ordered by createdAt", async () => {
      const messages = [
        { id: "m1", createdAt: new Date("2024-01-01") },
        { id: "m2", createdAt: new Date("2024-01-02") },
      ];
      setResult(messages);
      const result = await getMessagesByChatId({ id: "c1" });
      expect(result).toEqual(messages);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getMessagesByChatId({ id: "c1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── voteMessage ───────────────────────────────────────────────────

  describe("voteMessage", () => {
    it("inserts new vote when no existing vote", async () => {
      setResult([]);
      const result = await voteMessage({
        chatId: "c1",
        messageId: "m1",
        type: "up",
      });
      expect(result).toEqual([]);
    });

    it("updates existing vote", async () => {
      const existingVote = {
        chatId: "c1",
        messageId: "m1",
        isUpvoted: true,
      };
      setResult([existingVote]);
      const result = await voteMessage({
        chatId: "c1",
        messageId: "m1",
        type: "down",
      });
      expect(result).toEqual([existingVote]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        voteMessage({ chatId: "c1", messageId: "m1", type: "up" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getVotesByChatId ──────────────────────────────────────────────

  describe("getVotesByChatId", () => {
    it("returns votes for the chat", async () => {
      const votes = [{ chatId: "c1", messageId: "m1", isUpvoted: true }];
      setResult(votes);
      const result = await getVotesByChatId({ id: "c1" });
      expect(result).toEqual(votes);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getVotesByChatId({ id: "c1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── getMessageById ────────────────────────────────────────────────

  describe("getMessageById", () => {
    it("returns message array", async () => {
      const messages = [{ id: "m1", role: "user" }];
      setResult(messages);
      const result = await getMessageById({ id: "m1" });
      expect(result).toEqual(messages);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(getMessageById({ id: "m1" })).rejects.toMatchObject({
        type: "bad_request",
        surface: "database",
      });
    });
  });

  // ── deleteMessagesByChatIdAfterTimestamp ───────────────────────────

  describe("deleteMessagesByChatIdAfterTimestamp", () => {
    it("deletes messages and associated votes when messages exist", async () => {
      setResult([{ id: "m1" }]);
      const result = await deleteMessagesByChatIdAfterTimestamp({
        chatId: "c1",
        timestamp: new Date("2024-01-01"),
      });
      expect(result).toEqual([{ id: "m1" }]);
    });

    it("returns undefined when no messages match", async () => {
      setResult([]);
      const result = await deleteMessagesByChatIdAfterTimestamp({
        chatId: "c1",
        timestamp: new Date("2024-01-01"),
      });
      expect(result).toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        deleteMessagesByChatIdAfterTimestamp({
          chatId: "c1",
          timestamp: new Date(),
        })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── updateChatLastContextById ─────────────────────────────────────

  describe("updateChatLastContextById", () => {
    it("updates lastContext and returns result", async () => {
      setResult({ rowCount: 1 });
      const mockContext = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        inputTokenDetails: {},
        outputTokenDetails: {},
      };
      const result = await updateChatLastContextById({
        chatId: "c1",
        context: mockContext as AppUsage,
      });
      expect(result).toEqual({ rowCount: 1 });
    });

    it("does not throw on error, returns undefined", async () => {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: noop mock
      vi.spyOn(console, "warn").mockImplementation(() => {});
      setError(DB_ERROR);
      const mockContext = {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputTokenDetails: {},
        outputTokenDetails: {},
      };
      const result = await updateChatLastContextById({
        chatId: "c1",
        context: mockContext as AppUsage,
      });
      expect(result).toBeUndefined();
      vi.restoreAllMocks();
    });
  });

  // ── getMessageCountByUserId ───────────────────────────────────────

  describe("getMessageCountByUserId", () => {
    it("returns message count within time window", async () => {
      setResult([{ count: 42 }]);
      const result = await getMessageCountByUserId({
        id: "u1",
        differenceInHours: 24,
      });
      expect(result).toBe(42);
    });

    it("returns 0 when stats is empty", async () => {
      setResult([]);
      const result = await getMessageCountByUserId({
        id: "u1",
        differenceInHours: 24,
      });
      expect(result).toBe(0);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getMessageCountByUserId({ id: "u1", differenceInHours: 24 })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── createStreamId ────────────────────────────────────────────────

  describe("createStreamId", () => {
    it("inserts stream record", async () => {
      setResult(undefined);
      await expect(
        createStreamId({ streamId: "s1", chatId: "c1" })
      ).resolves.toBeUndefined();
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        createStreamId({ streamId: "s1", chatId: "c1" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });

  // ── getStreamIdsByChatId ──────────────────────────────────────────

  describe("getStreamIdsByChatId", () => {
    it("returns mapped stream IDs", async () => {
      setResult([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
      const result = await getStreamIdsByChatId({ chatId: "c1" });
      expect(result).toEqual(["s1", "s2", "s3"]);
    });

    it("returns empty array when no streams exist", async () => {
      setResult([]);
      const result = await getStreamIdsByChatId({ chatId: "c1" });
      expect(result).toEqual([]);
    });

    it("throws ChatSDKError on database error", async () => {
      setError(DB_ERROR);
      await expect(
        getStreamIdsByChatId({ chatId: "c1" })
      ).rejects.toMatchObject({ type: "bad_request", surface: "database" });
    });
  });
});
