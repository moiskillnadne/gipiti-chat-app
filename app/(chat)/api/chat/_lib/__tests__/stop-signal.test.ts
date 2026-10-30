import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetStopSignalForTests,
  requestChatStop,
  watchChatStop,
} from "../stop-signal";

const CHAT = "chat-1";

describe("stop-signal (in-process backend)", () => {
  beforeEach(() => {
    vi.stubEnv("REDIS_URL", "");
    vi.stubEnv("KV_URL", "");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T10:00:00Z"));
    __resetStopSignalForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("fires onStop when a stop is requested after the watch started", async () => {
    const onStop = vi.fn();
    await watchChatStop({ chatId: CHAT, startedAt: Date.now(), onStop });

    vi.advanceTimersByTime(50);
    await requestChatStop(CHAT);

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("fires only once for repeated stops", async () => {
    const onStop = vi.fn();
    await watchChatStop({ chatId: CHAT, startedAt: Date.now(), onStop });

    await requestChatStop(CHAT);
    await requestChatStop(CHAT);

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("ignores a stop older than the turn start", async () => {
    await requestChatStop(CHAT);
    vi.advanceTimersByTime(1000);

    const onStop = vi.fn();
    await watchChatStop({ chatId: CHAT, startedAt: Date.now(), onStop });

    expect(onStop).not.toHaveBeenCalled();
  });

  it("fires on registration for a stop requested just before the watch", async () => {
    const startedAt = Date.now();
    vi.advanceTimersByTime(20);
    await requestChatStop(CHAT);

    const onStop = vi.fn();
    await watchChatStop({ chatId: CHAT, startedAt, onStop });

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("does not fire after cleanup, and cleanup is idempotent", async () => {
    const onStop = vi.fn();
    const cleanup = await watchChatStop({
      chatId: CHAT,
      startedAt: Date.now(),
      onStop,
    });

    await cleanup();
    await cleanup();
    await requestChatStop(CHAT);

    expect(onStop).not.toHaveBeenCalled();
  });

  it("leaves other chats untouched", async () => {
    const onStop = vi.fn();
    await watchChatStop({ chatId: CHAT, startedAt: Date.now(), onStop });

    await requestChatStop("other-chat");

    expect(onStop).not.toHaveBeenCalled();
  });

  it("stops every watcher of the chat", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const startedAt = Date.now();
    await watchChatStop({ chatId: CHAT, startedAt, onStop: first });
    await watchChatStop({ chatId: CHAT, startedAt, onStop: second });

    await requestChatStop(CHAT);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("unregisters itself after maxLifetimeMs", async () => {
    const onStop = vi.fn();
    await watchChatStop({
      chatId: CHAT,
      startedAt: Date.now(),
      onStop,
      maxLifetimeMs: 1000,
    });

    await vi.advanceTimersByTimeAsync(1001);
    await requestChatStop(CHAT);

    expect(onStop).not.toHaveBeenCalled();
  });

  it("survives an onStop handler that throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    await watchChatStop({
      chatId: CHAT,
      startedAt: Date.now(),
      onStop: () => {
        throw new Error("boom");
      },
    });

    await expect(requestChatStop(CHAT)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
