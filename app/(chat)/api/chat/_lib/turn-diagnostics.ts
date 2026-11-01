import type { ChatMode } from "./resolve-mode";
import type { TurnOutcome } from "./turn-lifecycle";

/**
 * Logs that make a chat turn traceable in the runtime logs. A turn killed by
 * the platform at `maxDuration` leaves no trace of its own (no `onFinish`, no
 * error), so the start line is what tells which model and chat it was, and the
 * near-deadline warning shows the turn was still running when it was cut.
 */

/** The warning fires this long before the function deadline. */
export const DEADLINE_WARNING_MARGIN_MS = 60_000;

/**
 * The handler's outcome, `failed` when the route threw before streaming, or
 * undefined when the stream ended without the handler reporting one.
 */
export type TurnDiagnosticsOutcome = TurnOutcome | "failed" | undefined;

export type TurnLogFields = {
  chatId: string;
  turnId: string;
  model: string;
  mode: ChatMode;
};

type StartTurnDiagnosticsInput = {
  fields: TurnLogFields;
  /** When the request began (epoch ms); anchors the function deadline. */
  startedAt: number;
  /** The route's `maxDuration` in ms. */
  maxDurationMs: number;
};

type TurnEndInput = {
  outcome: TurnDiagnosticsOutcome;
  isAborted: boolean;
};

export type TurnDiagnostics = {
  /** Log the end of the turn and cancel the warning. Idempotent. */
  end: (input: TurnEndInput) => void;
};

/**
 * Log the start of a turn and arm a warning for a turn still running
 * `DEADLINE_WARNING_MARGIN_MS` before the function deadline.
 */
export function startTurnDiagnostics({
  fields,
  startedAt,
  maxDurationMs,
}: StartTurnDiagnosticsInput): TurnDiagnostics {
  console.info("[chat-turn] start", fields);

  let hasEnded = false;
  const warnAt = startedAt + maxDurationMs - DEADLINE_WARNING_MARGIN_MS;
  const warningTimer = setTimeout(
    () => {
      console.warn("[chat-turn] still running near the function deadline", {
        ...fields,
        elapsedMs: Date.now() - startedAt,
        maxDurationMs,
      });
    },
    Math.max(0, warnAt - Date.now())
  );
  // Never keep a serverless process / test runner alive just for this timer.
  warningTimer.unref?.();

  return {
    end: ({ outcome, isAborted }) => {
      if (hasEnded) {
        return;
      }
      hasEnded = true;
      clearTimeout(warningTimer);
      console.info("[chat-turn] end", {
        ...fields,
        outcome,
        isAborted,
        durationMs: Date.now() - startedAt,
      });
    },
  };
}
