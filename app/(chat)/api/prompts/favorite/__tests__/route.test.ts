import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  recordLegacyHit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({ auth: mocks.auth }));
vi.mock("@/server/http/legacy-hit", () => ({
  recordLegacyHit: mocks.recordLegacyHit,
}));
vi.mock("@/server/modules/prompts/queries/add-prompt-favorite", () => ({
  addPromptFavorite: vi.fn(),
}));
vi.mock("@/server/modules/prompts/queries/remove-prompt-favorite", () => ({
  removePromptFavorite: vi.fn(),
}));

import { DELETE, POST } from "../route";

const postRequest = (): Request =>
  new Request("http://localhost/api/prompts/favorite", {
    method: "POST",
    body: JSON.stringify({ promptId: "not-a-uuid" }),
  });
const deleteRequest = (): Request =>
  new Request("http://localhost/api/prompts/favorite", { method: "DELETE" });

describe("/api/prompts/favorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("counts a signed-in POST as one legacy hit", async () => {
    // Act
    await POST(postRequest());

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "POST /api/prompts/favorite"
    );
  });

  it("counts a signed-in DELETE as one legacy hit", async () => {
    // Act
    await DELETE(deleteRequest());

    // Assert
    expect(mocks.recordLegacyHit).toHaveBeenCalledExactlyOnceWith(
      "DELETE /api/prompts/favorite"
    );
  });

  it("does not count a signed-out POST or DELETE", async () => {
    // Arrange
    mocks.auth.mockResolvedValue(null);

    // Act
    await POST(postRequest());
    await DELETE(deleteRequest());

    // Assert
    expect(mocks.recordLegacyHit).not.toHaveBeenCalled();
  });
});
