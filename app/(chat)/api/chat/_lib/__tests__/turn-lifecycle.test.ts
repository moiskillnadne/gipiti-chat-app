import type {
  LanguageModelV3StreamPart,
  LanguageModelV3Usage,
} from "@ai-sdk/provider";
import { stepCountIs, streamText, tool } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  createTurnAbort,
  DEADLINE_MARGIN_MS,
  DEFERRAL_CAP_MS,
  type TurnAbortOptions,
} from "../turn-abort";
import {
  closeStreamOnForcedAbort,
  createTurnLifecycle,
  createTurnSettlement,
  type TurnOutcome,
  waitForSettlement,
} from "../turn-lifecycle";
import {
  computeAbortedTurnUsage,
  createInFlightStepTracker,
  usageChargeUsd,
} from "../usage";

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
      // A real fetch on an already aborted signal rejects at once.
      if (abortSignal?.aborted) {
        return Promise.reject(abortSignal.reason);
      }
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
  abortOptions,
  bill,
}: {
  tools?: Parameters<typeof streamText>[0]["tools"];
  /** Replace the turn abort (e.g. to abort with a non-AbortError reason). */
  abortControl?: ReturnType<typeof createTurnAbort>;
  abortOptions?: TurnAbortOptions;
  /** What billing does with the stopped turn (default: nothing). */
  bill?: BillAborted;
} = {}) {
  const { model, push, calls } = createControlledModel();
  const turnAbort = abortControl ?? createTurnAbort(abortOptions);
  const tracker = createInFlightStepTracker();
  const settlement = createTurnSettlement();
  const outcomes: TurnOutcome[] = [];
  const billAborted = vi.fn<BillAborted>(bill ?? (() => Promise.resolve()));
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
    stopWhen: stepCountIs(5),
    abortSignal: turnAbort.signal,
    ...lifecycle.callbacks,
    onError: () => lifecycle.onStreamError(),
    // Same decision as text-chat.ts: it lives in the lifecycle.
    onFinish: ({ totalUsage }) => {
      if (!lifecycle.beginFinish(totalUsage)) {
        return;
      }
      billCompleted();
      lifecycle.completed();
    },
  });

  // The UI stream the route persists from, closed on a forced abort.
  const uiParts: string[] = [];
  const uiDone = (async () => {
    const reader = closeStreamOnForcedAbort(
      result.toUIMessageStream(),
      turnAbort
    ).getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          return;
        }
        uiParts.push(value.type);
      }
    } catch (error) {
      uiParts.push(`throw:${String(error)}`);
    }
  })();

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
    uiParts,
    uiDone,
    finished: () =>
      Promise.all([consumed, drained, uiDone, settlement.promise]),
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
      atStepBoundary: false,
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
      atStepBoundary: false,
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
    // Released at the end of the step: the step is finished and recorded
    // (real usage), nothing is left running.
    const billed = h.billAborted.mock.calls[0]?.[0];
    expect(billed?.steps).toHaveLength(1);
    expect(billed?.inFlightOutputText).toBe("");
    expect(billed?.atStepBoundary).toBe(true);
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
    expect(h.billAborted.mock.calls[0]?.[0].atStepBoundary).toBe(true);
  });

  it("a stop in the middle of step 2 settles through the finish path with the finished step", async () => {
    const quick = tool({
      description: "quick tool",
      inputSchema: z.object({}),
      execute: () => Promise.resolve("ok"),
    });
    const h = setup({ tools: { quick } });
    await h.push(
      { type: "tool-call", toolCallId: "q", toolName: "quick", input: "{}" },
      toolCallsFinish
    );
    // Step 2 starts and streams some text.
    await until(() => h.calls() === 2);
    await h.push(textStart(), textDelta("Part"));
    await waitForOutput(h, "Part");

    h.turnAbort.requestAbort();
    await h.finished();

    expect(h.billAborted).toHaveBeenCalledTimes(1);
    const billed = h.billAborted.mock.calls[0]?.[0];
    expect(billed?.steps).toHaveLength(1);
    expect(billed?.inFlightOutputText).toBe("Part");
    expect(billed?.atStepBoundary).toBe(false);
    expect(h.billCompleted).not.toHaveBeenCalled();
    expect(h.outcomes).toEqual(["aborted"]);
  });
});

