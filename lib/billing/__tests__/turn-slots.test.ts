import { describe, expect, it, vi } from "vitest";

import { MEDIA_TURN_SLOT_LIMIT, TEXT_TURN_SLOT_LIMIT } from "../constants";
import {
  createMemorySlotBackend,
  createRedisSlotBackend,
  createTurnSlotLimiter,
  type RedisSlotClient,
  turnSlotKindForMode,
} from "../turn-slots";

const TTL_MS = 800_000;

const buildMemoryLimiter = (clock: { nowMs: number }) =>
  createTurnSlotLimiter({
    primary: createMemorySlotBackend(),
    fallback: createMemorySlotBackend(),
    now: () => clock.nowMs,
  });

describe("turnSlotKindForMode", () => {
  it("groups image and video turns into the media slot", () => {
    expect(turnSlotKindForMode("image")).toBe("media");
    expect(turnSlotKindForMode("video")).toBe("media");
    expect(turnSlotKindForMode("text")).toBe("text");
  });
});

describe("turn slot limiter with the in-memory backend", () => {
  it("refuses a second media turn for the same user", async () => {
    // Arrange
    const limiter = buildMemoryLimiter({ nowMs: 0 });
    const first = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });

    // Act
    const second = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });

    // Assert
    expect(MEDIA_TURN_SLOT_LIMIT).toBe(1);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });

  it("grants a media slot to a different user", async () => {
    const limiter = buildMemoryLimiter({ nowMs: 0 });
    await limiter.acquire({ userId: "user-1", kind: "media", ttlMs: TTL_MS });

    const other = await limiter.acquire({
      userId: "user-2",
      kind: "media",
      ttlMs: TTL_MS,
    });

    expect(other).not.toBeNull();
  });

  it("grants three text slots and refuses the fourth", async () => {
    const limiter = buildMemoryLimiter({ nowMs: 0 });
    const acquireText = () =>
      limiter.acquire({ userId: "user-1", kind: "text", ttlMs: TTL_MS });

    const granted = [
      await acquireText(),
      await acquireText(),
      await acquireText(),
    ];
    const fourth = await acquireText();

    expect(TEXT_TURN_SLOT_LIMIT).toBe(3);
    expect(granted.every((slot) => slot !== null)).toBe(true);
    expect(fourth).toBeNull();
  });

  it("keeps text and media slots independent", async () => {
    const limiter = buildMemoryLimiter({ nowMs: 0 });
    await limiter.acquire({ userId: "user-1", kind: "media", ttlMs: TTL_MS });

    const text = await limiter.acquire({
      userId: "user-1",
      kind: "text",
      ttlMs: TTL_MS,
    });

    expect(text).not.toBeNull();
  });

  it("frees the slot on release", async () => {
    const limiter = buildMemoryLimiter({ nowMs: 0 });
    const first = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });

    await first?.release();
    const next = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });

    expect(next).not.toBeNull();
  });

  it("releasing twice frees only one slot", async () => {
    const limiter = buildMemoryLimiter({ nowMs: 0 });
    const acquireText = () =>
      limiter.acquire({ userId: "user-1", kind: "text", ttlMs: TTL_MS });
    const first = await acquireText();
    await acquireText();
    await acquireText();

    await first?.release();
    await first?.release();
    const replacement = await acquireText();
    const extra = await acquireText();

    expect(replacement).not.toBeNull();
    expect(extra).toBeNull();
  });

  it("reclaims a slot whose TTL has expired", async () => {
    const clock = { nowMs: 0 };
    const limiter = buildMemoryLimiter(clock);
    await limiter.acquire({ userId: "user-1", kind: "media", ttlMs: TTL_MS });

    clock.nowMs = TTL_MS + 1;
    const next = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });

    expect(next).not.toBeNull();
  });

  it("does not reclaim a slot before its TTL", async () => {
    const clock = { nowMs: 0 };
    const limiter = buildMemoryLimiter(clock);
    await limiter.acquire({ userId: "user-1", kind: "media", ttlMs: TTL_MS });

    clock.nowMs = TTL_MS - 1;
    const next = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });

    expect(next).toBeNull();
  });
});

