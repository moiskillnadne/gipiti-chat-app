/** The signed-in user of a browser session, as the session cookie names it. */
export type CookieSession = {
  userId: string;
};

/**
 * What every v1 procedure is given before any middleware has run.
 *
 * `getCookieSession` is supplied by the route file. The auth module still
 * lives under `app/`, which code in `server/` must not import; the route file
 * may, so it hands the session reader down. The indirection goes away when
 * the auth module moves under `server/` (roadmap Phase 4a).
 */
export type InitialContext = {
  request: Request;
  /** `in-process` is a server component calling a procedure without HTTP. */
  transport: "http" | "in-process";
  /** Echoed in `X-Request-Id` and in the server log line of an error. */
  requestId: string;
  getCookieSession: () => Promise<CookieSession | null>;
};
