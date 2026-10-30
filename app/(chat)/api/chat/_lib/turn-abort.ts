/**
 * Abort control for one chat turn.
 *
 * The signal given to `streamText` must be aborted with an `AbortError`
 * `DOMException`: a fetch aborted with any other reason (a plain string, say)
 * rejects its body reader with that reason, `streamText` does not recognise it
 * as an abort, errors the stream instead, and neither `onAbort` nor `onFinish`
 * runs, so nothing would be charged.
 *
 * A stop request does not always abort at once. While tool calls are running
 * the abort is deferred (see `setAbortGate`): aborting mid-tool drops the tool
 * result that is about to arrive, yet its cost is already in the accumulator.
 * The deferral is bounded: a tool that never returns would otherwise keep the
 * turn (and its billing) alive until the function is killed. Forcing settles
 * the turn at once, so a tool whose cost is only known when it returns (image
 * generation) is given until the function deadline instead of the short cap.
 */

/** Longest a stop may wait for running tools after it was requested. */
export const DEFERRAL_CAP_MS = 45_000;
/** The forced abort never lands later than this before the function deadline. */
export const DEADLINE_MARGIN_MS = 30_000;

export type TurnAbortOptions = {
  /** When the turn began (epoch ms); anchors the function deadline. */
  startedAt?: number;
  /** The route's `maxDuration` in ms; without it only the cap applies. */
  maxDurationMs?: number;
  /** Override of `DEFERRAL_CAP_MS`. */
  deferralCapMs?: number;
};

export type TurnAbort = {
  readonly signal: AbortSignal;
  /** When the stop was first requested on this instance (undefined: not stopped). */
  readonly requestedAt: Date | undefined;
  /** User stop (or disconnect). Aborts now, or as soon as the gate opens. */
  requestAbort: () => void;
  /**
   * Install the check that says whether aborting right now is safe. The owner
   * calls `flush` whenever the answer may have changed.
   */
  setAbortGate: (canAbortNow: () => boolean) => void;
  /** Perform a deferred abort if one is waiting and the gate is open. */
  flush: () => void;
  /**
   * Called when the deferral timed out and the abort was forced. The stream
   * may be stuck behind a tool that never returns and then never reports the
   * abort itself, so the owner must settle the turn from here.
   */
  onForcedAbort: (handler: () => void) => void;
  /**
   * Install the check for "a tool whose cost is booked only when it returns is
   * running". While it holds, the forced abort waits for the function deadline
   * instead of the deferral cap.
   */
  setLongToolCheck: (isLongToolRunning: () => boolean) => void;
  /** Cancel the pending force timer (call when the turn is over). */
  dispose: () => void;
};

export function createTurnAbort({
  startedAt = Date.now(),
  maxDurationMs,
  deferralCapMs = DEFERRAL_CAP_MS,
}: TurnAbortOptions = {}): TurnAbort {
  const controller = new AbortController();
  let requestedAt: Date | undefined;
  let canAbortNow: () => boolean = () => true;
  let isLongToolRunning: () => boolean = () => false;
  let forceTimer: ReturnType<typeof setTimeout> | undefined;
  const forcedHandlers: Array<() => void> = [];

  const dispose = () => {
    clearTimeout(forceTimer);
    forceTimer = undefined;
  };

  const abortNow = () => {
    dispose();
    if (!controller.signal.aborted) {
      controller.abort(new DOMException("user-stop", "AbortError"));
    }
  };

  const deadline =
    maxDurationMs === undefined
      ? Number.POSITIVE_INFINITY
      : startedAt + maxDurationMs - DEADLINE_MARGIN_MS;

  const scheduleForce = (forceAt: number) => {
    const delay = Math.max(0, forceAt - Date.now());
    // No deadline known and a long tool running: nothing to wait for.
    if (!Number.isFinite(delay)) {
      return;
    }
    forceTimer = setTimeout(() => {
      forceTimer = undefined;
      if (controller.signal.aborted) {
        return;
      }
      // The long tool may have started after the timer was set.
      if (isLongToolRunning() && Date.now() < deadline) {
        scheduleForce(deadline);
        return;
      }
      console.warn("[chat-stop] forced abort, tool still running");
      abortNow();
      for (const handler of forcedHandlers) {
        handler();
      }
    }, delay);
    // Never keep a serverless process / test runner alive just for this timer.
    forceTimer.unref?.();
  };

  const startForceTimer = () => {
    scheduleForce(
      isLongToolRunning()
        ? deadline
        : Math.min(Date.now() + deferralCapMs, deadline)
    );
  };

  const flush = () => {
    if (requestedAt && canAbortNow()) {
      abortNow();
    }
  };

  return {
    signal: controller.signal,
    get requestedAt() {
      return requestedAt;
    },
    requestAbort() {
      requestedAt ??= new Date();
      flush();
      if (!controller.signal.aborted && forceTimer === undefined) {
        startForceTimer();
      }
    },
    setAbortGate(gate) {
      canAbortNow = gate;
    },
    flush,
    setLongToolCheck(check) {
      isLongToolRunning = check;
    },
    onForcedAbort(handler) {
      forcedHandlers.push(handler);
    },
    dispose,
  };
}
