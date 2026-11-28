import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import {
  ALL_API_ERROR_MESSAGE_KEYS,
  getApiErrorCode,
  getApiErrorMessageKey,
  getApiErrorReason,
  isAbortError,
  isApiError,
} from "@/client/shared/api/errors";
import errors from "@/messages/ru.errors.json" with { type: "json" };

describe("isApiError", () => {
  it.each([
    ["an ORPCError", new ORPCError("UNAUTHORIZED"), true],
    ["a plain Error", new Error("boom"), false],
    ["a string", "UNAUTHORIZED", false],
    ["null", null, false],
    ["an object that only looks like one", { code: "UNAUTHORIZED" }, false],
  ])("for %s answers %s", (_label, value, expected) => {
    // Act
    const result = isApiError(value);

    // Assert
    expect(result).toBe(expected);
  });
});

describe("getApiErrorCode and getApiErrorReason", () => {
  it("read the code and data.reason of an API error", () => {
    // Arrange
    const error = new ORPCError("UNAUTHORIZED", {
      data: { reason: "not_authenticated" },
    });

    // Act and Assert
    expect(getApiErrorCode(error)).toBe("UNAUTHORIZED");
    expect(getApiErrorReason(error)).toBe("not_authenticated");
  });

  it.each([
    ["no data", undefined],
    ["data that is a string", "not_authenticated"],
    ["data that is null", null],
    ["data without a reason", { issues: [] }],
    ["a reason that is not a string", { reason: 42 }],
  ])("give no reason for %s", (_label, data) => {
    // Arrange
    const error = new ORPCError("BAD_REQUEST", { data });

    // Act and Assert
    expect(getApiErrorReason(error)).toBeUndefined();
  });

  it("give nothing for a value that is not an API error", () => {
    // Act and Assert
    expect(getApiErrorCode(new Error("boom"))).toBeUndefined();
    expect(getApiErrorReason("boom")).toBeUndefined();
  });
});

describe("getApiErrorMessageKey", () => {
  it.each([
    ["UNAUTHORIZED", "api.UNAUTHORIZED"],
    ["FORBIDDEN", "api.FORBIDDEN"],
    ["NOT_FOUND", "api.NOT_FOUND"],
    ["BAD_REQUEST", "api.BAD_REQUEST"],
    ["CONFLICT", "api.CONFLICT"],
    ["TOO_MANY_REQUESTS", "api.TOO_MANY_REQUESTS"],
    ["PAYLOAD_TOO_LARGE", "api.PAYLOAD_TOO_LARGE"],
    ["UNSUPPORTED_MEDIA_TYPE", "api.UNSUPPORTED_MEDIA_TYPE"],
    ["INSUFFICIENT_BALANCE", "api.INSUFFICIENT_BALANCE"],
    ["SERVICE_UNAVAILABLE", "api.SERVICE_UNAVAILABLE"],
    ["UPSTREAM_ERROR", "api.UPSTREAM_ERROR"],
    ["INTERNAL_SERVER_ERROR", "api.INTERNAL_SERVER_ERROR"],
    ["BAD_GATEWAY", "api.BAD_GATEWAY"],
    ["GATEWAY_TIMEOUT", "api.GATEWAY_TIMEOUT"],
  ])("maps the code %s to %s", (code, expectedKey) => {
    // Act
    const key = getApiErrorMessageKey(new ORPCError(code));

    // Assert
    expect(key).toBe(expectedKey);
  });

  it.each([
    ["a code the page does not know", new ORPCError("TEAPOT_OVERLOADED")],
    ["a code that is a prototype property", new ORPCError("constructor")],
    ["a plain Error", new Error("boom")],
    ["a string", "boom"],
    ["undefined", undefined],
    [
      "an API error whose data is not an object",
      new ORPCError("TEAPOT", { data: 7 }),
    ],
  ])("maps %s to the unknown message", (_label, value) => {
    // Act
    const key = getApiErrorMessageKey(value);

    // Assert
    expect(key).toBe("api.unknown");
  });

  it("maps a cancelled call to null, which means show nothing", () => {
    // Act
    const key = getApiErrorMessageKey(new DOMException("", "AbortError"));

    // Assert
    expect(key).toBeNull();
  });

  it("maps a failed fetch (TypeError) to the network message", () => {
    // Act
    const key = getApiErrorMessageKey(new TypeError("Failed to fetch"));

    // Assert
    expect(key).toBe("api.network");
  });

  it("returns exactly the keys that exist under `api` in ru.errors.json", () => {
    // Arrange
    const keysInMapping = ALL_API_ERROR_MESSAGE_KEYS.map((key) =>
      key.replace("api.", "")
    );

    // Act
    const keysInJson = Object.keys(errors.api);

    // Assert
    expect(new Set(keysInMapping)).toEqual(new Set(keysInJson));
    expect(keysInMapping).toHaveLength(keysInJson.length);
  });
});

describe("isAbortError", () => {
  it.each([
    ["an AbortError", new DOMException("", "AbortError"), true],
    ["a TypeError", new TypeError("Failed to fetch"), false],
    ["an API error", new ORPCError("UNAUTHORIZED"), false],
    ["a string", "AbortError", false],
  ])("for %s answers %s", (_label, value, expected) => {
    // Act and Assert
    expect(isAbortError(value)).toBe(expected);
  });
});
