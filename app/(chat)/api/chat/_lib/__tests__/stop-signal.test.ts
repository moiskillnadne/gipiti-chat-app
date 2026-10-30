import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetStopSignalForTests,
  requestChatStop,
  watchChatStop,
} from "../stop-signal";

const CHAT = "chat-1";
const MESSAGE = "message-1";
const TURN = { chatId: CHAT, messageId: MESSAGE };

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

  it("fires onStop when a stop is requested for the watched turn", async () => {
    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });

    await requestChatStop(TURN);

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("fires only once for repeated stops", async () => {
    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });

    await requestChatStop(TURN);
    await requestChatStop(TURN);

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("fires on registration for a stop requested just before the watch", async () => {
    await requestChatStop(TURN);

    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("does not depend on the clock: a stop long before still matches the turn", async () => {
    await requestChatStop(TURN);
    vi.advanceTimersByTime(30_000);

    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });

    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("forgets a stop marker after the TTL", async () => {
    await requestChatStop(TURN);
    vi.advanceTimersByTime(61_000);

    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });

    expect(onStop).not.toHaveBeenCalled();
  });

  it("a stop for an earlier user message does not hit the next turn", async () => {
    await requestChatStop({ chatId: CHAT, messageId: "message-0" });

    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });
    await requestChatStop({ chatId: CHAT, messageId: "message-0" });

    expect(onStop).not.toHaveBeenCalled();
  });

  it("two turns of one chat (two tabs) are stopped independently", async () => {
    const first = vi.fn();
    const second = vi.fn();
    watchChatStop({ chatId: CHAT, messageId: "message-a", onStop: first });
    watchChatStop({ chatId: CHAT, messageId: "message-b", onStop: second });

    await requestChatStop({ chatId: CHAT, messageId: "message-a" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("consumes the marker when the turn ends, so regenerate is not killed by it", async () => {
    const firstTurn = vi.fn();
    const cleanup = watchChatStop({ ...TURN, onStop: firstTurn });
    await requestChatStop(TURN);
    await cleanup();

    const regenerated = vi.fn();
    watchChatStop({ ...TURN, onStop: regenerated });

    expect(firstTurn).toHaveBeenCalledTimes(1);
    expect(regenerated).not.toHaveBeenCalled();
  });

  it("does not fire after cleanup, and cleanup is idempotent", async () => {
    const onStop = vi.fn();
    const cleanup = watchChatStop({ ...TURN, onStop });

    await cleanup();
    await cleanup();
    await requestChatStop(TURN);

    expect(onStop).not.toHaveBeenCalled();
  });

  it("returns without waiting for the subscription (no await needed)", () => {
    const cleanup = watchChatStop({ ...TURN, onStop: vi.fn() });

    expect(typeof cleanup).toBe("function");
  });

  it("leaves other chats untouched", async () => {
    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });

    await requestChatStop({ chatId: "other-chat", messageId: MESSAGE });

    expect(onStop).not.toHaveBeenCalled();
  });

  it("stops every watcher of the turn", async () => {
    const first = vi.fn();
    const second = vi.fn();
    watchChatStop({ ...TURN, onStop: first });
    watchChatStop({ ...TURN, onStop: second });

    await requestChatStop(TURN);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("unregisters itself after maxLifetimeMs", async () => {
    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop, maxLifetimeMs: 1000 });

    await vi.advanceTimersByTimeAsync(1001);
    await requestChatStop(TURN);

    expect(onStop).not.toHaveBeenCalled();
  });

  it("survives an onStop handler that throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    watchChatStop({
      ...TURN,
      onStop: () => {
        throw new Error("boom");
      },
    });

    await expect(requestChatStop(TURN)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
