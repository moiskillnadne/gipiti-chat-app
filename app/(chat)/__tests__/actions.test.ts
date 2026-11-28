import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  deleteTrailingMessagesForUser: vi.fn(),
  recordLegacyHit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/http/legacy-hit", () => ({
  recordLegacyHit: mocks.recordLegacyHit,
}));
vi.mock("@/server/modules/chat/delete-trailing-messages", () => ({
  deleteTrailingMessagesForUser: mocks.deleteTrailingMessagesForUser,
}));

import { deleteTrailingMessages } from "../actions";

const MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

describe("deleteTrailingMessages action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
  });

  it("counts a signed-in call as one legacy hit", async () => {
    // Arrange
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

    // Act
    await deleteTrailingMessages({ id: MESSAGE_ID });

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "action deleteTrailingMessages"
    );
  });

  it("does not count a signed-out call", async () => {
    // Act
    const outcome = deleteTrailingMessages({ id: MESSAGE_ID });

    // Assert
    await expect(outcome).rejects.toThrow();
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });
});
