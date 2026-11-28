import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getChatById: vi.fn(),
  deleteChatById: vi.fn(),
  recordLegacyHit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/http/legacy-hit", () => ({
  recordLegacyHit: mocks.recordLegacyHit,
}));
vi.mock("@/server/modules/chat/queries/get-chat-by-id", () => ({
  getChatById: mocks.getChatById,
}));
vi.mock("@/server/modules/chat/queries/delete-chat-by-id", () => ({
  deleteChatById: mocks.deleteChatById,
}));

import { DELETE } from "../route";

const CHAT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "user-1";

const createRequest = (): Request =>
  new Request(`http://localhost/api/chat?id=${CHAT_ID}`, { method: "DELETE" });

describe("DELETE /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.getChatById.mockResolvedValue({ id: CHAT_ID, userId: USER_ID });
    mocks.deleteChatById.mockResolvedValue({ id: CHAT_ID });
  });

  it("counts a signed-in call as one legacy hit", async () => {
    // Arrange
    mocks.auth.mockResolvedValue({ user: { id: USER_ID } });

    // Act
    await DELETE(createRequest());

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "DELETE /api/chat"
    );
  });

  it("does not count a signed-out call", async () => {
    // Act
    const response = await DELETE(createRequest());

    // Assert
    expect(response.status).toBe(401);
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });
});
