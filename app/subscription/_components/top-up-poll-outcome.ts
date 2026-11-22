import type { PaymentStatusResponse } from "@/lib/types";

/**
 * Why the dialog could not confirm a payment the widget reported as paid.
 * In every case the money may already have been charged.
 * - `timeout`: the server answered, but the payment stayed unconfirmed.
 * - `unreachable`: no status request reached the server.
 * - `stoppedWaiting`: the user stopped waiting before the answer came.
 */
export type UnconfirmedCause = "timeout" | "unreachable" | "stoppedWaiting";

export type TopupStage =
  | { name: "amount"; isSubmitting: boolean }
  | { name: "processing"; sessionId: string; amountMajor: number }
  | { name: "success"; amountMajor: number; balanceTotalMinor: number }
  /** The widget itself reported a declined charge (`onFail`). */
  | { name: "declined"; amountMajor: number }
  /** Outcome unknown: the money may have been charged. */
  | {
      name: "unconfirmed";
      sessionId: string;
      amountMajor: number;
      cause: UnconfirmedCause;
      isChecking: boolean;
      hasRechecked: boolean;
    };

/**
 * What the status endpoint tells us after the widget reported a payment.
 * There is no "declined" result: see `readStatusResponse`.
 */
export type PollResult =
  | { kind: "succeeded"; balanceTotalMinor: number }
  | { kind: "unconfirmed"; cause: UnconfirmedCause }
  | { kind: "aborted" };

type PaymentRef = { sessionId: string; amountMajor: number };

/**
 * Reads one status response received after the widget reported a payment.
 * Returns null while the payment is not confirmed yet (keep polling).
 *
 * `failed` is not a decline here: the widget has already reported a payment,
 * the fail notification marks any intent that is not `succeeded` as `failed`
 * (so a late or out-of-order one can arrive before the pay notification), and
 * the pay notification still credits a `failed` intent. `expired` is the same: the server reports a pending intent past its
 * deadline as expired, and a late pay notification can still credit it.
 */
export const readStatusResponse = (
  data: PaymentStatusResponse
): PollResult | null => {
  if (data.status === "succeeded") {
    return {
      kind: "succeeded",
      balanceTotalMinor: data.topup?.balanceTotalMinor ?? 0,
    };
  }

  if (data.status === "expired") {
    return { kind: "unconfirmed", cause: "timeout" };
  }

  return null;
};

/** The result of a polling loop that ran out of attempts or was aborted. */
export const endOfPolling = ({
  isAborted,
  hasReachedServer,
}: {
  isAborted: boolean;
  hasReachedServer: boolean;
}): PollResult => {
  if (isAborted) {
    return { kind: "aborted" };
  }

  return {
    kind: "unconfirmed",
    cause: hasReachedServer ? "timeout" : "unreachable",
  };
};

export const unconfirmedStage = (
  { sessionId, amountMajor }: PaymentRef,
  cause: UnconfirmedCause,
  hasRechecked = false
): TopupStage => ({
  name: "unconfirmed",
  sessionId,
  amountMajor,
  cause,
  isChecking: false,
  hasRechecked,
});

/** Maps a poll result to the dialog stage. Null means "leave the stage as is". */
export const stageFromPollResult = (
  result: PollResult,
  payment: PaymentRef
): TopupStage | null => {
  switch (result.kind) {
    case "succeeded":
      return {
        name: "success",
        amountMajor: payment.amountMajor,
        balanceTotalMinor: result.balanceTotalMinor,
      };
    case "unconfirmed":
      return unconfirmedStage(payment, result.cause);
    case "aborted":
      // The dialog was closed or reset: nothing to show.
      return null;
    default: {
      const unhandled: never = result;
      return unhandled;
    }
  }
};

export const buildStatusUrl = (sessionId: string): string =>
  `/api/payment/status?sessionId=${encodeURIComponent(sessionId)}`;

/**
 * Asks for the status once, for the «check again» button. A failed request is
 * reported as `unreachable`; an unconfirmed payment (including `failed`, see
 * `readStatusResponse`) as `timeout`.
 */
export const checkStatusOnce = async (
  sessionId: string,
  signal?: AbortSignal
): Promise<PollResult> => {
  try {
    const response = await fetch(buildStatusUrl(sessionId), { signal });
    if (!response.ok) {
      return { kind: "unconfirmed", cause: "unreachable" };
    }
    const data: PaymentStatusResponse = await response.json();
    return (
      readStatusResponse(data) ?? { kind: "unconfirmed", cause: "timeout" }
    );
  } catch {
    // Not swallowed: the screen tells the user the server was not reached.
    return { kind: "unconfirmed", cause: "unreachable" };
  }
};
