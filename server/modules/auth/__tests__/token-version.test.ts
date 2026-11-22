import { beforeEach, describe, expect, it, vi } from "vitest";

import { getUpstashClient } from "@/server/integrations/redis/client";
import {
  forgetTokenVersionOlderThan,
  getTokenVersion,
  getTokenVersionForNewSession,
  isSessionVersionCurrent,
  rememberTokenVersion,
} from "@/server/modules/auth/token-version";
import { getUserTokenVersion } from "@/server/modules/users/queries/get-token-version";

vi.mock("@/server/integrations/redis/client", () => ({
  getUpstashClient: vi.fn(),
}));
vi.mock("@/server/modules/users/queries/get-token-version", () => ({
  getUserTokenVersion: vi.fn(),
}));

const USER_ID = "user-1";
const CACHE_KEY = `tv:${USER_ID}`;
const CACHE_SECONDS = 600;

const redis = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
type UpstashClient = NonNullable<ReturnType<typeof getUpstashClient>>;

const useRedis = (): void => {
  vi.mocked(getUpstashClient).mockReturnValue(
    redis as unknown as UpstashClient
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUpstashClient).mockReturnValue(null);
  redis.get.mockResolvedValue(null);
  redis.set.mockResolvedValue("OK");
  vi.mocked(getUserTokenVersion).mockResolvedValue(0);
  vi.spyOn(console, "warn").mockReturnValue(undefined);
  vi.spyOn(console, "error").mockReturnValue(undefined);
});

