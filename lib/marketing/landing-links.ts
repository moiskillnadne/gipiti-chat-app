/**
 * Links that point back at the landing page itself (`/` or a `/#section`
 * anchor). Prefetching them from the landing re-downloads the page's own RSC
 * payload once per link, so they opt out of viewport prefetch.
 */
export const isLandingSectionLink = (href: string): boolean =>
  href === "/" || href.startsWith("/#");
