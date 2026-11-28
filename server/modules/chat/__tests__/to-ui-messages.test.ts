import { formatISO } from "date-fns";
import { describe, expect, it } from "vitest";

import type { DBMessage } from "@/server/db/schema";

import { convertToUIMessages } from "../to-ui-messages";

const buildDbMessage = (overrides: Partial<DBMessage> = {}): DBMessage => ({
  id: "message-1",
  chatId: "chat-1",
  role: "assistant",
  parts: [{ type: "text", text: "Hello" }],
  attachments: [],
  createdAt: new Date("2026-01-15T10:30:00.000Z"),
  modelId: "model-a",
  ...overrides,
});

describe("convertToUIMessages", () => {
  it("maps id, role and parts of a stored message", () => {
    // Arrange
    const parts = [{ type: "text", text: "Question" }];
    const storedMessage = buildDbMessage({ id: "m-42", role: "user", parts });

    // Act
    const [uiMessage] = convertToUIMessages([storedMessage]);

    // Assert
    expect(uiMessage.id).toBe("m-42");
    expect(uiMessage.role).toBe("user");
    expect(uiMessage.parts).toEqual(parts);
  });

  it("puts the row createdAt into metadata as an ISO string", () => {
    // Arrange
    const createdAt = new Date("2026-03-01T08:15:00.000Z");
    const storedMessage = buildDbMessage({ createdAt });

    // Act
    const [uiMessage] = convertToUIMessages([storedMessage]);

    // Assert
    expect(uiMessage.metadata?.createdAt).toBe(formatISO(createdAt));
  });

  it("keeps the model id in metadata", () => {
    // Arrange
    const storedMessage = buildDbMessage({ modelId: "model-b" });

    // Act
    const [uiMessage] = convertToUIMessages([storedMessage]);

    // Assert
    expect(uiMessage.metadata?.modelId).toBe("model-b");
  });

  it("turns a null model id into undefined", () => {
    // Arrange
    const storedMessage = buildDbMessage({ modelId: null });

    // Act
    const [uiMessage] = convertToUIMessages([storedMessage]);

    // Assert
    expect(uiMessage.metadata?.modelId).toBeUndefined();
  });

  it("returns an empty list for an empty list", () => {
    // Arrange
    const storedMessages: DBMessage[] = [];

    // Act
    const uiMessages = convertToUIMessages(storedMessages);

    // Assert
    expect(uiMessages).toEqual([]);
  });
});
