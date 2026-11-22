/** What every v1 procedure is given before any middleware has run. */
export type InitialContext = {
  request: Request;
  /** `in-process` is a server component calling a procedure without HTTP. */
  transport: "http" | "in-process";
  /** Echoed in `X-Request-Id` and in the server log line of an error. */
  requestId: string;
};
