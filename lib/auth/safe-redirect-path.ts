/** Where a user lands after login when no usable target was given. */
export const DEFAULT_REDIRECT_PATH = "/chat";

/**
 * Turn a `callbackUrl` query value into a path on this site.
 *
 * The value comes from the address bar, so anyone can put anything there and
 * send the link to a user. It is always parsed the way a browser would parse
 * it and kept only when it resolves to `origin`. A check such as "starts with
 * a slash" is not enough: `//host`, `/\host` and `/<tab>/host` all start with
 * a slash and all name another host.
 *
 * @param callbackUrl - the raw query value, absolute or relative
 * @param origin - this site's origin, for example `window.location.origin`
 * @returns path, query and fragment on this site, or `DEFAULT_REDIRECT_PATH`
 */
export const getSafeRedirectPath = (
  callbackUrl: string | null | undefined,
  origin: string
): string => {
  if (!(callbackUrl && URL.canParse(callbackUrl, origin))) {
    return DEFAULT_REDIRECT_PATH;
  }

  const target = new URL(callbackUrl, origin);

  if (target.origin !== new URL(origin).origin) {
    return DEFAULT_REDIRECT_PATH;
  }

  // `/.//host` stays on this origin but normalises to the path `//host`,
  // which a browser would read as another host when it is navigated to.
  if (target.pathname.startsWith("//")) {
    return DEFAULT_REDIRECT_PATH;
  }

  return `${target.pathname}${target.search}${target.hash}`;
};