describe("billing of a deferred stop", () => {
  const STEP_COST_USD = 0.5;
  const IMAGE_COST_USD = 0.25;
  const stepFinish: LanguageModelV3StreamPart = {
    ...toolCallsFinish,
    providerMetadata: { gateway: { cost: String(STEP_COST_USD) } },
  };
  const accumulator = () => ({
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCost: 0,
    generationCount: 0,
  });

  /** Billing exactly as text-chat.ts does it, minus the DB. */
  const realBilling = (
    imageUsage: ReturnType<typeof accumulator>,
    sink: { usage?: ReturnType<typeof computeAbortedTurnUsage> }
  ): BillAborted => {
    return (input) => {
      sink.usage = computeAbortedTurnUsage({
        ...input,
        promptText: "x".repeat(4000),
        accumulator: imageUsage,
        modelId: "openai/gpt-4o",
        catalog: undefined,
      });
      return Promise.resolve();
    };
  };

  it("tool succeeds: the step's real usage and cost are billed, not an estimate", async () => {
    const imageUsage = accumulator();
    const sink: { usage?: ReturnType<typeof computeAbortedTurnUsage> } = {};
    let release: (value: string) => void = vi.fn();
    const slow = tool({
      description: "slow tool",
      inputSchema: z.object({}),
      execute: () =>
        new Promise<string>((resolve) => {
          release = (value) => {
            imageUsage.totalCost += IMAGE_COST_USD;
            resolve(value);
          };
        }),
    });
    const h = setup({
      tools: { slow },
      bill: realBilling(imageUsage, sink),
    });
    await h.push(
      textStart(),
      textDelta("Drawing"),
      { type: "tool-call", toolCallId: "t", toolName: "slow", input: "{}" },
      stepFinish
    );
    await until(() => h.tracker.pendingToolCalls() === 1);
    h.turnAbort.requestAbort();
    release("done");
    await h.finished();

    const billed = h.billAborted.mock.calls[0]?.[0];
    expect(billed?.atStepBoundary).toBe(true);
    // The step finished with its real usage (the finish-step is not dropped).
    expect(billed?.steps).toHaveLength(1);
    expect(sink.usage?.inputTokens).toBe(10);
    expect(sink.usage?.outputTokens).toBe(5);
    expect(usageChargeUsd(sink.usage as never)).toBeCloseTo(
      STEP_COST_USD + IMAGE_COST_USD
    );
    // The tool result reached the UI before the abort.
    expect(h.uiParts).toContain("tool-output-available");
  });

  it("tool fails: only the finished step is billed, no phantom next step", async () => {
    const imageUsage = accumulator();
    const sink: { usage?: ReturnType<typeof computeAbortedTurnUsage> } = {};
    let fail: () => void = vi.fn();
    const broken = tool({
      description: "broken tool",
      inputSchema: z.object({}),
      execute: () =>
        new Promise<string>((_, reject) => {
          fail = () => reject(new Error("tool failed"));
        }),
    });
    const h = setup({
      tools: { broken },
      bill: realBilling(imageUsage, sink),
    });
    await h.push(
      textStart(),
      textDelta("Trying"),
      { type: "tool-call", toolCallId: "t", toolName: "broken", input: "{}" },
      stepFinish
    );
    await until(() => h.tracker.pendingToolCalls() === 1);
    h.turnAbort.requestAbort();
    fail();
    await h.finished();

    expect(h.billAborted.mock.calls[0]?.[0].atStepBoundary).toBe(true);
    // Exactly the finished step: nothing is estimated for a request that
    // never left the server (the prompt alone would be ~1000 tokens).
    expect(sink.usage?.inputTokens).toBe(10);
    expect(sink.usage?.outputTokens).toBe(5);
    expect(usageChargeUsd(sink.usage as never)).toBeCloseTo(STEP_COST_USD);
  });

  it("a stop in the middle of a step still estimates the running step", async () => {
    const imageUsage = accumulator();
    const sink: { usage?: ReturnType<typeof computeAbortedTurnUsage> } = {};
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const h = setup({ bill: realBilling(imageUsage, sink) });
    await h.push(textStart(), textDelta("a".repeat(400)));
    await waitForOutput(h, "a".repeat(400));
    h.turnAbort.requestAbort();
    await h.finished();

    expect(h.billAborted.mock.calls[0]?.[0].atStepBoundary).toBe(false);
    // Prompt (4000 chars) + 400 chars of output, estimated (it is unpriced
    // here: no catalog, so the estimate shows up in the alarm only).
    expect(warn).toHaveBeenCalledWith(
      "[ALARM-USAGE] aborted step unpriced",
      expect.objectContaining({
        runningInputTokens: 1000,
        runningOutputTokens: 100,
      })
    );
  });
});

