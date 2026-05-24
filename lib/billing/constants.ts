// Central billing configuration for the currency-based, pay-per-use model.

// Multiplier applied to the raw provider USD cost when charging a user's
// balance: charge = providerUsdCost × liveFxRate × USAGE_MARKUP.
export const USAGE_MARKUP = 3;

// Currency assigned to a new user's balance until support changes it.
export const DEFAULT_CURRENCY_CODE = "RUB";

// One-time welcome grant for new users, expressed in MAJOR units of the
// default currency (e.g. 100 RUB). Credited to the persistent top-up pool so
// it never resets on renewal.
export const WELCOME_GRANT_MAJOR_UNITS = 100;

// Flat provider cost (USD) for a single Tavily request, by search depth.
// Charged to the balance like token usage (no separate quota).
export const SEARCH_COST_USD = {
  basic: 0.008,
  advanced: 0.016,
} as const;

export type SearchDepth = keyof typeof SEARCH_COST_USD;
