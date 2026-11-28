import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getActivePrompts: vi.fn(),
  getFavoritePromptIds: vi.fn(),
  recordLegacyHit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/http/legacy-hit", () => ({
  recordLegacyHit: mocks.recordLegacyHit,
}));
vi.mock("@/server/modules/prompts/queries/get-active-prompts", () => ({
  getActivePrompts: mocks.getActivePrompts,
}));
vi.mock("@/server/modules/prompts/queries/get-favorite-prompt-ids", () => ({
  getFavoritePromptIds: mocks.getFavoritePromptIds,
}));

import { GET } from "../route";

describe("GET /api/prompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue(null);
    mocks.getActivePrompts.mockResolvedValue([]);
    mocks.getFavoritePromptIds.mockResolvedValue([]);
  });

  it("counts a signed-in call as one legacy hit", async () => {
    // Arrange
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

    // Act
    await GET();

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "GET /api/prompts"
    );
  });

  it("does not count an anonymous call, and still answers it", async () => {
    // Act
    const response = await GET();

    // Assert
    expect(response.status).toBe(200);
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });
});
