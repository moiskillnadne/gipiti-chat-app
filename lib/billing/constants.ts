// Central billing configuration for the currency-based, pay-per-use model.

// Multiplier applied to the raw provider USD cost when charging a user's
// balance: charge = providerUsdCost × liveFxRate × USAGE_MARKUP.
export const USAGE_MARKUP = 2;

// Currency assigned to a new user's balance until support changes it.
export const DEFAULT_CURRENCY_CODE = "RUB";

// One-time welcome grant for new users, expressed in MAJOR units of the
// default currency (e.g. 100 RUB). Credited to the persistent top-up pool so
// it never resets on renewal.
export const WELCOME_GRANT_MAJOR_UNITS = 100;

// One-time bonus granted when a user confirms their email, expressed in MAJOR
// units of the default currency (e.g. 50 RUB). Surfaced by the reward banner on
// the subscription dashboard; credited to the persistent top-up pool.
export const EMAIL_CONFIRM_BONUS_MAJOR_UNITS = 50;

// One-time bonus granted when a user completes the onboarding quiz, expressed in
// MAJOR units of the default currency (e.g. 50 RUB). Surfaced by the quiz reward
// banner once the email is confirmed; credited to the persistent top-up pool.
export const ONBOARDING_QUIZ_BONUS_MAJOR_UNITS = 50;

// Below this balance (minor units of the user's currency) an active
// subscriber is shown the "low balance" warning state on the dashboard.
// ~75 RUB by default; purely a UI cue, not an enforcement threshold.
export const LOW_BALANCE_THRESHOLD_MINOR = 7500;

// One-time balance top-up bounds, expressed in MAJOR units of the default
// currency. Enforced on the client, in the create-intent endpoint, and in the
// CloudPayments check webhook.
export const TOPUP_MIN_MAJOR_UNITS = 500;
export const TOPUP_MAX_MAJOR_UNITS = 50_000;

// Preset chip amounts offered in the top-up dialog (MAJOR units).
export const TOPUP_PRESETS_MAJOR_UNITS = [500, 1000, 2000, 5000] as const;

// Flat provider cost (USD) for a single Tavily request, by search depth.
// Charged to the balance like token usage (no separate quota).
export const SEARCH_COST_USD = {
  basic: 0.005,
  advanced: 0.015,
} as const;

export type SearchDepth = keyof typeof SEARCH_COST_USD;
