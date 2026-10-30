import type { TurnAbort } from "./turn-abort";
import type { AbortedTurnStep, InFlightStepTracker } from "./usage";

/**
 * How a turn ended, as far as billing is concerned:
 *  - `completed`: the normal `onFinish` path billed it (media: the handler
 *    reached a terminal state with a result or a failure);
 *  - `aborted`: a text turn's stop path billed it (the persisted message is
 *    interrupted); a media turn's stop cut the provider call, so nothing was
 *    billed and no interrupted mark is added (the card shows as stopped);
 *  - `errored`: the stream failed without a stop; the finished steps were billed;
 *  - `skipped`: stopped before any model request was made; nothing was billed.
 */
export type TurnOutcome = "completed" | "aborted" | "errored" | "skipped";

/** Resolved once the turn is fully billed (or known not to be billed). */
export type TurnSettlement = {
  promise: Promise<void>;
  resolve: () => void;
};

export function createTurnSettlement(): TurnSettlement {
  const { promise, resolve } = Promise.withResolvers<void>();
  return { promise, resolve };
}

type AbortedBillingInput = {
  /** Steps that finished before the stop (a snapshot, safe to keep). */
  steps: AbortedTurnStep[];
  /** What the running step had generated when the stop landed. */
  inFlightOutputText: string;
  /**
   * The stop was released at the end of a step (a deferred stop): no further
   * step was running, so nothing beyond `steps` should be estimated.
   */
  atStepBoundary: boolean;
};

type ErroredBillingInput = {
  /** Steps that finished before the stream failed (a snapshot, safe to keep). */
  steps: AbortedTurnStep[];
};

/**
 * Tools whose cost lands in the turn's accumulator only when they return. A
 * forced abort would settle the turn before that, leaving the cost unbilled.
 */
const LATE_BILLED_TOOLS = ["generateImage"];

/** The part of `streamText`'s `totalUsage` the finish decision looks at. */
type FinishUsage = { inputTokens?: number; outputTokens?: number };

type TurnLifecycleOptions = {
  turnAbort: TurnAbort;
  tracker: InFlightStepTracker;
  settlement: TurnSettlement;
  /** Bill the stopped turn. Errors are caught and logged by the lifecycle. */
  billAborted: (input: AbortedBillingInput) => Promise<void>;
  /**
   * Bill a turn whose stream failed without a stop. Errors are caught and
   * logged by the lifecycle.
   */
  billErrored: (input: ErroredBillingInput) => Promise<void>;
  onOutcome: (outcome: TurnOutcome) => void;
};

/**
 * The state machine around one `streamText` call: which of the terminal paths
 * (normal finish, stop, stream error) bills the turn, exactly once, and when the
 * turn's settlement promise resolves.
 *
 * Wire `callbacks` into `streamText`, `onStreamError` into
 * `consumeStream({ onError })` and call `streamEnded` when consumption ends.
 */
