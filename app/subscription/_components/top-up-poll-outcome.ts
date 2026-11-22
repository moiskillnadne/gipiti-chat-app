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
  /** The provider declined the payment: nothing was charged. */
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

export type PollResult =
  | { kind: "succeeded"; balanceTotalMinor: number }
  | { kind: "declined" }
  | { kind: "unconfirmed"; cause: UnconfirmedCause }
  | { kind: "aborted" };

type PaymentRef = { sessionId: string; amountMajor: number };

/**
 * Reads one status response. Returns null while the payment is still pending.
 * `expired` is not a decline: the server reports a pending intent past its
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

  if (data.status === "failed") {
    return { kind: "declined" };
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
    case "declined":
      return { name: "declined", amountMajor: payment.amountMajor };
    case "unconfirmed":
      return unconfirmedStage(payment, result.cause);
    default:
      // "aborted": the dialog was closed, nothing to show.
      return null;
  }
};

export const buildStatusUrl = (sessionId: string): string =>
  `/api/payment/status?sessionId=${encodeURIComponent(sessionId)}`;

/**
 * Asks for the status once, for the «check again» button. A failed request is
 * reported as `unreachable`; a still pending payment as `timeout`.
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
