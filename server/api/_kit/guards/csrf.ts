const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SAME_ORIGIN = "same-origin";

/** The host the client addressed, as the app sees it behind the platform. */
const requestHostOf = (request: Request): string =>
  request.headers.get("x-forwarded-host") ??
  request.headers.get("host") ??
  new URL(request.url).host;

const originHostOf = (request: Request): string | null => {
  const origin = request.headers.get("origin");
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
};

/** Whether the method can change something, so that forging it is worth it. */
export const isStateChanging = (request: Request): boolean =>
  !SAFE_METHODS.has(request.method.toUpperCase());

/**
 * Whether a request shows that it was made by a page of this site.
 *
 * A browser attaches the session cookie to a request whoever started it, so
 * a cookie alone does not prove that the user meant the request. Browsers
 * also say where a request comes from, in headers a page cannot set:
 *
 * - `Sec-Fetch-Site`: when present it must be `same-origin`;
 * - otherwise `Origin`, whose host must be the host that was addressed.
 *
 * A request with neither is refused. A caller with a bearer token is not
 * asked for this: a token is sent only by code that holds it.
 */
export const hasSameOriginProof = (request: Request): boolean => {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null) {
    return fetchSite === SAME_ORIGIN;
  }

  const originHost = originHostOf(request);

  return originHost !== null && originHost === requestHostOf(request);
};
