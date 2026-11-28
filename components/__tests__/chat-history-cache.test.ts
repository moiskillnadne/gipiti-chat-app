import { describe, expect, it } from "vitest";

import type { ChatDto, ChatListDto } from "@/client/shared/api/types";
import {
  EMPTY_CHAT_HISTORY,
  findChat,
  withChatRestored,
  withMessageVote,
  withoutChat,
} from "../chat-history-cache";

const makeChat = (id: string, createdAt: string): ChatDto => ({
  id,
  title: `Chat ${id}`,
  createdAt,
});

const newest = makeChat("c1", "2026-11-28T10:00:00.000Z");
const middle = makeChat("c2", "2026-11-27T10:00:00.000Z");
const older = makeChat("c3", "2026-11-26T10:00:00.000Z");
const oldest = makeChat("c4", "2026-11-25T10:00:00.000Z");

const makePages = (): ChatListDto[] => [
  { items: [newest, middle], nextCursor: "cursor-1" },
  { items: [older, oldest], nextCursor: null },
];

describe("findChat", () => {
  it("finds a chat on a later page", () => {
    // Act
    const found = findChat(makePages(), "c3");

    // Assert
    expect(found).toEqual(older);
  });

  it("answers undefined for an unknown chat and for no cache", () => {
    // Act / Assert
    expect(findChat(makePages(), "missing")).toBeUndefined();
    expect(findChat(undefined, "c1")).toBeUndefined();
  });
});

describe("withoutChat", () => {
  it("removes only that chat and keeps the cursors", () => {
    // Arrange
    const pages = makePages();

    // Act
    const result = withoutChat(pages, "c2");

    // Assert
    expect(result?.[0].items).toEqual([newest]);
    expect(result?.[0].nextCursor).toBe("cursor-1");
    expect(result?.[1].items).toEqual([older, oldest]);
    expect(pages[0].items).toEqual([newest, middle]);
  });

  it("changes nothing when the chat is not there, and removing twice is harmless", () => {
    // Act
    const once = withoutChat(makePages(), "c1");
    const twice = withoutChat(once, "c1");

    // Assert
    expect(twice).toEqual(once);
    expect(withoutChat(makePages(), "missing")).toEqual(makePages());
  });

  it("leaves an empty cache empty", () => {
    // Act / Assert
    expect(withoutChat(undefined, "c1")).toBeUndefined();
  });
});

describe("withChatRestored", () => {
  it("puts a removed chat back at its place on the same page", () => {
    // Arrange
    const removed = withoutChat(makePages(), "c2");

    // Act
    const result = withChatRestored(removed, middle);

    // Assert
    expect(result).toEqual(makePages());
  });

  it("puts a removed last chat of a page back at the end of it", () => {
    // Arrange
    const removed = withoutChat(makePages(), "c4");

    // Act
    const result = withChatRestored(removed, oldest);

    // Assert
    expect(result).toEqual(makePages());
  });

  it("puts a chat that sorts between two pages at the end of the earlier page", () => {
    // Arrange
    const between = makeChat("c5", "2026-11-27T05:00:00.000Z");

    // Act
    const result = withChatRestored(makePages(), between);

    // Assert
    expect(result?.[0].items.map((chat) => chat.id)).toEqual([
      "c1",
      "c2",
      "c5",
    ]);
    expect(result?.[1].items).toEqual([older, oldest]);
  });

  it("puts a chat newer than everything at the top of the first page", () => {
    // Arrange
    const fresh = makeChat("c6", "2026-11-29T10:00:00.000Z");

    // Act
    const result = withChatRestored(makePages(), fresh);

    // Assert
    expect(result?.[0].items.map((chat) => chat.id)).toEqual([
      "c6",
      "c1",
      "c2",
    ]);
  });

  it("does not add a chat that is already there", () => {
    // Act
    const result = withChatRestored(makePages(), middle);

    // Assert
    expect(result).toEqual(makePages());
  });

  it("leaves an empty cache empty", () => {
    // Act / Assert
    expect(withChatRestored(undefined, newest)).toBeUndefined();
  });
});

describe("EMPTY_CHAT_HISTORY", () => {
  it("is one empty page that ends the list", () => {
    // Assert
    expect(EMPTY_CHAT_HISTORY).toEqual([{ items: [], nextCursor: null }]);
  });
});

describe("withMessageVote", () => {
  it("adds a vote and replaces an earlier one on the same message", () => {
    // Arrange
    const current = { items: [{ messageId: "m1", isUpvoted: true }] };

    // Act
    const result = withMessageVote(current, "m1", false);

    // Assert
    expect(result.items).toEqual([{ messageId: "m1", isUpvoted: false }]);
    expect(current.items).toEqual([{ messageId: "m1", isUpvoted: true }]);
  });

  it("keeps the votes of other messages", () => {
    // Arrange
    const current = { items: [{ messageId: "m1", isUpvoted: true }] };

    // Act
    const result = withMessageVote(current, "m2", true);

    // Assert
    expect(result.items).toEqual([
      { messageId: "m1", isUpvoted: true },
      { messageId: "m2", isUpvoted: true },
    ]);
  });

  it("removes the vote when the new state is undefined", () => {
    // Arrange
    const current = {
      items: [
        { messageId: "m1", isUpvoted: true },
        { messageId: "m2", isUpvoted: false },
      ],
    };

    // Act
    const result = withMessageVote(current, "m1", undefined);

    // Assert
    expect(result.items).toEqual([{ messageId: "m2", isUpvoted: false }]);
  });

  it("adds the first vote to an empty list as a new list", () => {
    // Arrange
    const current = { items: [] };

    // Act
    const result = withMessageVote(current, "m1", true);

    // Assert
    expect(result).not.toBe(current);
    expect(result.items).toEqual([{ messageId: "m1", isUpvoted: true }]);
    expect(current.items).toEqual([]);
  });

  it("starts a list when nothing is cached yet", () => {
    // Act
    const result = withMessageVote(undefined, "m1", true);

    // Assert
    expect(result.items).toEqual([{ messageId: "m1", isUpvoted: true }]);
  });
});