export function createTurnLifecycle({
  turnAbort,
  tracker,
  settlement,
  billAborted,
  billErrored,
  onOutcome,
}: TurnLifecycleOptions) {
  // Our own record of finished steps. The SDK's `steps` array handed to
  // `onAbort` is live (a finish-step still in the pipe is pushed into it
  // later), and it is updated slightly after `onStepFinish` resets the tracker;
  // this one changes in the same tick as the tracker, so snapshots of both
  // always agree about which step is finished and which one is running.
  const finishedSteps: AbortedTurnStep[] = [];
  // Set by whichever of abort / error / normal completion bills the turn first.
  let settled = false;
  let pendingBilling: Promise<void> | undefined;
  // The abort was released by the end of a step, not in the middle of one.
  let atStepBoundary = false;
  // The stream reported an error while no stop was in effect.
  let streamErrored = false;

  // A deferred stop must not run while tool calls are in flight.
  turnAbort.setAbortGate(() => tracker.pendingToolCalls() === 0);
  turnAbort.setLongToolCheck(() =>
    LATE_BILLED_TOOLS.some((name) => tracker.hasPendingTool(name))
  );

  /** Claim the turn for `outcome` and bill it in the background, once. */
  const settleOnce = (
    outcome: "aborted" | "errored",
    bill: () => Promise<void>
  ) => {
    if (settled) {
      return;
    }
    settled = true;
    onOutcome(outcome);

    pendingBilling = (async () => {
      try {
        await bill();
      } catch (err) {
        console.warn(`[chat-turn] ${outcome} settlement failed`, err);
      } finally {
        settlement.resolve();
      }
    })();
  };

  const settleAborted = () => {
    // Snapshot synchronously and together, before any await.
    const input = {
      steps: [...finishedSteps],
      inFlightOutputText: tracker.outputText(),
      atStepBoundary,
    };
    settleOnce("aborted", () => billAborted(input));
  };

  // Only the finished steps: the step that failed is not estimated, the user
  // did not get it.
  const settleErrored = () => {
    const input = { steps: [...finishedSteps] };
    settleOnce("errored", () => billErrored(input));
  };

  // A deferral that timed out: the stream may be stuck behind a tool that never
  // returns and then never reports the abort, so settle the turn right here.
  turnAbort.onForcedAbort(settleAborted);

  return {
    /** Spread into `streamText({...})`. */
    callbacks: {
      // Must stay synchronous: a returned promise pauses the stream.
      onChunk: ({
        chunk,
      }: {
        chunk: Parameters<typeof tracker.onChunk>[0];
      }) => {
        tracker.onChunk(chunk);
      },
      onStepFinish: (step: AbortedTurnStep) => {
        finishedSteps.push(step);
        tracker.reset();
        // A deferred stop is released only here, never on a tool result: the
        // step then ends with its real usage recorded (aborting on the result
        // would drop the finish-step and force an estimate), and a tool error,
        // which `onChunk` never reports, is covered the same way.
        const wasAborted = turnAbort.signal.aborted;
        turnAbort.flush();
        atStepBoundary = !wasAborted && turnAbort.signal.aborted;
      },
      onAbort: () => settleAborted(),
    },

    /** Bill the turn through the stop path (idempotent). */
    settleAborted,

    /**
     * Wire into `streamText({ onError })` and `consumeStream({ onError })`.
     * When the user had stopped the turn, the error is an abort that reached
     * the stream as a plain error: bill it as stopped. Otherwise the turn is
     * billed as errored when the stream ends, unless `onFinish` billed it
     * first: an error part does not always end the turn, and `onFinish` always
     * completes before the stream ends.
     */
    onStreamError: () => {
      if (turnAbort.signal.aborted) {
        settleAborted();
        return;
      }
      streamErrored = true;
    },

    /**
     * `streamText`'s `onFinish` decision. A stop after at least one finished
     * step still ends up in `onFinish`, with empty total usage: that is billed
     * through the stop path. A turn that completed before the stop landed has
     * real usage and is charged normally. Returns true when the caller must
     * bill the turn normally (and then call `completed`); false when the stop
     * path handled it, or already billed it.
     */
    beginFinish: (totalUsage: FinishUsage): boolean => {
      const hasTotalUsage =
        totalUsage.inputTokens !== undefined ||
        totalUsage.outputTokens !== undefined;
      if (turnAbort.signal.aborted && !hasTotalUsage) {
        settleAborted();
        return false;
      }
      if (settled) {
        return false;
      }
      settled = true;
      return true;
    },

    /** Normal path: the turn has been charged (or the charge failed). */
    completed: () => {
      onOutcome("completed");
      settlement.resolve();
    },

    /**
     * The text stream finished consuming: no terminal path is left to run. A
     * stream that failed without reaching `onFinish` or `onAbort` is billed
     * here for its finished steps.
     */
    streamEnded: async () => {
      if (streamErrored) {
        settleErrored();
      }
      await pendingBilling;
      settlement.resolve();
    },

    /** The handler failed before or outside the stream. */
    failed: () => {
      settlement.resolve();
    },
  };
}

