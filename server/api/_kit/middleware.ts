import { ORPCError, os } from "@orpc/server";

import type { InitialContext } from "@/server/api/_kit/context";
import { isExpectedApiError, toApiError } from "@/server/api/_kit/errors";
import {
  type Principal,
  resolvePrincipal,
} from "@/server/api/_kit/guards/principal";

const base = os.$context<InitialContext>();

const unauthorized = (message: string): ORPCError<"UNAUTHORIZED", undefined> =>
  new ORPCError("UNAUTHORIZED", { status: 401, message });

/**
 * Applied to every v1 procedure: app errors leave in wire form, and anything
 * unexpected is logged with the request id before the client gets a 500.
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

/** Adds `principal`, or null for an anonymous caller. */
export const withPrincipal = base.middleware(async ({ context, next }) => {
  const resolution = await resolvePrincipal(context);

  if (resolution.kind === "rejected") {
    throw unauthorized("Bearer tokens are not accepted yet.");
  }

  const principal: Principal | null =
    resolution.kind === "principal" ? resolution.principal : null;

  return next({ context: { principal } });
});

/** Adds `principal` and refuses anonymous callers with 401. */
export const requireAuth = base.middleware(async ({ context, next }) => {
  const resolution = await resolvePrincipal(context);

  if (resolution.kind === "rejected") {
    throw unauthorized("Bearer tokens are not accepted yet.");
  }
  if (resolution.kind === "anonymous") {
    throw unauthorized("Authentication is required.");
  }

  return next({ context: { principal: resolution.principal } });
});
