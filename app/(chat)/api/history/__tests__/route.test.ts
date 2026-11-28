import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getChatsByUserId: vi.fn(),
  deleteAllChatsByUserId: vi.fn(),
  recordLegacyHit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/http/legacy-hit", () => ({
  recordLegacyHit: mocks.recordLegacyHit,
}));
vi.mock("@/server/modules/chat/queries/get-chats-by-user-id", () => ({
  getChatsByUserId: mocks.getChatsByUserId,
}));
vi.mock("@/server/modules/chat/queries/delete-all-chats-by-user-id", () => ({
  deleteAllChatsByUserId: mocks.deleteAllChatsByUserId,
}));

import { DELETE, GET } from "../route";

const createGetRequest = (): NextRequest =>
  new NextRequest("http://localhost/api/history?limit=10");

describe("GET /api/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.getChatsByUserId.mockResolvedValue({ chats: [], hasMore: false });
  });

  it("counts a signed-in call as one legacy hit", async () => {
    // Arrange
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

    // Act
    await GET(createGetRequest());

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "GET /api/history"
    );
  });

  it("does not count a signed-out call", async () => {
    // Act
    const response = await GET(createGetRequest());

    // Assert
    expect(response.status).toBe(401);
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.deleteAllChatsByUserId.mockResolvedValue({ deletedCount: 0 });
  });

  it("counts a signed-in call as one legacy hit", async () => {
    // Arrange
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

    // Act
    await DELETE();

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "DELETE /api/history"
    );
  });

  it("does not count a signed-out call", async () => {
    // Act
    const response = await DELETE();

    // Assert
    expect(response.status).toBe(401);
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });
});
