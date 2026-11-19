import { ORPCError } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { ChatSDKError, type ErrorCode } from "@/lib/errors";
import { isExpectedApiError, toApiError } from "@/server/api/_kit/errors";

describe("toApiError", () => {
  it.each<[ErrorCode, string, number]>([
    ["bad_request:api", "BAD_REQUEST", 400],
    ["unauthorized:chat", "UNAUTHORIZED", 401],
    ["forbidden:vote", "FORBIDDEN", 403],
    ["not_found:chat", "NOT_FOUND", 404],
    ["rate_limit:chat", "TOO_MANY_REQUESTS", 429],
    ["quota_exceeded:chat", "INSUFFICIENT_BALANCE", 402],
    ["offline:chat", "SERVICE_UNAVAILABLE", 503],
  ])("maps %s to %s with status %i", (errorCode, code, status) => {
    // Act
    const apiError = toApiError(new ChatSDKError(errorCode));

    // Assert
    expect(apiError.code).toBe(code);
    expect(apiError.status).toBe(status);
  });

  it("answers a database error with a 500 that carries no detail", () => {
    // Arrange
    const databaseError = new ChatSDKError(
      "bad_request:database",
      "connection to ep-secret-host.neon.tech refused"
    );

    // Act
    const apiError = toApiError(databaseError);

    // Assert
    expect(apiError.code).toBe("INTERNAL_SERVER_ERROR");
    expect(apiError.status).toBe(500);
    expect(JSON.stringify(apiError.toJSON())).not.toContain("ep-secret-host");
  });

  it("answers an unknown error with a 500 that carries no detail", () => {
    // Act
    const apiError = toApiError(new Error("postgres://user:pass@host/db"));

    // Assert
    expect(apiError.toJSON()).toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      status: 500,
      message: "Internal server error",
    });
  });

  it("does not put the app's own message on the wire", () => {
    // Arrange
    const appError = new ChatSDKError(
      "forbidden:vote",
      "cause detail",
      "Этот чат принадлежит другому пользователю"
    );

    // Act
    const apiError = toApiError(appError);

    // Assert
    expect(apiError.message).toBe("This action is not allowed.");
  });

  it("passes an error that is already in wire form through", () => {
    // Arrange
    const wireError = new ORPCError("UNAUTHORIZED", { status: 401 });

    // Act
    const apiError = toApiError(wireError);

    // Assert
    expect(apiError).toBe(wireError);
  });

  it("replaces a 5xx the library raised with a 500 that carries no detail", () => {
    // Arrange: what oRPC throws when a handler's output fails its schema.
    const libraryError = new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Output validation failed",
    });

    // Act
    const apiError = toApiError(libraryError);

    // Assert
    expect(apiError.status).toBe(500);
    expect(apiError.message).toBe("Internal server error");
  });

  it("keeps a 5xx that a contract declares", () => {
    // Arrange
    const declaredError = new ORPCError("SERVICE_UNAVAILABLE", {
      status: 503,
      message: "The model provider is down.",
      defined: true,
    });

    // Act
    const apiError = toApiError(declaredError);

    // Assert
    expect(apiError).toBe(declaredError);
  });
});

describe("isExpectedApiError", () => {
  it.each([
    ["a 401", new ORPCError("UNAUTHORIZED", { status: 401 }), true],
    ["a 402", new ORPCError("INSUFFICIENT_BALANCE", { status: 402 }), true],
    ["a 500", new ORPCError("INTERNAL_SERVER_ERROR", { status: 500 }), false],
    ["a 503", new ORPCError("SERVICE_UNAVAILABLE", { status: 503 }), false],
    ["a plain error", new Error("boom"), false],
  ])("is %s expected: %s", (_case, error, isExpected) => {
    // Act
    const result = isExpectedApiError(error);

    // Assert
    expect(result).toBe(isExpected);
  });
});
