type TokenUnit = "K" | "M";

interface FormatOptions {
  maxUnit?: TokenUnit;
}

/**
 * Format token balance for display (client-safe)
 * This is a pure utility function with no server dependencies
 *
 * @param tokens - Number of tokens to format
 * @param options.maxUnit - Maximum unit to use ('K' or 'M'). If 'K', never rounds to millions.
 */
export function formatTokenBalance(
  tokens: number,
  options?: FormatOptions
): string {
  const maxUnit = options?.maxUnit;

  // If maxUnit is 'K', never use M formatting
  if (tokens >= 1_000_000 && maxUnit !== "K") {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000;
    // For large K values, use locale formatting for readability (1,970K)
    return `${k >= 100 ? Math.round(k).toLocaleString() : Math.round(k)}K`;
  }
  return tokens.toLocaleString();
}
