import { createRouterClient, type RouterClient } from "@orpc/server";

import type { InitialContext } from "@/server/api/_kit/context";
import { v1Router } from "@/server/api/v1/router";

/** A typed client of the v1 router that runs in this process. */
export type ServerCaller = RouterClient<typeof v1Router>;

/** The request in the context is only there to satisfy the context type. */
const IN_PROCESS_URL = "http://in-process.invalid/";

/**
 * A READ-ONLY client of `/api/v1` for server components: it calls the
 * procedures in this process, with no HTTP, so a page gets the same data a
 * mobile client gets and its props are the same DTOs.
 *
 * ```ts
 * const api = createServerCaller();
 * const { items } = await api.projects.list();
 * ```
 *
 * Only `GET` and `HEAD` procedures run. Any other is refused by
 * `handleErrors` before its handler, as a logged 500 (a programming error),
 * and that is the guarantee: the type of `ServerCaller` still lists every
 * procedure, because oRPC's contract type does not carry the route method.
 * Why read-only: the caller acts on the cookie that `auth()` reads from
 * Next's request scope, and that is the browser's cookie in a route handler
 * or a server action too. The same-origin (CSRF) check is skipped on this
 * transport, so a state change here could be started by a cross-site form
 * post; and the synthesized request has no client IP, so the IP rate limits
 * of the auth procedures would not apply. A change from the web goes
 * through the browser's HTTP client, which sends the proofs.
 *
 * Also:
 *
 * - It never accepts a bearer token: the synthesized request carries no
 *   headers, and `resolvePrincipal` ignores `Authorization` for this
 *   transport as well.
 * - An anonymous call to a procedure that needs a signed-in user fails with
 *   the same 401 `not_authenticated` as over HTTP.
 * - Next's control-flow errors (a dynamic-usage bailout, `redirect()`) pass
 *   through `handleErrors` unchanged.
 * - Route handlers and `"use server"` modules may not import this file
 *   (`tests/architecture`).
 */
export const createServerCaller = (): ServerCaller => {
  const context: InitialContext = {
    request: new Request(IN_PROCESS_URL),
    transport: "in-process",
    requestId: crypto.randomUUID(),
  };

  return createRouterClient(v1Router, { context });
};
