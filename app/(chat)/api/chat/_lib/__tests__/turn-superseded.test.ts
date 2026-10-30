import { describe, expect, it } from "vitest";
import { isTurnSuperseded } from "../turn-superseded";

const TURN_CREATED_AT = new Date("2026-10-30T10:00:00.000Z");

describe("isTurnSuperseded", () => {
  it("is false while the turn's own message is still stored as it was", () => {
    expect(
      isTurnSuperseded(TURN_CREATED_AT, { createdAt: TURN_CREATED_AT })
    ).toBe(false);
  });

  it("is false when the user sent the next message before the stopped answer was saved", () => {
    // Only the turn's own row is consulted, so message B (stored later, with
    // its own id) cannot make the answer to A stale.
    const rowOfA = { createdAt: new Date(TURN_CREATED_AT.getTime()) };

    expect(isTurnSuperseded(TURN_CREATED_AT, rowOfA)).toBe(false);
  });

  it("is false for a regenerate: the turn kept the stored row's timestamp", () => {
    const storedTimestamp = new Date("2026-10-30T09:00:00.000Z");

    expect(
      isTurnSuperseded(storedTimestamp, {
        createdAt: new Date(storedTimestamp.getTime()),
      })
    ).toBe(false);
  });

  it("is true when an edit of the last message re-saved it with a new timestamp", () => {
    expect(
      isTurnSuperseded(TURN_CREATED_AT, {
        createdAt: new Date("2026-10-30T10:00:20.000Z"),
      })
    ).toBe(true);
  });

  it("is true when an edit of an earlier message deleted the row", () => {
    expect(isTurnSuperseded(TURN_CREATED_AT, undefined)).toBe(true);
  });
});
