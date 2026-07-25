import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "../unique-violation";

/** Stand-in for the postgres.js error object, which carries the SQLSTATE. */
const postgresError = (code: string): Error =>
  Object.assign(new Error(`postgres error ${code}`), { code });

/** Stand-in for the DrizzleQueryError wrapper added in drizzle-orm 0.44+. */
const drizzleWrapped = (cause: Error): Error =>
  new Error('Failed query: insert into "User"', { cause });

describe("isUniqueViolation", () => {
  it("detects a bare postgres unique violation", () => {
    expect(isUniqueViolation(postgresError("23505"))).toBe(true);
  });

  it("detects a violation wrapped by DrizzleQueryError", () => {
    // Regression guard: reading `.code` off the top-level error returns
    // undefined, which silently misclassified every duplicate signup as a
    // generic database failure instead of "this address is already taken".
    expect(isUniqueViolation(drizzleWrapped(postgresError("23505")))).toBe(
      true
    );
  });

  it("walks more than one level of wrapping", () => {
    const nested = drizzleWrapped(drizzleWrapped(postgresError("23505")));

    expect(isUniqueViolation(nested)).toBe(true);
  });

  it("ignores other postgres error codes", () => {
    // 23503 is a foreign-key violation — a real failure that must not be
    // reported to the user as a duplicate address.
    expect(isUniqueViolation(drizzleWrapped(postgresError("23503")))).toBe(
      false
    );
  });

  it("ignores errors with no SQLSTATE at all", () => {
    expect(isUniqueViolation(new Error("connection reset"))).toBe(false);
  });

  it("handles non-Error values without throwing", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });

  it("terminates on a self-referential cause chain", () => {
    const looping = new Error("loop");
    looping.cause = looping;

    expect(isUniqueViolation(looping)).toBe(false);
  });
});
