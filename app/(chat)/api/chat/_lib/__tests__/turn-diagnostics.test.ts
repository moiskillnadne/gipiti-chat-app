import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import {
  DEADLINE_WARNING_MARGIN_MS,
  startTurnDiagnostics,
  type TurnLogFields,
} from "../turn-diagnostics";

const FIELDS: TurnLogFields = {
  chatId: "chat-1",
  turnId: "turn-1",
  model: "gpt-6",
  mode: "text",
};
const MAX_DURATION_MS = 800_000;

describe("startTurnDiagnostics", () => {
  let infoSpy: MockInstance<typeof console.info>;
  let warnSpy: MockInstance<typeof console.warn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
    infoSpy = vi.spyOn(console, "info").mockImplementation(vi.fn());
    warnSpy = vi.spyOn(console, "warn").mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("logs the start of the turn with its identifying fields", () => {
    startTurnDiagnostics({
      fields: FIELDS,
      startedAt: Date.now(),
      maxDurationMs: MAX_DURATION_MS,
    });

    expect(infoSpy).toHaveBeenCalledWith("[chat-turn] start", FIELDS);
  });

  it("warns once when the turn is still running near the deadline", () => {
    const startedAt = Date.now();
    startTurnDiagnostics({
      fields: FIELDS,
      startedAt,
      maxDurationMs: MAX_DURATION_MS,
    });

    vi.advanceTimersByTime(MAX_DURATION_MS - DEADLINE_WARNING_MARGIN_MS - 1);
    expect(warnSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "[chat-turn] still running near the function deadline",
      expect.objectContaining({
        ...FIELDS,
        elapsedMs: MAX_DURATION_MS - DEADLINE_WARNING_MARGIN_MS,
        maxDurationMs: MAX_DURATION_MS,
      })
    );

    vi.advanceTimersByTime(MAX_DURATION_MS);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("anchors the warning on the request start, not on the call", () => {
    const startedAt = Date.now();
    vi.advanceTimersByTime(30_000);

    startTurnDiagnostics({
      fields: FIELDS,
      startedAt,
      maxDurationMs: MAX_DURATION_MS,
    });
    vi.advanceTimersByTime(
      MAX_DURATION_MS - DEADLINE_WARNING_MARGIN_MS - 30_000
    );

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("does not warn after the turn ended and logs its duration", () => {
    const startedAt = Date.now();
    const diagnostics = startTurnDiagnostics({
      fields: FIELDS,
      startedAt,
      maxDurationMs: MAX_DURATION_MS,
    });

    vi.advanceTimersByTime(42_000);
    diagnostics.end({ outcome: "completed", isAborted: false });
    vi.advanceTimersByTime(MAX_DURATION_MS);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledWith("[chat-turn] end", {
      ...FIELDS,
      outcome: "completed",
      isAborted: false,
      durationMs: 42_000,
    });
  });

  it("logs the end only once", () => {
    const diagnostics = startTurnDiagnostics({
      fields: FIELDS,
      startedAt: Date.now(),
      maxDurationMs: MAX_DURATION_MS,
    });

    diagnostics.end({ outcome: "failed", isAborted: false });
    diagnostics.end({ outcome: "completed", isAborted: false });

    const endCalls = infoSpy.mock.calls.filter(
      ([message]) => message === "[chat-turn] end"
    );
    expect(endCalls).toHaveLength(1);
    expect(endCalls[0]?.[1]).toMatchObject({ outcome: "failed" });
  });
});
