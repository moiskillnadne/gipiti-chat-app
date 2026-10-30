import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetStopSignalForTests,
  requestChatStop,
  watchChatStop,
} from "../stop-signal";

const USER = "user-1";
const CHAT = "chat-1";
const TURN_ID = "turn-1";
const TURN = { userId: USER, chatId: CHAT, turnId: TURN_ID };

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

  it("a stop for an earlier turn does not hit the next turn", async () => {
    await requestChatStop({ ...TURN, turnId: "turn-0" });

    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });
    await requestChatStop({ ...TURN, turnId: "turn-0" });

    expect(onStop).not.toHaveBeenCalled();
  });

  it("two turns of one chat (two tabs) are stopped independently", async () => {
    const first = vi.fn();
    const second = vi.fn();
    watchChatStop({ ...TURN, turnId: "turn-a", onStop: first });
    watchChatStop({ ...TURN, turnId: "turn-b", onStop: second });

    await requestChatStop({ ...TURN, turnId: "turn-a" });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("a regenerate (same user message, new turn id) is not stopped by the previous turn's stop, even while that turn is still alive", async () => {
    // Turn 1 is stopped but still settling (a deferred tool, billing) when the
    // user regenerates or edits: both POSTs carry the same user message.
    const first = vi.fn();
    watchChatStop({ ...TURN, onStop: first });
    await requestChatStop(TURN);

    const regenerated = vi.fn();
    watchChatStop({ ...TURN, turnId: "turn-2", onStop: regenerated });

    expect(first).toHaveBeenCalledTimes(1);
    expect(regenerated).not.toHaveBeenCalled();

    // The second turn can still be stopped on its own.
    await requestChatStop({ ...TURN, turnId: "turn-2" });
    expect(regenerated).toHaveBeenCalledTimes(1);
  });

  it("a stop that arrives after its turn ended does not touch a later turn", async () => {
    const cleanup = watchChatStop({ ...TURN, onStop: vi.fn() });
    await cleanup();
    await requestChatStop(TURN);

    const next = vi.fn();
    watchChatStop({ ...TURN, turnId: "turn-2", onStop: next });

    expect(next).not.toHaveBeenCalled();
  });

  it("consumes the marker when it fires", async () => {
    // Stop lands before the watcher exists, the watcher fires and consumes it;
    // a second watcher on the same id (a legacy client re-sending the message
    // id) must not fire on the same marker.
    await requestChatStop(TURN);
    const first = vi.fn();
    watchChatStop({ ...TURN, onStop: first });
    const second = vi.fn();
    watchChatStop({ ...TURN, onStop: second });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });

  it("never lets one user stop another user's turn", async () => {
    const onStop = vi.fn();
    watchChatStop({ ...TURN, onStop });

    await requestChatStop({ ...TURN, userId: "user-2" });

    expect(onStop).not.toHaveBeenCalled();
  });

  it("consumes the marker when the turn ends, so a repeat of the id is not killed by it", async () => {
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

    await requestChatStop({ ...TURN, chatId: "other-chat" });

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
