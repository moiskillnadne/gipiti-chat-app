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

export const notFoundError = {
  NOT_FOUND: {
    status: 404,
    message: "Not found.",
  },
} as const;