describe("getTokenVersion", () => {
  it("answers the cached version without asking the database", async () => {
    // Arrange
    useRedis();
    redis.get.mockResolvedValue(4);

    // Act
    const version = await getTokenVersion(USER_ID);

    // Assert
    expect(version).toBe(4);
    expect(redis.get).toHaveBeenCalledWith(CACHE_KEY);
    expect(getUserTokenVersion).not.toHaveBeenCalled();
  });

  it("treats a cached 0 as a hit", async () => {
    // Arrange
    useRedis();
    redis.get.mockResolvedValue(0);

    // Act
    const version = await getTokenVersion(USER_ID);

    // Assert
    expect(version).toBe(0);
    expect(getUserTokenVersion).not.toHaveBeenCalled();
  });

  it("reads the database on a miss and caches the answer only if no value is there yet", async () => {
    // Arrange
    useRedis();
    vi.mocked(getUserTokenVersion).mockResolvedValue(2);

    // Act
    const version = await getTokenVersion(USER_ID);

    // Assert
    expect(version).toBe(2);
    expect(redis.set).toHaveBeenCalledExactlyOnceWith(CACHE_KEY, 2, {
      ex: CACHE_SECONDS,
      nx: true,
    });
  });

  it("falls back to the database when the cache cannot be read", async () => {
    // Arrange
    useRedis();
    redis.get.mockRejectedValue(new Error("redis down"));
    vi.mocked(getUserTokenVersion).mockResolvedValue(5);

    // Act
    const version = await getTokenVersion(USER_ID);

    // Assert
    expect(version).toBe(5);
  });

  it("reads the database when there is no Redis at all", async () => {
    // Arrange
    vi.mocked(getUserTokenVersion).mockResolvedValue(1);

    // Act
    const version = await getTokenVersion(USER_ID);

    // Assert
    expect(version).toBe(1);
    expect(redis.get).not.toHaveBeenCalled();
  });

  it("answers null, and caches nothing, for an account that does not exist", async () => {
    // Arrange
    useRedis();
    vi.mocked(getUserTokenVersion).mockResolvedValue(null);

    // Act
    const version = await getTokenVersion(USER_ID);

    // Assert
    expect(version).toBeNull();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("still answers when the cache cannot be written", async () => {
    // Arrange
    useRedis();
    redis.set.mockRejectedValue(new Error("redis down"));
    vi.mocked(getUserTokenVersion).mockResolvedValue(2);

    // Act
    const version = await getTokenVersion(USER_ID);

    // Assert
    expect(version).toBe(2);
  });
});

describe("rememberTokenVersion", () => {
  it("overwrites the cached version, with the expiry", async () => {
    // Arrange
    useRedis();

    // Act
    await rememberTokenVersion(USER_ID, 7);

    // Assert
    expect(redis.set).toHaveBeenCalledExactlyOnceWith(CACHE_KEY, 7, {
      ex: CACHE_SECONDS,
    });
  });

  it("does not throw when Redis is missing or refuses the write", async () => {
    // Act and assert: no Redis
    await expect(rememberTokenVersion(USER_ID, 7)).resolves.toBeUndefined();

    // Arrange
    useRedis();
    redis.set.mockRejectedValue(new Error("redis down"));

    // Act and assert: a failed write
    await expect(rememberTokenVersion(USER_ID, 7)).resolves.toBeUndefined();
  });
});

describe("getTokenVersionForNewSession", () => {
  it("answers the database's version even when the cache holds an older one, and corrects the cache", async () => {
    // Arrange: a bump whose cache write was lost.
    useRedis();
    redis.get.mockResolvedValue(0);
    vi.mocked(getUserTokenVersion).mockResolvedValue(1);

    // Act
    const version = await getTokenVersionForNewSession(USER_ID);

    // Assert
    expect(version).toBe(1);
    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).toHaveBeenCalledExactlyOnceWith(CACHE_KEY, 1, {
      ex: CACHE_SECONDS,
    });
  });

  it("answers null, and caches nothing, for an account that does not exist", async () => {
    // Arrange
    useRedis();
    vi.mocked(getUserTokenVersion).mockResolvedValue(null);

    // Act and assert
    expect(await getTokenVersionForNewSession(USER_ID)).toBeNull();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("fails the sign-in rather than guess when the database cannot be read", async () => {
    // Arrange
    vi.mocked(getUserTokenVersion).mockRejectedValue(new Error("db down"));

    // Act and assert
    await expect(getTokenVersionForNewSession(USER_ID)).rejects.toThrow(
      "db down"
    );
  });
});

describe("forgetTokenVersionOlderThan", () => {
  it("drops a cached version that is behind the one a session was just issued under", async () => {
    // Arrange: a bump whose cache write was lost.
    useRedis();
    redis.get.mockResolvedValue(1);

    // Act
    await forgetTokenVersionOlderThan(USER_ID, 2);

    // Assert
    expect(redis.del).toHaveBeenCalledExactlyOnceWith(CACHE_KEY);
    // Dropped, never written: the number in hand may itself be a moment old.
    expect(redis.set).not.toHaveBeenCalled();
  });

  it.each<[string, number | null]>([
    ["equal", 2],
    ["ahead, because the account moved on meanwhile", 3],
    ["absent", null],
  ])("leaves the cache alone when its version is %s", async (_case, cached) => {
    // Arrange
    useRedis();
    redis.get.mockResolvedValue(cached);

    // Act
    await forgetTokenVersionOlderThan(USER_ID, 2);

    // Assert
    expect(redis.del).not.toHaveBeenCalled();
  });

  it("does not throw when Redis is missing or failing", async () => {
    // Act and assert: no Redis
    await expect(
      forgetTokenVersionOlderThan(USER_ID, 2)
    ).resolves.toBeUndefined();

    // Arrange
    useRedis();
    redis.get.mockRejectedValue(new Error("redis down"));

    // Act and assert: a failed read
    await expect(
      forgetTokenVersionOlderThan(USER_ID, 2)
    ).resolves.toBeUndefined();
  });
});

describe("isSessionVersionCurrent", () => {
  it.each<[string, number | undefined, number, boolean]>([
    ["a session issued under the current version", 3, 3, true],
    ["a session issued under an older version", 2, 3, false],
    [
      "an old cookie without the claim while the account is at 0",
      undefined,
      0,
      true,
    ],
    ["an old cookie without the claim after a bump", undefined, 1, false],
  ])("for %s", async (_case, claimedVersion, currentVersion, expected) => {
    // Arrange
    vi.mocked(getUserTokenVersion).mockResolvedValue(currentVersion);

    // Act
    const isCurrent = await isSessionVersionCurrent({
      id: USER_ID,
      ver: claimedVersion,
    });

    // Assert
    expect(isCurrent).toBe(expected);
  });

  it("is false when the account is gone", async () => {
    // Arrange
    vi.mocked(getUserTokenVersion).mockResolvedValue(null);

    // Act and assert
    expect(await isSessionVersionCurrent({ id: USER_ID, ver: 0 })).toBe(false);
  });

  it("is false for a session that names no account", async () => {
    expect(await isSessionVersionCurrent({ ver: 0 })).toBe(false);
  });

  it("keeps the session, and logs, when the version cannot be read at all", async () => {
    // Arrange
    vi.mocked(getUserTokenVersion).mockRejectedValue(new Error("db down"));

    // Act
    const isCurrent = await isSessionVersionCurrent({ id: USER_ID, ver: 0 });

    // Assert
    expect(isCurrent).toBe(true);
    expect(console.error).toHaveBeenCalledOnce();
  });
});
