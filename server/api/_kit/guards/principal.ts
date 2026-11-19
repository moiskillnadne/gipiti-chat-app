import type { InitialContext } from "@/server/api/_kit/context";

/** Who is calling. */
export type Principal = {
  userId: string;
  /** The API session of a bearer caller; null for a browser session. */
  sessionId: string | null;
  via: "cookie" | "bearer" | "in-process";
};

export type PrincipalResolution =
  | { kind: "principal"; principal: Principal }
  | { kind: "anonymous" }
  | { kind: "rejected"; reason: "bearer_not_supported" };

const AUTHORIZATION_HEADER = "authorization";

/**
 * Work out who is calling from the request.
 *
 * A request that carries an `Authorization` header is judged by that header
 * alone; its cookies are never consulted, so a client cannot end up acting as
 * the browser's user by accident. Bearer tokens are not issued yet (roadmap
 * Phase 4), so for now such a request is rejected.
 *
 * Without the header, the session cookie decides.
 */
export const resolvePrincipal = async ({
  request,
  transport,
  getCookieSession,
}: Pick<
  InitialContext,
  "request" | "transport" | "getCookieSession"
>): Promise<PrincipalResolution> => {
  if (request.headers.has(AUTHORIZATION_HEADER)) {
    return { kind: "rejected", reason: "bearer_not_supported" };
  }

  const session = await getCookieSession();
  if (!session) {
    return { kind: "anonymous" };
  }

  return {
    kind: "principal",
    principal: {
      userId: session.userId,
      sessionId: null,
      via: transport === "in-process" ? "in-process" : "cookie",
    },
  };
};
