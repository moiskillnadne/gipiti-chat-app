import type { TurnAbort } from "./turn-abort";
import type { AbortedTurnStep, InFlightStepTracker } from "./usage";

/**
 * How a text turn ended, as far as billing is concerned:
 *  - `completed`: the normal `onFinish` path billed it;
 *  - `aborted`: the stop path billed it (the persisted message is interrupted);
 *  - `skipped`: stopped before any model request was made; nothing was billed.
 */
export type TurnOutcome = "completed" | "aborted" | "skipped";

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
};

type TurnLifecycleOptions = {
  turnAbort: TurnAbort;
  tracker: InFlightStepTracker;
  settlement: TurnSettlement;
  /** Bill the stopped turn. Errors are caught and logged by the lifecycle. */
  billAborted: (input: AbortedBillingInput) => Promise<void>;
  onOutcome: (outcome: TurnOutcome) => void;
};

/**
 * The state machine around one `streamText` call: which of the terminal paths
 * (normal finish, stop, error) bills the turn, exactly once, and when the
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
  onOutcome,
}: TurnLifecycleOptions) {
  // Our own record of finished steps. The SDK's `steps` array handed to
  // `onAbort` is live (a finish-step still in the pipe is pushed into it
  // later), and it is updated slightly after `onStepFinish` resets the tracker;
  // this one changes in the same tick as the tracker, so snapshots of both
  // always agree about which step is finished and which one is running.
  const finishedSteps: AbortedTurnStep[] = [];
  // Set by whichever of abort / normal completion bills the turn first.
  let settled = false;
  let pendingBilling: Promise<void> | undefined;

  // A deferred stop must not run while tool calls are in flight.
  turnAbort.setAbortGate(() => tracker.pendingToolCalls() === 0);

  const settleAborted = () => {
    if (settled) {
      return;
    }
    settled = true;

    // Snapshot synchronously and together, before any await.
    const steps = [...finishedSteps];
    const inFlightOutputText = tracker.outputText();
    onOutcome("aborted");

    pendingBilling = (async () => {
      try {
        await billAborted({ steps, inFlightOutputText });
      } catch (err) {
        console.warn("[chat-stop] aborted settlement failed", err);
      } finally {
        settlement.resolve();
      }
    })();
  };

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
        // A deferred stop may have been waiting for this tool result.
        turnAbort.flush();
      },
      onStepFinish: (step: AbortedTurnStep) => {
        finishedSteps.push(step);
        tracker.reset();
        // `onChunk` never reports a tool error: the end of the step is the
        // other point where a deferred stop learns that the tools are done.
        turnAbort.flush();
      },
      onAbort: () => settleAborted(),
    },

    /** Bill the turn through the stop path (idempotent). */
    settleAborted,

    /**
     * Safety net for streams that error instead of aborting (an abort that
     * reached the stream as a plain error): when the user had stopped the
     * turn, bill it as stopped.
     */
    onStreamError: () => {
      if (turnAbort.signal.aborted) {
        settleAborted();
      }
    },

    /** Normal path: returns false when the stop path already billed the turn. */
    claimCompletion: (): boolean => {
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

    /** The text stream finished consuming: no terminal path is left to run. */
    streamEnded: async () => {
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
 * Wait for a turn's settlement, but never longer than `timeoutMs`: persisting
 * the message (and finishing the request) matters more than a slow charge.
 */
export async function waitForSettlement(
  settlement: TurnSettlement,
  timeoutMs: number
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  try {
    await Promise.race([settlement.promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
