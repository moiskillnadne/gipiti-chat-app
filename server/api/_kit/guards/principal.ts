import type { InitialContext } from "@/server/api/_kit/context";
import { getCookieSessionUserId } from "@/server/modules/auth/cookie-session";
import { resolveBearerSession } from "@/server/modules/auth/sessions";

/** Who is calling. */
export type Principal = {
  userId: string;
  /** The API session of a bearer caller; null for a browser session. */
  sessionId: string | null;
  via: "cookie" | "bearer" | "in-process";
};

export type PrincipalRejection =
  /** A bearer token that is not ours, has expired, or whose session ended. */
  | "invalid_token"
  /** An `Authorization` header that is not `Bearer <token>`. */
  | "unsupported_authorization";

export type PrincipalResolution =
  | { kind: "principal"; principal: Principal }
  | { kind: "anonymous" }
  | { kind: "rejected"; reason: PrincipalRejection };

const AUTHORIZATION_HEADER = "authorization";
const BEARER_PATTERN = /^Bearer +(\S+)$/i;

/**
 * Work out who is calling from the request.
 *
 * A request that carries an `Authorization` header is judged by that header
 * alone. Its cookies are never consulted, not even when the token is bad: a
 * client must not end up acting as the browser's user by accident, and a
 * request that tried to prove who it is and failed is refused, not treated
 * as anonymous.
 *
 * Without the header, the session cookie decides. An in-process call
 * (`transport: "in-process"`, see `server-caller.ts`) skips the header too:
 * it only ever acts as the cookie session's user.
 */
export const resolvePrincipal = async ({
  request,
  transport,
}: Pick<
  InitialContext,
  "request" | "transport"
>): Promise<PrincipalResolution> => {
  // An in-process call is made by our own server code on behalf of the
  // browser session. A token is never read there, whatever the request holds.
  const authorization =
    transport === "in-process"
      ? null
      : request.headers.get(AUTHORIZATION_HEADER);

  if (authorization !== null) {
    const accessToken = BEARER_PATTERN.exec(authorization.trim())?.[1];
    if (!accessToken) {
      return { kind: "rejected", reason: "unsupported_authorization" };
    }

    const session = await resolveBearerSession(accessToken);
    if (!session) {
      return { kind: "rejected", reason: "invalid_token" };
    }

    return {
      kind: "principal",
      principal: {
        userId: session.userId,
        sessionId: session.sessionId,
        via: "bearer",
      },
    };
  }

  const userId = await getCookieSessionUserId();
  if (!userId) {
    return { kind: "anonymous" };
  }

  return {
    kind: "principal",
    principal: {
      userId,
      sessionId: null,
      via: transport === "in-process" ? "in-process" : "cookie",
    },
  };
};
