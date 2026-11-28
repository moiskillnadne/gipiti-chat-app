/**
 * Who may call a procedure, as the contract states it. The generator turns
 * the level into the operation's `security` entry, so a change in who may
 * call an endpoint changes the committed snapshot, and a client generated
 * from it knows which calls need a token.
 *
 * - `required`: a signed-in caller is needed (the router uses `requireAuth`);
 * - `optional`: anyone may call, a signed-in caller is treated differently
 *   (the router uses `withPrincipal`);
 * - `none`: no credentials are read at all (the router uses neither).
 *
 * `server/api/v1/__tests__/caller-access-http.test.ts` checks the level
 * against what the router does.
 */
export type CallerAccess = "required" | "optional" | "none";

/** The name of the scheme in `components.securitySchemes`. */
const BEARER_SCHEME_NAME = "bearerAuth";

/**
 * OpenAPI has no "optional" level: an empty requirement object in the list
 * stands for "no credentials", so `[{}, { bearerAuth: [] }]` reads as
 * "anonymous, or with a token".
 */
const SECURITY_BY_ACCESS: Record<CallerAccess, Record<string, string[]>[]> = {
  required: [{ [BEARER_SCHEME_NAME]: [] }],
  optional: [{}, { [BEARER_SCHEME_NAME]: [] }],
  none: [],
};

/**
 * For the `spec` of `oc.route({ ... })`:
 *
 * ```ts
 * oc.route({ method: "GET", path: "/me", spec: callerAccess("required") })
 * ```
 */
export const callerAccess =
  (access: CallerAccess) =>
  <TOperation extends object>(
    operation: TOperation
  ): TOperation & { security: Record<string, string[]>[] } => ({
    ...operation,
    security: SECURITY_BY_ACCESS[access],
  });
