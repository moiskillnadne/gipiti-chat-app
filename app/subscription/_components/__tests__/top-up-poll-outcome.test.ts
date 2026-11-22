import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkStatusOnce,
  endOfPolling,
  readStatusResponse,
  stageFromPollResult,
} from "@/app/subscription/_components/top-up-poll-outcome";

const payment = { sessionId: "session-1", amountMajor: 1000 };

describe("readStatusResponse", () => {
  it("reads a succeeded top-up with the new balance", () => {
    expect(
      readStatusResponse({
        status: "succeeded",
        topup: {
          amountMinor: 100_000,
          currencyCode: "RUB",
          balanceTotalMinor: 250_000,
          balanceTopupMinor: 100_000,
        },
      })
    ).toEqual({ kind: "succeeded", balanceTotalMinor: 250_000 });
  });

  it("keeps polling on a failed status after the widget reported success: it is not a decline", () => {
    // Card 1 declined (intent marked failed), card 2 paid in the same widget,
    // pay notification not there yet: the money may well be charged.
    expect(
      readStatusResponse({ status: "failed", failureReason: "Insufficient" })
    ).toBeNull();
  });

  it("does not read an expired intent as declined: the money may be charged", () => {
    expect(readStatusResponse({ status: "expired" })).toEqual({
      kind: "unconfirmed",
      cause: "timeout",
    });
  });

  it.each(["pending", "processing", "verifying", "activating"] as const)(
    "keeps polling while the status is %s",
    (status) => {
      expect(readStatusResponse({ status })).toBeNull();
    }
  );
});

describe("endOfPolling", () => {
  it("reports an aborted poll so the stage is left alone", () => {
    expect(endOfPolling({ isAborted: true, hasReachedServer: true })).toEqual({
      kind: "aborted",
    });
  });

  it("reports a timeout when the server answered but never confirmed", () => {
    expect(endOfPolling({ isAborted: false, hasReachedServer: true })).toEqual({
      kind: "unconfirmed",
      cause: "timeout",
    });
  });

  it("reports an unreachable server when every request failed", () => {
    expect(endOfPolling({ isAborted: false, hasReachedServer: false })).toEqual(
      { kind: "unconfirmed", cause: "unreachable" }
    );
  });
});

describe("stageFromPollResult", () => {
  it("maps success to the success stage", () => {
    expect(
      stageFromPollResult(
        { kind: "succeeded", balanceTotalMinor: 5000 },
        payment
      )
    ).toEqual({ name: "success", amountMajor: 1000, balanceTotalMinor: 5000 });
  });

  it.each(["timeout", "unreachable", "stoppedWaiting"] as const)(
    "maps an unconfirmed result (%s) to the unconfirmed stage",
    (cause) => {
      expect(
        stageFromPollResult({ kind: "unconfirmed", cause }, payment)
      ).toEqual({
        name: "unconfirmed",
        sessionId: "session-1",
        amountMajor: 1000,
        cause,
        isChecking: false,
        hasRechecked: false,
      });
    }
  );

  it("leaves the stage alone after an aborted poll", () => {
    expect(stageFromPollResult({ kind: "aborted" }, payment)).toBeNull();
  });
});

describe("checkStatusOnce", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a confirmed success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ status: "succeeded" })
    );

    await expect(checkStatusOnce("session-1")).resolves.toEqual({
      kind: "succeeded",
      balanceTotalMinor: 0,
    });
  });

  it("reports a failed status as unconfirmed, never as a decline", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ status: "failed" })
    );

    await expect(checkStatusOnce("session-1")).resolves.toEqual({
      kind: "unconfirmed",
      cause: "timeout",
    });
  });

  it("reports a still pending payment as a timeout", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ status: "pending" })
    );

    await expect(checkStatusOnce("session-1")).resolves.toEqual({
      kind: "unconfirmed",
      cause: "timeout",
    });
  });

  it("reports a network error as an unreachable server", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    await expect(checkStatusOnce("session-1")).resolves.toEqual({
      kind: "unconfirmed",
      cause: "unreachable",
    });
  });

  it("reports an error response as an unreachable server", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("boom", { status: 500 })
    );

    await expect(checkStatusOnce("session-1")).resolves.toEqual({
      kind: "unconfirmed",
      cause: "unreachable",
    });
  });
});
