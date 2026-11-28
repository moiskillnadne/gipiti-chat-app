import { ORPCError, os } from "@orpc/server";
import { unstable_rethrow } from "next/navigation";

import type { InitialContext } from "@/server/api/_kit/context";
import { isExpectedApiError, toApiError } from "@/server/api/_kit/errors";
import {
  hasSameOriginProof,
  isStateChanging,
} from "@/server/api/_kit/guards/csrf";
import {
  type Principal,
  type PrincipalRejection,
  resolvePrincipal,
} from "@/server/api/_kit/guards/principal";

const base = os.$context<InitialContext>();

const REJECTION_MESSAGES: Record<PrincipalRejection, string> = {
  invalid_token: "The access token is not valid or has expired.",
  unsupported_authorization:
    "The Authorization header must be `Bearer <access token>`.",
};

const unauthorized = (
  message: string,
  reason: string
): ORPCError<string, unknown> =>
  new ORPCError("UNAUTHORIZED", { status: 401, message, data: { reason } });

/**
 * Who is calling, or null for nobody. Refuses, instead of answering:
 *
 * - a request whose `Authorization` header does not prove an identity (401);
 * - a browser session on a state-changing request that does not show it was
 *   made by a page of this site (403). The check lives here, not in each
 *   procedure, so that no procedure can forget it.
 */
const identifyCaller = async (
  context: InitialContext
): Promise<Principal | null> => {
  const resolution = await resolvePrincipal(context);

  if (resolution.kind === "rejected") {
    throw unauthorized(
      REJECTION_MESSAGES[resolution.reason],
      resolution.reason
    );
  }
  if (resolution.kind === "anonymous") {
    return null;
  }

  const { principal } = resolution;
  const needsSameOriginProof =
    principal.via === "cookie" && isStateChanging(context.request);

  if (needsSameOriginProof && !hasSameOriginProof(context.request)) {
    throw new ORPCError("FORBIDDEN", {
      status: 403,
      message: "This request must be made by a page of this site.",
      data: { reason: "cross_site_request" },
    });
  }

  return principal;
};

const READ_ONLY_METHODS = new Set(["GET", "HEAD"]);

/**
 * The in-process caller (`server-caller.ts`) is read-only: it acts on the
 * browser's cookie with no same-origin check and no client IP, so a
 * procedure that changes something must go through HTTP. The route method
 * is read from the procedure's own definition; a procedure that states none
 * is POST in oRPC, so it is refused too. A programming error, not a wire
 * error: it surfaces as a logged 500.
 */
const assertReadableInProcess = (
  context: InitialContext,
  path: readonly string[],
  method: string | undefined
): void => {
  if (
    context.transport === "in-process" &&
    !READ_ONLY_METHODS.has(method ?? "POST")
  ) {
    throw new Error(
      `The in-process caller is read-only: "${path.join(".")}" is a ${method ?? "POST"} procedure. Call it over HTTP.`
    );
  }
};

/**
 * Turns whatever a procedure throws into the wire error, and writes a server
 * log line for the ones the caller cannot fix. Attached to every procedure.
 * Also refuses a non-GET procedure on the in-process transport.
 */
export const handleErrors = base.middleware(
  async ({ context, next, path, procedure }) => {
    try {
      assertReadableInProcess(context, path, procedure["~orpc"].route.method);

      return await next();
    } catch (error) {
      // Next's own control flow (a dynamic-usage bailout from `headers()`
      // during a prerender, `redirect()`, `notFound()`) must reach Next.
      unstable_rethrow(error);

      const apiError = toApiError(error);

      if (!isExpectedApiError(apiError)) {
        console.error(`[api:v1] request ${context.requestId} failed:`, error);
      }

      throw apiError;
    }
  }
);

/** For procedures that answer anonymous callers too: `principal` may be null. */
export const withPrincipal = base.middleware(async ({ context, next }) =>
  next({ context: { principal: await identifyCaller(context) } })
);

/** For procedures that need a signed-in user. */
export const requireAuth = base.middleware(async ({ context, next }) => {
  const principal = await identifyCaller(context);

  if (!principal) {
    throw unauthorized("Authentication is required.", "not_authenticated");
  }

  return next({ context: { principal } });
});
