import { ORPCError } from "@orpc/server";

import {
  ChatSDKError,
  type ErrorType,
  visibilityBySurface,
} from "@/lib/errors";

type ApiErrorDefinition = {
  code: string;
  status: number;
  /** Sent when the original message must not reach the client. */
  message: string;
};

/**
 * The one place that decides how the app's own errors look on the v1 wire.
 *
 * `quota_exceeded` is `INSUFFICIENT_BALANCE` (402), not 429: a client retries
 * a 429 and shows a top-up screen for a 402.
 */
export const API_ERROR_BY_TYPE: Record<ErrorType, ApiErrorDefinition> = {
  bad_request: {
    code: "BAD_REQUEST",
    status: 400,
    message: "The request is not valid.",
  },
  unauthorized: {
    code: "UNAUTHORIZED",
    status: 401,
    message: "Authentication is required.",
  },
  forbidden: {
    code: "FORBIDDEN",
    status: 403,
    message: "This action is not allowed.",
  },
  not_found: { code: "NOT_FOUND", status: 404, message: "Not found." },
  rate_limit: {
    code: "TOO_MANY_REQUESTS",
    status: 429,
    message: "Too many requests. Try again later.",
  },
  quota_exceeded: {
    code: "INSUFFICIENT_BALANCE",
    status: 402,
    message: "The balance is not enough for this request.",
  },
  offline: {
    code: "SERVICE_UNAVAILABLE",
    status: 503,
    message: "The service is temporarily unavailable.",
  },
};

const SERVER_ERROR_STATUS_FLOOR = 500;

const INTERNAL_ERROR = new ORPCError("INTERNAL_SERVER_ERROR", {
  status: 500,
  message: "Internal server error",
});

/**
 * Turn an error thrown by app code into the error a v1 client receives.
 *
 * - An `ORPCError` is already in wire form and passes through, unless it is a
 *   5xx no contract declares: those come from the library ("Output validation
 *   failed") and get the same plain 500 as any other unexpected failure.
 * - A `ChatSDKError` is mapped by its type. If its surface is log-only (the
 *   database), the client gets a plain 500 with no detail.
 * - Anything else is a 500 with no detail.
 */
export const toApiError = (error: unknown): ORPCError<string, unknown> => {
  if (error instanceof ORPCError) {
    const isUndeclaredServerError =
      error.status >= SERVER_ERROR_STATUS_FLOOR && !error.defined;

    return isUndeclaredServerError ? INTERNAL_ERROR : error;
  }
  if (!(error instanceof ChatSDKError)) {
    return INTERNAL_ERROR;
  }
  if (visibilityBySurface[error.surface] !== "response") {
    return INTERNAL_ERROR;
  }

  const definition = API_ERROR_BY_TYPE[error.type];

  return new ORPCError(definition.code, {
    status: definition.status,
    message: definition.message,
  });
};

/** True for errors that are a normal answer, not something to investigate. */
export const isExpectedApiError = (error: unknown): boolean =>
  error instanceof ORPCError && error.status < SERVER_ERROR_STATUS_FLOOR;
