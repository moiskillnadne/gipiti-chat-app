/** Width/height pair parsed from a "W:H" aspect-ratio token. */
export type AspectRatioDimensions = {
  width: number;
  height: number;
};

const ASPECT_TOKEN_PATTERN = /^(\d+):(\d+)$/;

/**
 * Parse a "W:H" aspect-ratio token (e.g. "16:9"). Returns null for a missing,
 * malformed, or zero-sized token.
 */
export const parseAspectRatio = (
  token?: string
): AspectRatioDimensions | null => {
  const match = token ? ASPECT_TOKEN_PATTERN.exec(token) : null;
  if (!match) {
    return null;
  }
  const width = Number.parseInt(match[1], 10);
  const height = Number.parseInt(match[2], 10);
  if (!(width > 0 && height > 0)) {
    return null;
  }
  return { width, height };
};
