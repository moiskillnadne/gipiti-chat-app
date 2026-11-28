import { describe, expect, it, vi } from "vitest";

// The real service and registry: only the database and the session are
// replaced, so a key that is a name on `Object.prototype` meets the registry.
vi.mock("server-only", () => ({}));
vi.mock("@/server/modules/auth/next-auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
}));
vi.mock("@/server/db/connection", () => ({ db: {} }));

import { POST } from "../route";

describe("POST /api/quiz/[key] with a key that is an Object.prototype name", () => {
  it.each(["constructor", "toString", "__proto__"])(
    "answers 400 unknown quiz for %s, not 500",
    async (key) => {
      // Arrange
      const request = new Request(`http://localhost/api/quiz/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: {} }),
      });

      // Act
      const response = await POST(request, {
        params: Promise.resolve({ key }),
      });

      // Assert
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "bad_request:api",
        cause: `Unknown quiz "${key}"`,
      });
    }
  );
});
