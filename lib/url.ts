/**
 * Extract the hostname from a URL string. Falls back to the input on parse failure.
 */
export const extractDomain = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * Build a Google s2 favicon URL for a given domain.
 */
export const faviconUrl = (domain: string, size = 64): string =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
