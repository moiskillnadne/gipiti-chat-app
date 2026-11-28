import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import {
  type CursorPosition,
  decodeCursor,
  encodeCursor,
  MAX_PAGE_LIMIT,
  pageOutputSchema,
  pageQuerySchema,
} from "@/server/api/_kit/pagination";

const TRAILING_PADDING_PATTERN = /=+$/;
const URL_SAFE_PATTERN = /^[A-Za-z0-9_-]+$/;

const POSITION: CursorPosition = {
  createdAt: "2026-03-04 05:06:07.123456",
  id: "3f0c1b7e-7c0a-4a52-9d1b-1d2a3b4c5d6e",
};

const toCursor = (value: unknown): string =>
  btoa(JSON.stringify(value))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(TRAILING_PADDING_PATTERN, "");

describe("the cursor codec", () => {
  it("reads back the position it wrote", () => {
    // Act
    const decoded = decodeCursor(encodeCursor(POSITION));

    // Assert
    expect(decoded).toEqual({ status: "ok", position: POSITION });
  });

  it.each([
    "2026-03-04 05:06:07",
    "2026-03-04 05:06:07.1",
    "2024-02-29 23:59:59.999999",
  ])("round-trips the timestamp %s", (createdAt) => {
    // Arrange
    const position = { ...POSITION, createdAt };

    // Act
    const decoded = decodeCursor(encodeCursor(position));

    // Assert
    expect(decoded).toEqual({ status: "ok", position });
  });

  it("writes only URL-safe characters", () => {
    // Act
    const cursor = encodeCursor(POSITION);

    // Assert
    expect(cursor).toMatch(URL_SAFE_PATTERN);
  });

  it.each([
    ["not base64url", "!!!not a cursor!!!"],
    ["padding characters", `${encodeCursor(POSITION)}==`],
    [
      "base64 of text that is not JSON",
      btoa("hello").replace(TRAILING_PADDING_PATTERN, ""),
    ],
    ["a single character", "a"],
  ])("answers invalid for %s", (_name, cursor) => {
    // Act / Assert
    expect(decodeCursor(cursor)).toEqual({ status: "invalid" });
  });

  it.each([
    ["an array", []],
    ["null", null],
    ["a number", 7],
    ["a missing id", { createdAt: POSITION.createdAt }],
    ["a missing createdAt", { id: POSITION.id }],
    ["a numeric createdAt", { createdAt: 1_700_000_000_000, id: POSITION.id }],
    ["an id that is not a uuid", { createdAt: POSITION.createdAt, id: "7" }],
    ["an extra field", { ...POSITION, userId: POSITION.id }],
    [
      "an ISO date with a T",
      { ...POSITION, createdAt: "2026-03-04T05:06:07Z" },
    ],
    ["a 30 February", { ...POSITION, createdAt: "2026-02-30 00:00:00" }],
    [
      "29 February in a common year",
      { ...POSITION, createdAt: "2025-02-29 00:00:00" },
    ],
    ["month 13", { ...POSITION, createdAt: "2026-13-01 00:00:00" }],
    ["year 0", { ...POSITION, createdAt: "0000-01-01 00:00:00" }],
    ["hour 24", { ...POSITION, createdAt: "2026-01-01 24:00:00" }],
    [
      "seven fractional digits",
      { ...POSITION, createdAt: "2026-01-01 00:00:00.1234567" },
    ],
    [
      "SQL in createdAt",
      { ...POSITION, createdAt: "2026-01-01 00:00:00'; DROP" },
    ],
  ])("answers invalid for JSON with %s", (_name, value) => {
    // Act / Assert
    expect(decodeCursor(toCursor(value))).toEqual({ status: "invalid" });
  });

  it("does not return the original position for a tampered payload, and never throws", () => {
    // Arrange
    const cursor = encodeCursor(POSITION);
    const tampered = `${cursor.slice(0, 10)}${cursor[10] === "A" ? "B" : "A"}${cursor.slice(11)}`;

    // Act
    const decoded = decodeCursor(tampered);

    // Assert
    expect(decoded.status === "ok" ? decoded.position : null).not.toEqual(
      POSITION
    );
  });

  it("answers invalid for a truncated cursor", () => {
    // Arrange
    const cursor = encodeCursor(POSITION);

    // Act / Assert
    expect(decodeCursor(cursor.slice(0, cursor.length - 8))).toEqual({
      status: "invalid",
    });
  });
});

describe("the page query", () => {
  it("defaults the limit to 20", () => {
    // Act
    const parsed = pageQuerySchema.parse({});

    // Assert
    expect(parsed).toEqual({ limit: 20 });
  });

  it("turns a query-string limit into a number", () => {
    // Act
    const parsed = pageQuerySchema.parse({ limit: "7", cursor: "abc" });

    // Assert
    expect(parsed).toEqual({ limit: 7, cursor: "abc" });
  });

  it.each(["0", "101", "-1", "1.5", "abc", ""])(
    "refuses the limit %j",
    (limit) => {
      // Act
      const result = pageQuerySchema.safeParse({ limit });

      // Assert
      expect(result.success).toBe(false);
    }
  );

  it("accepts the bounds", () => {
    // Act / Assert
    expect(pageQuerySchema.parse({ limit: "1" }).limit).toBe(1);
    expect(pageQuerySchema.parse({ limit: String(MAX_PAGE_LIMIT) }).limit).toBe(
      MAX_PAGE_LIMIT
    );
  });

  it("refuses an empty cursor", () => {
    // Act
    const result = pageQuerySchema.safeParse({ cursor: "" });

    // Assert
    expect(result.success).toBe(false);
  });
});

describe("the page output", () => {
  it("wraps any item schema with a nullable next cursor", () => {
    // Arrange
    const schema = pageOutputSchema(z.object({ id: z.string() }));

    // Act
    const last = schema.parse({ items: [{ id: "a" }], nextCursor: null });
    const middle = schema.parse({ items: [], nextCursor: "abc" });

    // Assert
    expect(last.nextCursor).toBeNull();
    expect(middle.nextCursor).toBe("abc");
  });
});
