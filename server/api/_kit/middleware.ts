import { ORPCError, os } from "@orpc/server";

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

/**
 * Turns whatever a procedure throws into the wire error, and writes a server
 * log line for the ones the caller cannot fix. Attached to every procedure.
 */
export const handleErrors = base.middleware(async ({ context, next }) => {
  try {
    return await next();
  } catch (error) {
    const apiError = toApiError(error);

    if (!isExpectedApiError(apiError)) {
      console.error(`[api:v1] request ${context.requestId} failed:`, error);
    }

    throw apiError;
  }
});

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