/**
 * End `stream` when the stop is forced. A hung tool keeps `streamText` from
 * ever closing its stream (it cannot even report the abort), and with it the
 * UI stream whose `onFinish` persists the message. Closing the UI stream here
 * lets the partial message be saved while the tool is left behind.
 */
export function closeStreamOnForcedAbort<T>(
  stream: ReadableStream<T>,
  turnAbort: TurnAbort
): ReadableStream<T> {
  const reader = stream.getReader();
  let closed = false;

  return new ReadableStream<T>({
    start(controller) {
      turnAbort.onForcedAbort(() => {
        if (closed) {
          return;
        }
        closed = true;
        reader.cancel().catch(() => {
          // The source is abandoned either way.
        });
        controller.close();
      });
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (closed) {
          return;
        }
        if (done) {
          closed = true;
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        if (!closed) {
          closed = true;
          controller.error(error);
        }
      }
    },
    cancel(reason) {
      closed = true;
      return reader.cancel(reason);
    },
  });
}

/**
 * Wait for `promise`, but never longer than `timeoutMs`. Resolves true when the
 * promise settled first, false on timeout.
 */
export async function waitWithTimeout(
  promise: Promise<unknown>,
  timeoutMs: number
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  try {
    return await Promise.race([promise.then(() => true), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * How long persisting may wait for a media handler: until shortly before the
 * function is killed. A cancelled response is already gone and the function is
 * kept alive for the handler anyway, so waiting longer only makes the saved
 * card reflect what the handler really did (it can't be corrected afterwards).
 */
export function mediaPersistWaitMs({
  startedAt,
  maxDurationMs,
  marginMs,
  now,
}: {
  startedAt: number;
  maxDurationMs: number;
  /** Time kept before the deadline for the persist itself. */
  marginMs: number;
  now: number;
}): number {
  return Math.max(0, startedAt + maxDurationMs - marginMs - now);
}

/**
 * Wait for a turn's settlement, but never longer than `timeoutMs`: persisting
 * the message (and finishing the request) matters more than a slow charge.
 * Resolves false on timeout.
 */
export function waitForSettlement(
  settlement: TurnSettlement,
  timeoutMs: number
): Promise<boolean> {
  return waitWithTimeout(settlement.promise, timeoutMs);
}

type IsTurnAbortedInput = {
  isTextTurn: boolean;
  /** The UI stream itself ended aborted (`createUIMessageStream`'s `isAborted`). */
  isStreamAborted: boolean;
  turnOutcome: TurnOutcome | undefined;
  /** The turn's settlement finished within the wait (text turns only). */
  isSettled: boolean;
  /** A user stop was requested for the turn. */
  hasStopRequest: boolean;
};

/**
 * Whether the persisted turn counts as stopped by the user.
 *
 * Text: interrupted only if the stop path actually settled the turn (or the
 * stream itself ended aborted). A stop that lands after the answer was
 * complete leaves it a normal message. If billing is still running after the
 * wait (a deferred stop outlasting it), a requested stop means the message is
 * cut off all the same.
 *
 * Media: the handler reports its own outcome; `completed` (a result or a
 * failure was delivered) wins over a stop that arrived later. A requested stop
 * with no completed outcome means the handler never got to finish (e.g. it
 * threw), so the turn counts as stopped.
 */
export function isTurnAborted({
  isTextTurn,
  isStreamAborted,
  turnOutcome,
  isSettled,
  hasStopRequest,
}: IsTurnAbortedInput): boolean {
  if (isTextTurn) {
    return (
      isStreamAborted ||
      turnOutcome === "aborted" ||
      (!isSettled && hasStopRequest)
    );
  }
  return (
    turnOutcome === "aborted" || (hasStopRequest && turnOutcome !== "completed")
  );
}
