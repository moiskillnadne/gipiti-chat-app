import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  isRateLimitingEnabledMock,
  executeMock,
  isUpstashConfiguredMock,
  pingMock,
} = vi.hoisted(() => ({
  isRateLimitingEnabledMock: vi.fn(),
  executeMock: vi.fn(),
  isUpstashConfiguredMock: vi.fn(),
  pingMock: vi.fn(),
}));

vi.mock("@/server/db/connection", () => ({ db: { execute: executeMock } }));
vi.mock("@/server/integrations/redis/client", () => ({
  getUpstashClient: () => ({ ping: pingMock }),
  isUpstashConfigured: isUpstashConfiguredMock,
}));
vi.mock("@/server/http/rate-limit", () => ({
  isRateLimitingEnabled: isRateLimitingEnabledMock,
}));

import { GET } from "@/app/api/health/route";

const DATABASE_HOST = "ep-secret-host.eu-central-1.aws.neon.tech";
const REDIS_HOST = "secret-redis.upstash.io";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.stubEnv("POSTGRES_URL", "postgres://example.test/db");
    executeMock.mockReset().mockResolvedValue([]);
    isRateLimitingEnabledMock.mockReset().mockReturnValue(true);
    isUpstashConfiguredMock.mockReset().mockReturnValue(false);
    pingMock.mockReset().mockResolvedValue("PONG");
    vi.spyOn(console, "error").mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
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
    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(body.checks.rateLimiting).toEqual({ enabled: true });
  });

  it("does not list environment variable names", async () => {
    // Arrange
    vi.stubEnv("AUTH_SECRET", "secret");
    vi.stubEnv("KV_REST_API_URL", "https://example.test");

    // Act
    const response = await GET();
    const bodyText = await response.text();

    // Assert
    expect(JSON.parse(bodyText).checks.environment).toEqual({ status: "up" });
    expect(bodyText).not.toContain("POSTGRES_URL");
    expect(bodyText).not.toContain("AUTH_SECRET");
    expect(bodyText).not.toContain("KV_REST_API_URL");
  });

  it("reports a missing required variable without naming it", async () => {
    // Arrange
    vi.stubEnv("POSTGRES_URL", "");
    const consoleErrorSpy = vi.mocked(console.error);

    // Act
    const response = await GET();
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    // Assert
    expect(response.status).toBe(503);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.environment).toEqual({
      status: "down",
      error: "Required configuration is missing",
    });
    expect(bodyText).not.toContain("POSTGRES_URL");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Missing required environment variables"),
      ["POSTGRES_URL"]
    );
  });

  it("reports a database failure without the driver's message", async () => {
    // Arrange
    const databaseError = new Error(`getaddrinfo ENOTFOUND ${DATABASE_HOST}`);
    executeMock.mockRejectedValue(databaseError);
    const consoleErrorSpy = vi.mocked(console.error);

    // Act
    const response = await GET();
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    // Assert
    expect(response.status).toBe(503);
    expect(body.checks.database.status).toBe("down");
    expect(body.checks.database.error).toBe("Database check failed");
    expect(bodyText).not.toContain(DATABASE_HOST);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Database check failed"),
      databaseError
    );
  });

  it("reports a Redis failure as degraded without the client's message", async () => {
    // Arrange
    isUpstashConfiguredMock.mockReturnValue(true);
    pingMock.mockRejectedValue(new Error(`fetch failed: ${REDIS_HOST}`));

    // Act
    const response = await GET();
    const bodyText = await response.text();
    const body = JSON.parse(bodyText);

    // Assert
    expect(response.status).toBe(200);
    expect(body.status).toBe("degraded");
    expect(body.checks.redis.status).toBe("down");
    expect(body.checks.redis.error).toBe("Redis check failed");
    expect(bodyText).not.toContain(REDIS_HOST);
  });
});
