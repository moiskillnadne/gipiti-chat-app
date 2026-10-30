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
 */

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
};

export function createTurnAbort(): TurnAbort {
  const controller = new AbortController();
  let requestedAt: Date | undefined;
  let canAbortNow: () => boolean = () => true;

  const abortNow = () => {
    if (!controller.signal.aborted) {
      controller.abort(new DOMException("user-stop", "AbortError"));
    }
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
    },
    setAbortGate(gate) {
      canAbortNow = gate;
    },
    flush,
  };
}
