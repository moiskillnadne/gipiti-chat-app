import { ORPCError } from "@orpc/client";

/** An error the API answered with. Its `code` is an open set, hence `string`. */
export type ApiError = ORPCError<string, unknown>;

/** A key of the `errors` i18n namespace, for `useTranslations("errors")`. */
type ApiMessages = typeof import("@/messages/ru.errors.json").api;

export type ApiErrorMessageKey = `api.${Extract<keyof ApiMessages, string>}`;

/**
 * Codes the page has its own text for. A code outside this list is not an
 * error: the server may add codes, and they fall back to `api.unknown`.
 */
const API_ERROR_MESSAGE_KEY_BY_CODE = {
  UNAUTHORIZED: "api.UNAUTHORIZED",
  FORBIDDEN: "api.FORBIDDEN",
  NOT_FOUND: "api.NOT_FOUND",
  BAD_REQUEST: "api.BAD_REQUEST",
  CONFLICT: "api.CONFLICT",
  TOO_MANY_REQUESTS: "api.TOO_MANY_REQUESTS",
  PAYLOAD_TOO_LARGE: "api.PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "api.UNSUPPORTED_MEDIA_TYPE",
  INSUFFICIENT_BALANCE: "api.INSUFFICIENT_BALANCE",
  SERVICE_UNAVAILABLE: "api.SERVICE_UNAVAILABLE",
  BAD_GATEWAY: "api.BAD_GATEWAY",
  GATEWAY_TIMEOUT: "api.GATEWAY_TIMEOUT",
  UPSTREAM_ERROR: "api.UPSTREAM_ERROR",
  INTERNAL_SERVER_ERROR: "api.INTERNAL_SERVER_ERROR",
} as const satisfies Record<string, ApiErrorMessageKey>;

const NETWORK_MESSAGE_KEY: ApiErrorMessageKey = "api.network";
const UNKNOWN_MESSAGE_KEY: ApiErrorMessageKey = "api.unknown";

/** Every key the mapping can return; a test compares it with the JSON. */
export const ALL_API_ERROR_MESSAGE_KEYS: readonly ApiErrorMessageKey[] = [
  ...Object.values(API_ERROR_MESSAGE_KEY_BY_CODE),
  NETWORK_MESSAGE_KEY,
  UNKNOWN_MESSAGE_KEY,
];

const isKnownCode = (
  code: string
): code is keyof typeof API_ERROR_MESSAGE_KEY_BY_CODE =>
  Object.hasOwn(API_ERROR_MESSAGE_KEY_BY_CODE, code);

/** True for an error the API answered with (as opposed to a failure to reach it). */
export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ORPCError;

export const getApiErrorCode = (error: unknown): string | undefined =>
  isApiError(error) ? error.code : undefined;

/** The `data.reason` of an error, when the server sent one. */
export const getApiErrorReason = (error: unknown): string | undefined => {
  if (!isApiError(error)) {
    return;
  }
  const { data } = error;
  if (typeof data !== "object" || data === null || !("reason" in data)) {
    return;
  }

  return typeof data.reason === "string" ? data.reason : undefined;
};

/**
 * `fetch` rejects with a `TypeError` when the request never reached the
 * server (offline, DNS, connection reset).
 */
const isNetworkFailure = (error: unknown): boolean =>
  error instanceof TypeError;

/**
 * True when the call was cancelled with an `AbortSignal` (a DOMException named
 * `AbortError`). The page did that itself, so it is not a failure to report.
 */
export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";

/**
 * Which text to show for a failed API call. Never throws. `null` means "show
 * nothing": the call was cancelled by the page itself.
 */
export const getApiErrorMessageKey = (
  error: unknown
): ApiErrorMessageKey | null => {
  if (isAbortError(error)) {
    return null;
  }
  if (isApiError(error)) {
    return isKnownCode(error.code)
      ? API_ERROR_MESSAGE_KEY_BY_CODE[error.code]
      : UNKNOWN_MESSAGE_KEY;
  }

  return isNetworkFailure(error) ? NETWORK_MESSAGE_KEY : UNKNOWN_MESSAGE_KEY;
};
