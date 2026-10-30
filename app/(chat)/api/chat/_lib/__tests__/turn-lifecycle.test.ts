import type {
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from "@ai-sdk/provider";
import { streamText, tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createTurnAbort } from "../turn-abort";
import {
  createTurnLifecycle,
  createTurnSettlement,
  type TurnOutcome,
  waitForSettlement,
} from "../turn-lifecycle";
import { createInFlightStepTracker } from "../usage";

const USAGE: LanguageModelV3Usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

const toolCallsFinish: LanguageModelV3StreamPart = {
  type: "finish",
  finishReason: { unified: "tool-calls", raw: "tool_calls" },
  usage: USAGE,
};
const stopFinish: LanguageModelV3StreamPart = {
  type: "finish",
  finishReason: { unified: "stop", raw: "stop" },
  usage: USAGE,
};

/** Poll until the condition holds (no assertions, usable outside `it`). */
const until = (condition: () => boolean) =>
  vi.waitFor(() => {
    if (!condition()) {
      throw new Error("condition not met yet");
    }
  });

/**
 * A model whose stream the test drives by hand. Like a real fetch body, the
 * stream errors with `signal.reason` as soon as the request is aborted.
 */
function createControlledModel() {
  const controllers: ReadableStreamDefaultController<LanguageModelV3StreamPart>[] =
    [];
  const model = new MockLanguageModelV3({
    doStream: ({ abortSignal }) => {
      const stream = new ReadableStream<LanguageModelV3StreamPart>({
        start(controller) {
          controllers.push(controller);
          controller.enqueue({ type: "stream-start", warnings: [] });
          abortSignal?.addEventListener("abort", () => {
            try {
              controller.error(abortSignal.reason);
            } catch {
              // already closed
            }
          });
        },
      });
      return Promise.resolve({ stream });
    },
  });
  /** Feed the newest model stream; a `finish` part also closes it. */
  const push = async (...parts: LanguageModelV3StreamPart[]) => {
    await until(() => controllers.length > 0);
    const controller = controllers.at(-1);
    for (const part of parts) {
      controller?.enqueue(part);
      if (part.type === "finish") {
        controller?.close();
      }
    }
  };
  return { model, push, calls: () => controllers.length };
}

const textStart = (): LanguageModelV3StreamPart => ({
  type: "text-start",
  id: "1",
});
const textDelta = (delta: string): LanguageModelV3StreamPart => ({
  type: "text-delta",
  id: "1",
  delta,
});

type BillAborted = Parameters<typeof createTurnLifecycle>[0]["billAborted"];

type Harness = ReturnType<typeof setup>;

/** Wire the lifecycle into a real `streamText` exactly as text-chat.ts does. */
function setup({
  tools,
  abortControl,
}: {
  tools?: Parameters<typeof streamText>[0]["tools"];
  /** Replace the turn abort (e.g. to abort with a non-AbortError reason). */
  abortControl?: ReturnType<typeof createTurnAbort>;
} = {}) {
  const { model, push, calls } = createControlledModel();
  const turnAbort = abortControl ?? createTurnAbort();
  const tracker = createInFlightStepTracker();
  const settlement = createTurnSettlement();
  const outcomes: TurnOutcome[] = [];
  const billAborted = vi.fn<BillAborted>(() => Promise.resolve());
  const billCompleted = vi.fn();

  const lifecycle = createTurnLifecycle({
    turnAbort,
    tracker,
    settlement,
    billAborted,
    onOutcome: (outcome) => outcomes.push(outcome),
  });

  const result = streamText({
    model,
    prompt: "hi",
    tools,
    abortSignal: turnAbort.signal,
    ...lifecycle.callbacks,
    onError: () => lifecycle.onStreamError(),
    onFinish: ({ totalUsage }) => {
      const hasUsage = totalUsage.inputTokens !== undefined;
      if (turnAbort.signal.aborted && !hasUsage) {
        lifecycle.settleAborted();
        return;
      }
      if (!lifecycle.claimCompletion()) {
        return;
      }
      billCompleted();
      lifecycle.completed();
    },
  });

  const consumed = Promise.resolve(
    result.consumeStream({ onError: () => lifecycle.onStreamError() })
  ).finally(() => lifecycle.streamEnded());

  const partTypes: string[] = [];
  const drained = (async () => {
    try {
      for await (const part of result.fullStream) {
        partTypes.push(part.type);
      }
    } catch (error) {
      partTypes.push(`throw:${String(error)}`);
    }
  })();

  return {
    push,
    calls,
    turnAbort,
    tracker,
    settlement,
    outcomes,
    billAborted,
    billCompleted,
    lifecycle,
    partTypes,
    finished: () => Promise.all([consumed, drained, settlement.promise]),
  };
}

const waitForOutput = (h: Harness, text: string) =>
  until(() => h.tracker.outputText() === text);

afterEach(() => {
  vi.useRealTimers();
});

describe("turn lifecycle with a real streamText", () => {
  it("a stop mid-stream settles the turn exactly once and charges", async () => {
    const h = setup();
    await h.push(textStart(), textDelta("Hello"), textDelta(" wor"));
    await waitForOutput(h, "Hello wor");

    h.turnAbort.requestAbort();
    await h.finished();

    expect(h.billAborted).toHaveBeenCalledTimes(1);
    expect(h.billAborted).toHaveBeenCalledWith({
      steps: [],
      inFlightOutputText: "Hello wor",
    });
    expect(h.billCompleted).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(["aborted"]);
    expect(h.partTypes.at(-1)).toBe("abort");
    expect(h.turnAbort.requestedAt).toBeInstanceOf(Date);
  });

  it("aborts with an AbortError, which streamText treats as an abort", () => {
    const turnAbort = createTurnAbort();
    turnAbort.requestAbort();

    expect(turnAbort.signal.aborted).toBe(true);
    expect(turnAbort.signal.reason).toBeInstanceOf(DOMException);
    expect(turnAbort.signal.reason.name).toBe("AbortError");
  });

  it("safety net: a stream that errors with a non-AbortError reason is still settled once", async () => {
    // Reproduces the original bug: a string abort reason makes the body reader
    // reject with that string, streamText errors the stream instead of
    // aborting and never calls onAbort / onFinish.
    const controller = new AbortController();
    const abortControl = {
      ...createTurnAbort(),
      signal: controller.signal,
    };
    const h = setup({ abortControl });
    await h.push(textStart(), textDelta("partial"));
    await waitForOutput(h, "partial");

    controller.abort("user-stop");
    await h.finished();

    expect(h.partTypes.at(-1)).toBe("throw:user-stop");
    expect(h.billAborted).toHaveBeenCalledTimes(1);
    expect(h.billAborted).toHaveBeenCalledWith({
      steps: [],
      inFlightOutputText: "partial",
    });
    expect(h.outcomes).toEqual(["aborted"]);
  });

  it("settles once even when the abort and error paths both fire", async () => {
    const h = setup();
    await h.push(textStart(), textDelta("x"));
    await waitForOutput(h, "x");

    h.turnAbort.requestAbort();
    h.lifecycle.onStreamError();
    h.lifecycle.settleAborted();
    await h.finished();

    expect(h.billAborted).toHaveBeenCalledTimes(1);
  });

  it("a normal finish is billed by the completion path and resolves the settlement", async () => {
    const h = setup();
    await h.push(textStart(), textDelta("Done"), stopFinish);
    // The stream must be closed for the turn to end.
    await vi.waitFor(() => expect(h.billCompleted).toHaveBeenCalledTimes(1));
    await h.finished();

    expect(h.billAborted).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(["completed"]);
  });

  it("a stream that errors without a stop resolves the settlement and bills nothing", async () => {
    const h = setup();
    await h.push(textStart(), textDelta("x"), {
      type: "error",
      error: new Error("provider down"),
    });
    await h.push(stopFinish);
    await h.finished();

    expect(h.billAborted).not.toHaveBeenCalled();
    expect(h.turnAbort.signal.aborted).toBe(false);
  });

  it("defers a stop until the running tool call returns, then aborts without losing its result", async () => {
    let release: (value: { ok: true }) => void = vi.fn();
    const slow = tool({
      description: "slow tool",
      inputSchema: z.object({}),
      execute: () =>
        new Promise<{ ok: true }>((resolve) => {
          release = resolve;
        }),
    });
    const h = setup({ tools: { slow } });
    await h.push(
      textStart(),
      textDelta("Drawing"),
      {
        type: "tool-call",
        toolCallId: "t1",
        toolName: "slow",
        input: "{}",
      },
      toolCallsFinish
    );
    await vi.waitFor(() => expect(h.tracker.pendingToolCalls()).toBe(1));

    h.turnAbort.requestAbort();

    expect(h.turnAbort.signal.aborted).toBe(false);
    expect(h.billAborted).not.toHaveBeenCalled();

    release({ ok: true });
    await h.finished();

    expect(h.turnAbort.signal.aborted).toBe(true);
    expect(h.partTypes).toContain("tool-result");
    expect(h.partTypes.indexOf("tool-result")).toBeLessThan(
      h.partTypes.indexOf("abort")
    );
    expect(h.billAborted).toHaveBeenCalledTimes(1);
    expect(h.billAborted.mock.calls[0]?.[0].inFlightOutputText).toContain(
      "Drawing"
    );
  });

  it("with parallel tool calls the stop waits for the last one", async () => {
    const releases: Array<() => void> = [];
    const parallel = tool({
      description: "parallel tool",
      inputSchema: z.object({}),
      execute: () =>
        new Promise<string>((resolve) => {
          releases.push(() => resolve("done"));
        }),
    });
    const h = setup({ tools: { parallel } });
    await h.push(
      textStart(),
      textDelta("Two"),
      { type: "tool-call", toolCallId: "a", toolName: "parallel", input: "{}" },
      { type: "tool-call", toolCallId: "b", toolName: "parallel", input: "{}" },
      toolCallsFinish
    );
    await vi.waitFor(() => expect(releases).toHaveLength(2));
    h.turnAbort.requestAbort();

    releases[0]?.();
    await vi.waitFor(() => expect(h.tracker.pendingToolCalls()).toBe(1));
    expect(h.turnAbort.signal.aborted).toBe(false);

    releases[1]?.();
    await h.finished();

    expect(h.turnAbort.signal.aborted).toBe(true);
    expect(h.partTypes.filter((type) => type === "tool-result")).toHaveLength(
      2
    );
    expect(h.billAborted).toHaveBeenCalledTimes(1);
  });

  it("a failing tool does not block a deferred stop: the end of the step opens the gate", async () => {
    let fail: () => void = vi.fn();
    const broken = tool({
      description: "broken tool",
      inputSchema: z.object({}),
      execute: () =>
        new Promise<string>((_, reject) => {
          fail = () => reject(new Error("tool failed"));
        }),
    });
    const h = setup({ tools: { broken } });
    await h.push(
      textStart(),
      textDelta("Trying"),
      { type: "tool-call", toolCallId: "e", toolName: "broken", input: "{}" },
      toolCallsFinish
    );
    await vi.waitFor(() => expect(h.tracker.pendingToolCalls()).toBe(1));
    h.turnAbort.requestAbort();
    expect(h.turnAbort.signal.aborted).toBe(false);

    // The tool-error is invisible to onChunk, so the call stays pending until
    // the step finishes.
    fail();
    await h.finished();

    expect(h.turnAbort.signal.aborted).toBe(true);
    expect(h.billAborted).toHaveBeenCalledTimes(1);
  });
});

describe("turn lifecycle callbacks", () => {
  const step = (inputTokens: number) => ({
    usage: { inputTokens, outputTokens: 1, totalTokens: inputTokens + 1 },
  });

  const build = () => {
    const tracker = createInFlightStepTracker();
    const billAborted = vi.fn(() => Promise.resolve());
    const settlement = createTurnSettlement();
    const lifecycle = createTurnLifecycle({
      turnAbort: createTurnAbort(),
      tracker,
      settlement,
      billAborted,
      onOutcome: vi.fn(),
    });
    return { tracker, billAborted, settlement, lifecycle };
  };

  it("snapshots finished steps and in-flight text together, immune to later pushes", () => {
    const { lifecycle, tracker, billAborted } = build();
    // The lifecycle keeps its own record of finished steps instead of reading
    // the SDK's live `steps` array (a finish-step still in the pipe is pushed
    // into that one after the abort).
    lifecycle.callbacks.onStepFinish(step(1) as never);
    tracker.onChunk({ type: "text-delta", text: "second step" });
    lifecycle.callbacks.onAbort();
    // Another step finishing after the abort must not leak into the bill.
    lifecycle.callbacks.onStepFinish(step(2) as never);
    tracker.reset();

    expect(billAborted).toHaveBeenCalledTimes(1);
    expect(billAborted).toHaveBeenCalledWith({
      steps: [step(1)],
      inFlightOutputText: "second step",
    });
  });

  it("claimCompletion is refused after the stop path settled", () => {
    const { lifecycle } = build();

    lifecycle.settleAborted();

    expect(lifecycle.claimCompletion()).toBe(false);
  });

  it("the stop path is refused after the completion path claimed the turn", () => {
    const { lifecycle, billAborted } = build();

    expect(lifecycle.claimCompletion()).toBe(true);
    lifecycle.settleAborted();

    expect(billAborted).not.toHaveBeenCalled();
  });

  it("resolves the settlement even when billing throws", async () => {
    vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const tracker = createInFlightStepTracker();
    const settlement = createTurnSettlement();
    const lifecycle = createTurnLifecycle({
      turnAbort: createTurnAbort(),
      tracker,
      settlement,
      billAborted: () => Promise.reject(new Error("db down")),
      onOutcome: vi.fn(),
    });

    lifecycle.settleAborted();

    await expect(settlement.promise).resolves.toBeUndefined();
  });

  it("failed() resolves the settlement for a handler that threw", async () => {
    const { lifecycle, settlement } = build();

    lifecycle.failed();

    await expect(settlement.promise).resolves.toBeUndefined();
  });
});

describe("turn abort", () => {
  it("aborts immediately when no gate is closed, once", () => {
    const turnAbort = createTurnAbort();

    turnAbort.requestAbort();
    turnAbort.requestAbort();

    expect(turnAbort.signal.aborted).toBe(true);
  });

  it("holds the abort while the gate is closed and releases it on flush", () => {
    const turnAbort = createTurnAbort();
    let open = false;
    turnAbort.setAbortGate(() => open);

    turnAbort.requestAbort();
    turnAbort.flush();
    expect(turnAbort.signal.aborted).toBe(false);
    expect(turnAbort.requestedAt).toBeInstanceOf(Date);

    open = true;
    turnAbort.flush();
    expect(turnAbort.signal.aborted).toBe(true);
  });

  it("flush without a requested stop does nothing", () => {
    const turnAbort = createTurnAbort();

    turnAbort.flush();

    expect(turnAbort.signal.aborted).toBe(false);
    expect(turnAbort.requestedAt).toBeUndefined();
  });
});

describe("waitForSettlement", () => {
  it("returns when the settlement resolves", async () => {
    const settlement = createTurnSettlement();
    const waiting = waitForSettlement(settlement, 15_000);

    settlement.resolve();

    await expect(waiting).resolves.toBeUndefined();
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    const settlement = createTurnSettlement();
    let done = false;
    const waiting = waitForSettlement(settlement, 15_000).then(() => {
      done = true;
    });

    await vi.advanceTimersByTimeAsync(14_999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await waiting;

    expect(done).toBe(true);
  });
});