describe("forced abort of a hung tool", () => {
  it("settles the turn, bills it and closes the UI stream after the cap", async () => {
    const hung = tool({
      description: "hung tool",
      inputSchema: z.object({}),
      execute: () => new Promise<string>(vi.fn()),
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(vi.fn());
    const h = setup({ tools: { hung } });
    await h.push(
      textStart(),
      textDelta("Working"),
      { type: "tool-call", toolCallId: "h", toolName: "hung", input: "{}" },
      toolCallsFinish
    );
    await until(() => h.tracker.pendingToolCalls() === 1);

    vi.useFakeTimers();
    h.turnAbort.requestAbort();
    await vi.advanceTimersByTimeAsync(DEFERRAL_CAP_MS - 1);
    expect(h.turnAbort.signal.aborted).toBe(false);
    expect(h.billAborted).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2);
    vi.useRealTimers();
    await Promise.all([h.settlement.promise, h.uiDone]);

    expect(h.turnAbort.signal.aborted).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      "[chat-stop] forced abort, tool still running"
    );
    expect(h.billAborted).toHaveBeenCalledTimes(1);
    expect(h.billAborted.mock.calls[0]?.[0].inFlightOutputText).toContain(
      "Working"
    );
    expect(h.outcomes).toEqual(["aborted"]);
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
      atStepBoundary: false,
    });
  });

  it("normal billing is refused after the stop path settled", () => {
    const { lifecycle } = build();

    lifecycle.settleAborted();

    expect(lifecycle.beginFinish({ inputTokens: 10, outputTokens: 5 })).toBe(
      false
    );
  });

  it("the stop path is refused after normal billing claimed the turn", () => {
    const { lifecycle, billAborted } = build();

    expect(lifecycle.beginFinish({ inputTokens: 10, outputTokens: 5 })).toBe(
      true
    );
    lifecycle.settleAborted();

    expect(billAborted).not.toHaveBeenCalled();
  });

  describe("beginFinish after a stop", () => {
    const stopped = () => {
      const tracker = createInFlightStepTracker();
      const turnAbort = createTurnAbort();
      const billAborted = vi.fn(() => Promise.resolve());
      const lifecycle = createTurnLifecycle({
        turnAbort,
        tracker,
        settlement: createTurnSettlement(),
        billAborted,
        onOutcome: vi.fn(),
      });
      turnAbort.requestAbort();
      return { lifecycle, billAborted };
    };

    it("empty usage means the stop path bills the turn", () => {
      const { lifecycle, billAborted } = stopped();

      expect(lifecycle.beginFinish({})).toBe(false);
      expect(billAborted).toHaveBeenCalledTimes(1);
    });

    it("output tokens alone are real usage: the turn finished, bill it normally", () => {
      const { lifecycle, billAborted } = stopped();

      expect(lifecycle.beginFinish({ outputTokens: 7 })).toBe(true);
      expect(billAborted).not.toHaveBeenCalled();
    });

    it("input tokens alone are real usage too", () => {
      const { lifecycle, billAborted } = stopped();

      expect(lifecycle.beginFinish({ inputTokens: 7 })).toBe(true);
      expect(billAborted).not.toHaveBeenCalled();
    });
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

  describe("deferral cap", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const closedGate = (options?: TurnAbortOptions) => {
      const turnAbort = createTurnAbort(options);
      turnAbort.setAbortGate(() => false);
      const forced = vi.fn();
      turnAbort.onForcedAbort(forced);
      vi.spyOn(console, "warn").mockImplementation(vi.fn());
      return { turnAbort, forced };
    };

    it("force-aborts DEFERRAL_CAP_MS after the stop request", () => {
      vi.useFakeTimers();
      const { turnAbort, forced } = closedGate({ startedAt: Date.now() });

      turnAbort.requestAbort();
      vi.advanceTimersByTime(DEFERRAL_CAP_MS - 1);
      expect(turnAbort.signal.aborted).toBe(false);
      vi.advanceTimersByTime(1);

      expect(turnAbort.signal.aborted).toBe(true);
      expect(forced).toHaveBeenCalledTimes(1);
    });

    it("never lands later than DEADLINE_MARGIN_MS before maxDuration", () => {
      vi.useFakeTimers();
      const startedAt = Date.now();
      const maxDurationMs = 300_000;
      // The turn has run for 240s: the deadline (270s) comes before the cap.
      vi.advanceTimersByTime(240_000);
      const { turnAbort } = closedGate({ startedAt, maxDurationMs });

      turnAbort.requestAbort();
      vi.advanceTimersByTime(maxDurationMs - DEADLINE_MARGIN_MS - 240_000);

      expect(turnAbort.signal.aborted).toBe(true);
    });

    it("forces at once when the deadline has already passed", () => {
      vi.useFakeTimers();
      const startedAt = Date.now();
      vi.advanceTimersByTime(280_000);
      const { turnAbort } = closedGate({ startedAt, maxDurationMs: 300_000 });

      turnAbort.requestAbort();
      vi.advanceTimersByTime(0);

      expect(turnAbort.signal.aborted).toBe(true);
    });

    it("does not force once the gate opened and the abort ran", () => {
      vi.useFakeTimers();
      const turnAbort = createTurnAbort();
      let open = false;
      turnAbort.setAbortGate(() => open);
      const forced = vi.fn();
      turnAbort.onForcedAbort(forced);

      turnAbort.requestAbort();
      open = true;
      turnAbort.flush();
      vi.advanceTimersByTime(DEFERRAL_CAP_MS * 2);

      expect(turnAbort.signal.aborted).toBe(true);
      expect(forced).not.toHaveBeenCalled();
    });

    it("dispose cancels the timer", () => {
      vi.useFakeTimers();
      const { turnAbort, forced } = closedGate();

      turnAbort.requestAbort();
      turnAbort.dispose();
      vi.advanceTimersByTime(DEFERRAL_CAP_MS * 2);

      expect(turnAbort.signal.aborted).toBe(false);
      expect(forced).not.toHaveBeenCalled();
    });

    it("no timer when the abort is not deferred", () => {
      vi.useFakeTimers();
      const turnAbort = createTurnAbort();

      turnAbort.requestAbort();

      expect(vi.getTimerCount()).toBe(0);
    });
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

    await expect(waiting).resolves.toBe(true);
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    const settlement = createTurnSettlement();
    let result: boolean | undefined;
    const waiting = waitForSettlement(settlement, 15_000).then((settled) => {
      result = settled;
    });

    await vi.advanceTimersByTimeAsync(14_999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(2);
    await waiting;

    // Timed out: the caller learns billing is still running.
    expect(result).toBe(false);
  });
});
