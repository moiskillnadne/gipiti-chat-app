import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TurnBalanceCheck } from "@/lib/billing/turn-balance";
import type { ChatTurnContext } from "../context";

const { saveMessagesMock } = vi.hoisted(() => ({
  saveMessagesMock: vi.fn(),
}));

vi.mock("@/lib/db/query/chat/save-messages", () => ({
  saveMessages: saveMessagesMock,
}));

import { enforceBalance } from "../enforce-balance";

const buildContext = (balanceCheck: TurnBalanceCheck): ChatTurnContext =>
  ({ chatId: "chat-1", balanceCheck }) as unknown as ChatTurnContext;

describe("enforceBalance", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns quota_exceeded and saves the notice below the turn minimum", async () => {
    // Arrange
    const ctx = buildContext({
      isSufficient: false,
      requiredMinor: 2000,
      availableMinor: 1999,
    });

    // Act
    const response = await enforceBalance(ctx);

    // Assert
    expect(response?.status).toBe(429);
    const body = (await response?.json()) as { code: string };
    expect(body.code).toBe("quota_exceeded:chat");
    expect(saveMessagesMock).toHaveBeenCalledTimes(1);
    const [{ messages }] = saveMessagesMock.mock.calls[0];
    expect(messages[0]).toMatchObject({ chatId: "chat-1", role: "assistant" });
  });

  it("proceeds at or above the turn minimum", async () => {
    const ctx = buildContext({
      isSufficient: true,
      requiredMinor: 2000,
      availableMinor: 2000,
    });

    const response = await enforceBalance(ctx);

    expect(response).toBeNull();
    expect(saveMessagesMock).not.toHaveBeenCalled();
  });
});