describe("turn slot limiter with the Redis backend", () => {
  const buildRedisClient = (evalResult: unknown) => {
    const evalMock = vi.fn().mockResolvedValue(evalResult);
    const zremMock = vi.fn().mockResolvedValue(1);
    const client: RedisSlotClient = { eval: evalMock, zrem: zremMock };
    return { client, evalMock, zremMock };
  };

  it("acquires with one atomic script on the user's sorted set", async () => {
    // Arrange
    const { client, evalMock } = buildRedisClient(1);
    const limiter = createTurnSlotLimiter({
      primary: createRedisSlotBackend(client),
      fallback: createMemorySlotBackend(),
      now: () => 1000,
      generateSlotId: () => "slot-1",
    });

    // Act
    const slot = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });

    // Assert
    expect(slot).not.toBeNull();
    expect(evalMock).toHaveBeenCalledTimes(1);
    const [script, keys, args] = evalMock.mock.calls[0];
    expect(script).toContain("ZREMRANGEBYSCORE");
    expect(script).toContain("ZCARD");
    expect(script).toContain("ZADD");
    expect(script).toContain("PEXPIRE");
    expect(keys).toEqual(["turn-slots:media:user-1"]);
    expect(args).toEqual([
      "1000",
      String(MEDIA_TURN_SLOT_LIMIT),
      String(1000 + TTL_MS),
      String(TTL_MS),
      "slot-1",
    ]);
  });

  it("returns null when the script refuses the slot", async () => {
    const { client } = buildRedisClient(0);
    const limiter = createTurnSlotLimiter({
      primary: createRedisSlotBackend(client),
      fallback: createMemorySlotBackend(),
    });

    const slot = await limiter.acquire({
      userId: "user-1",
      kind: "text",
      ttlMs: TTL_MS,
    });

    expect(slot).toBeNull();
  });

  it("releases by removing the slot member", async () => {
    const { client, zremMock } = buildRedisClient(1);
    const limiter = createTurnSlotLimiter({
      primary: createRedisSlotBackend(client),
      fallback: createMemorySlotBackend(),
      generateSlotId: () => "slot-7",
    });
    const slot = await limiter.acquire({
      userId: "user-1",
      kind: "text",
      ttlMs: TTL_MS,
    });

    await slot?.release();

    expect(zremMock).toHaveBeenCalledWith("turn-slots:text:user-1", "slot-7");
  });

  it("uses the in-memory backend for the turn when Redis fails", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(vi.fn());
    const evalMock = vi.fn().mockRejectedValue(new Error("redis down"));
    const zremMock = vi.fn();
    const limiter = createTurnSlotLimiter({
      primary: createRedisSlotBackend({ eval: evalMock, zrem: zremMock }),
      fallback: createMemorySlotBackend(),
    });

    const first = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });
    const second = await limiter.acquire({
      userId: "user-1",
      kind: "media",
      ttlMs: TTL_MS,
    });
    await first?.release();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(zremMock).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("logs a failed release instead of throwing", async () => {
    const logError = vi.spyOn(console, "error").mockImplementation(vi.fn());
    const limiter = createTurnSlotLimiter({
      primary: createRedisSlotBackend({
        eval: vi.fn().mockResolvedValue(1),
        zrem: vi.fn().mockRejectedValue(new Error("redis down")),
      }),
      fallback: createMemorySlotBackend(),
    });
    const slot = await limiter.acquire({
      userId: "user-1",
      kind: "text",
      ttlMs: TTL_MS,
    });

    await expect(slot?.release()).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(
      "[turn-slot] release failed",
      expect.objectContaining({ userId: "user-1", kind: "text" })
    );
    logError.mockRestore();
  });
});
