/**
 * Error map fragments shared by v1 contracts. A contract lists the errors a
 * caller should expect; any procedure can still answer with the generic ones
 * (`BAD_REQUEST` for input that fails validation, `INTERNAL_SERVER_ERROR`).
 *
 * Every error reaches the client as
 * `{ defined, code, status, message, data? }` with the HTTP status of `status`.
 */
export const unauthorizedError = {
  UNAUTHORIZED: {
    status: 401,
    message: "Authentication is required.",
  },
} as const;

/**
 * A browser session on a state-changing request that does not show it was
 * made by a page of this site (`data.reason: "cross_site_request"`). Callers
 * with a bearer token never get it.
 */
export const forbiddenError = {
  FORBIDDEN: {
    status: 403,
    message: "This action is not allowed.",
  },
} as const;

export const tooManyRequestsError = {
  TOO_MANY_REQUESTS: {
    status: 429,
    message: "Too many requests. Try again later.",
  },
} as const;

/**
 * The request was refused because a safety limit could not be checked. It is
 * safe to retry after a moment.
 */
export const serviceUnavailableError = {
  SERVICE_UNAVAILABLE: {
    status: 503,
    message: "The service is temporarily unavailable.",
  },
} as const;

export const notFoundError = {
  NOT_FOUND: {
    status: 404,
    message: "Not found.",
  },
} as const;

/**
 * For an operation whose 400 means something the caller can act on beyond
 * "the input did not validate" (which every operation can answer and none
 * declares). Use it where the contract names that 400.
 */
export const badRequestError = {
  BAD_REQUEST: {
    status: 400,
    message: "The request is not valid.",
  },
} as const;
