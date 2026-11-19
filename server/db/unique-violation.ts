import type postgres from "postgres";

/** SQLSTATE raised by Postgres when a unique index or constraint rejects a row. */
const UNIQUE_VIOLATION = "23505";

/**
 * How far to follow `.cause` before giving up. Real chains are two links deep;
 * the bound exists so a self-referential cause cannot hang the error handler.
 */
const MAX_CAUSE_DEPTH = 10;

/**
 * Whether a thrown error is a Postgres unique-constraint violation.
 *
 * Drizzle wraps driver failures in a `DrizzleQueryError`, so the SQLSTATE sits
 * on `.cause` rather than on the error itself — reading `.code` off the
 * top-level error always yields undefined and silently misclassifies every
 * duplicate as a generic database failure. Walk the whole chain instead.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth++) {
    if (!(current instanceof Error)) {
      return false;
    }

    if ((current as postgres.PostgresError).code === UNIQUE_VIOLATION) {
      return true;
    }

    current = current.cause;
  }

  return false;
}
