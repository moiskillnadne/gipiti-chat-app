import { describe, expect, it } from "vitest";
import {
  isTurnAborted,
  mediaPersistWaitMs,
  type TurnOutcome,
} from "../turn-lifecycle";

type Scenario = {
  isTextTurn?: boolean;
  isStreamAborted?: boolean;
  turnOutcome?: TurnOutcome;
  isSettled?: boolean;
  hasStopRequest?: boolean;
};

const evaluate = ({
  isTextTurn = false,
  isStreamAborted = false,
  turnOutcome,
  isSettled = true,
  hasStopRequest = false,
}: Scenario): boolean =>
  isTurnAborted({
    isTextTurn,
    isStreamAborted,
    turnOutcome,
    isSettled,
    hasStopRequest,
  });

describe("isTurnAborted for media turns", () => {
  it("is aborted when the handler reports the stop cut the provider call", () => {
    const result = evaluate({ turnOutcome: "aborted", hasStopRequest: true });

    expect(result).toBe(true);
  });

  it("is not aborted when the handler completed although a stop was requested", () => {
    const result = evaluate({ turnOutcome: "completed", hasStopRequest: true });

    expect(result).toBe(false);
  });

  it("is not aborted when no stop was requested", () => {
    const result = evaluate({ turnOutcome: "completed" });

    expect(result).toBe(false);
  });

  it("is not aborted without a stop and without an outcome", () => {
    const result = evaluate({});

    expect(result).toBe(false);
  });

  it("is aborted when a stop was requested and the handler never reported an outcome", () => {
    const result = evaluate({ turnOutcome: undefined, hasStopRequest: true });

    expect(result).toBe(true);
  });

  it("ignores the stream abort flag and the settlement wait", () => {
    const result = evaluate({
      isStreamAborted: true,
      isSettled: false,
      turnOutcome: "completed",
    });

    expect(result).toBe(false);
  });
});

describe("isTurnAborted for text turns", () => {
  it("is aborted when the stream itself ended aborted", () => {
    const result = evaluate({ isTextTurn: true, isStreamAborted: true });

    expect(result).toBe(true);
  });

  it("is aborted when the stop path settled the turn", () => {
    const result = evaluate({ isTextTurn: true, turnOutcome: "aborted" });

    expect(result).toBe(true);
  });

  it("is aborted when billing outlasted the wait and a stop was requested", () => {
    const result = evaluate({
      isTextTurn: true,
      isSettled: false,
      hasStopRequest: true,
    });

    expect(result).toBe(true);
  });

  it("is not aborted when a stop landed after the answer was complete", () => {
    const result = evaluate({
      isTextTurn: true,
      turnOutcome: "completed",
      hasStopRequest: true,
    });

    expect(result).toBe(false);
  });

  it("is not aborted when billing outlasted the wait but no stop was requested", () => {
    const result = evaluate({ isTextTurn: true, isSettled: false });

    expect(result).toBe(false);
  });
});

describe("mediaPersistWaitMs", () => {
  const input = {
    startedAt: 1000,
    maxDurationMs: 300_000,
    marginMs: 10_000,
  };

  it("waits until the margin before the function deadline", () => {
    const waitMs = mediaPersistWaitMs({ ...input, now: 21_000 });

    expect(waitMs).toBe(270_000);
  });

  it("does not wait when the margin is already reached", () => {
    const waitMs = mediaPersistWaitMs({ ...input, now: 295_000 });

    expect(waitMs).toBe(0);
  });
});
