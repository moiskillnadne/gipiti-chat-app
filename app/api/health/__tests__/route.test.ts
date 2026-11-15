import { beforeEach, describe, expect, it, vi } from "vitest";

const { isRateLimitingEnabledMock, executeMock } = vi.hoisted(() => ({
  isRateLimitingEnabledMock: vi.fn(),
  executeMock: vi.fn(),
}));

vi.mock("@/lib/db/connection", () => ({ db: { execute: executeMock } }));
vi.mock("@/lib/redis", () => ({
  getUpstashClient: () => null,
  isUpstashConfigured: () => false,
}));
vi.mock("@/lib/rate-limit", () => ({
  isRateLimitingEnabled: isRateLimitingEnabledMock,
}));

import { GET } from "../route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.stubEnv("POSTGRES_URL", "postgres://example.test/db");
    executeMock.mockReset().mockResolvedValue([]);
    isRateLimitingEnabledMock.mockReset();
  });

  it("reports that rate limiting is off without changing the overall status", async () => {
    // Arrange
    isRateLimitingEnabledMock.mockReturnValue(false);

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body.status).toBe("healthy");
    expect(body.checks.rateLimiting).toEqual({ enabled: false });
  });

  it("reports that rate limiting is on", async () => {
    // Arrange
    isRateLimitingEnabledMock.mockReturnValue(true);

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(body.checks.rateLimiting).toEqual({ enabled: true });
  });
});
