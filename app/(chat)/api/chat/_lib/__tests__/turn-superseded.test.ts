import { describe, expect, it } from "vitest";
import { isTurnSuperseded } from "../turn-superseded";

const SAVED = { id: "m1", createdAt: new Date("2026-10-30T10:00:00.000Z") };

describe("isTurnSuperseded", () => {
  it("is false while the turn's message is still the latest user message", () => {
    expect(isTurnSuperseded(SAVED, { ...SAVED })).toBe(false);
  });

  it("is true when the message was deleted (edit) and nothing is left", () => {
    expect(isTurnSuperseded(SAVED, undefined)).toBe(true);
  });

  it("is true when a newer user message exists", () => {
    expect(
      isTurnSuperseded(SAVED, {
        id: "m2",
        createdAt: new Date("2026-10-30T10:01:00.000Z"),
      })
    ).toBe(true);
  });

  it("is true when an edit re-saved the same message id with a new timestamp", () => {
    expect(
      isTurnSuperseded(SAVED, {
        id: "m1",
        createdAt: new Date("2026-10-30T10:00:20.000Z"),
      })
    ).toBe(true);
  });
});
