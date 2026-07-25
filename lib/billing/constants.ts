// Central billing configuration for the currency-based, pay-per-use model.

// Multiplier applied to the raw provider USD cost when charging a user's
// balance: charge = providerUsdCost × liveFxRate × USAGE_MARKUP.
export const USAGE_MARKUP = 2;

// Currency assigned to a new user's balance until support changes it.
export const DEFAULT_CURRENCY_CODE = "RUB";

// One-time welcome grant for new users, expressed in MAJOR units of the
// default currency (e.g. 50 RUB). Credited to the persistent top-up pool so
// it never resets on renewal.
//
// Deliberately the smallest of the three onboarding grants: it is the only one
// paid out before the email is confirmed, so it is the only one a throwaway
// address can farm. Value was shifted into EMAIL_CONFIRM_BONUS_MAJOR_UNITS to
// keep the headline total intact while making abuse require a real inbox.
export const WELCOME_GRANT_MAJOR_UNITS = 50;

// One-time bonus granted when a user confirms their email, expressed in MAJOR
// units of the default currency (e.g. 100 RUB). Surfaced by the reward banner on
// the subscription dashboard; credited to the persistent top-up pool.
export const EMAIL_CONFIRM_BONUS_MAJOR_UNITS = 100;

// One-time bonus granted when a user completes the onboarding quiz, expressed in
// MAJOR units of the default currency (e.g. 50 RUB). Surfaced by the quiz reward
// banner once the email is confirmed; credited to the persistent top-up pool.
export const ONBOARDING_QUIZ_BONUS_MAJOR_UNITS = 50;

// The three grants above sum to what a new user can earn in total: 200 RUB.
// Public marketing copy ("Дарим 200 ₽ каждому новому пользователю") hardcodes
// that figure in Russian prose across the landing pages, the model landings and
// messages/ru.json — it cannot interpolate a constant. If you change any grant
// above, grep the repo for "200 ₽" and update every copy site to match.

// Below this balance (minor units of the user's currency) an active
// subscriber is shown the "low balance" warning state on the dashboard.
// ~75 RUB by default; purely a UI cue, not an enforcement threshold.
export const LOW_BALANCE_THRESHOLD_MINOR = 7500;

// One-time balance top-up bounds, expressed in MAJOR units of the default
// currency. Enforced on the client, in the create-intent endpoint, and in the
// CloudPayments check webhook.
export const TOPUP_MIN_MAJOR_UNITS = 500;
export const TOPUP_MAX_MAJOR_UNITS = 50_000;

// Internal testers can charge any amount ≥ 1 ₽ to verify the production
// payment flow without paying the real minimum.
export const TOPUP_TESTER_MIN_MAJOR_UNITS = 1;

// Preset chip amounts offered in the top-up dialog (MAJOR units).
export const TOPUP_PRESETS_MAJOR_UNITS = [500, 1000, 2000, 5000] as const;

// Flat provider cost (USD) for a single Tavily request, by search depth.
// Charged to the balance like token usage (no separate quota).
export const SEARCH_COST_USD = {
  basic: 0.005,
  advanced: 0.015,
} as const;

export type SearchDepth = keyof typeof SEARCH_COST_USD;
