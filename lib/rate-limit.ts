import { Ratelimit } from "@upstash/ratelimit";
import { getUpstashClient } from "@/lib/redis";

// POST /api/chat: requests per user per sliding window.
const CHAT_REQUEST_LIMIT = 30;
const CHAT_REQUEST_WINDOW = "1 m";

// Initialize rate limiters with Upstash client
let passwordResetRateLimiter: Ratelimit | null = null;
let verificationResendRateLimiter: Ratelimit | null = null;
let paymentStatusRateLimiter: Ratelimit | null = null;
let chatRequestRateLimiter: Ratelimit | null = null;

const upstashClient = getUpstashClient();
if (upstashClient) {
  chatRequestRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(CHAT_REQUEST_LIMIT, CHAT_REQUEST_WINDOW),
    analytics: true,
    prefix: "ratelimit:chat",
  });

  passwordResetRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    analytics: true,
    prefix: "ratelimit:password-reset",
  });

  verificationResendRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.fixedWindow(1, "60 s"),
    analytics: true,
    prefix: "ratelimit:verification-resend",
  });

  paymentStatusRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(120, "1 m"),
    analytics: true,
    prefix: "ratelimit:payment-status",
  });
}

/**
 * True when the limiters below are backed by Upstash. When false nothing is
 * rate limited: fail-open checks let every request through, and fail-closed
 * checks refuse every request in production (see `LimiterPolicy`).
 */
export const isRateLimitingEnabled = (): boolean => upstashClient !== null;

let hasWarnedRateLimitingDisabled = false;

/**
 * Log, once per server instance, that requests are not being rate limited.
 * Called from every check so the gap shows up in the logs on first use
 * without a line per request.
 */
const warnRateLimitingDisabledOnce = (): void => {
  if (hasWarnedRateLimitingDisabled) {
    return;
  }
  hasWarnedRateLimitingDisabled = true;
  console.warn(
    "[RateLimit] Rate limiting is DISABLED: no Upstash REST client. " +
      "Set KV_REST_API_URL and KV_REST_API_TOKEN (or an https:// REDIS_URL " +
      "with REDIS_TOKEN). Chat and payment status requests are not rate " +
      "limited. Password reset and verification resend are not rate limited " +
      "either, except in production, where they are refused."
  );
};

export type RateLimitResult = {
  success: boolean;
  remaining?: number;
  reset?: number;
  /**
   * True when the request was refused because the limiter itself could not be
   * asked (no Upstash client, or the check threw), not because a limit was
   * hit. Only fail-closed limiters in production ever set it.
   */
  isUnavailable?: boolean;
};

/**
 * What a limiter answers when it cannot be checked.
 *
 * `fail-open` lets the request through: a broken limiter must not take the
 * chat or a payment page down. `fail-closed` refuses it, for the auth flows
 * where an attacker gains from the limiter being off (code and password
 * guessing, mail flooding). Refusing applies in production only: previews and
 * local runs often have no Upstash.
 */
type LimiterPolicy = "fail-open" | "fail-closed";

const PRODUCTION_ENVIRONMENT = "production";

const resultWhenUnavailable = (policy: LimiterPolicy): RateLimitResult => {
  const isProduction = process.env.VERCEL_ENV === PRODUCTION_ENVIRONMENT;

  return policy === "fail-closed" && isProduction
    ? { success: false, isUnavailable: true }
    : { success: true };
};

const checkLimit = async ({
  limiter,
  key,
  policy,
  label,
}: {
  limiter: Ratelimit | null;
  key: string;
  policy: LimiterPolicy;
  label: string;
}): Promise<RateLimitResult> => {
  if (!limiter) {
    warnRateLimitingDisabledOnce();
    return resultWhenUnavailable(policy);
  }

  try {
    const { success, remaining, reset } = await limiter.limit(key);

    return { success, remaining, reset };
  } catch (error) {
    console.error(`[RateLimit] The ${label} check failed:`, error);
    return resultWhenUnavailable(policy);
  }
};

/**
 * Check if a password reset request is rate limited. Refuses in production
 * when the limiter cannot be checked.
 * @param email The email address requesting password reset
 */
export const checkPasswordResetRateLimit = (
  email: string
): Promise<RateLimitResult> =>
  checkLimit({
    limiter: passwordResetRateLimiter,
    key: email.toLowerCase(),
    policy: "fail-closed",
    label: "password reset",
  });

/**
 * Get remaining time until rate limit resets (in minutes)
 * @param resetTimestamp Unix timestamp when rate limit resets
 * @returns Minutes until reset
 */
export function getRateLimitResetMinutes(resetTimestamp?: number): number {
  if (!resetTimestamp) {
    return 0;
  }
  const now = Date.now();
  const diff = resetTimestamp - now;
  return Math.ceil(diff / 1000 / 60);
}

/**
 * Check if a verification resend request is rate limited. Refuses in
 * production when the limiter cannot be checked.
 * @param email The email address requesting verification resend
 */
export const checkVerificationResendRateLimit = (
  email: string
): Promise<RateLimitResult> =>
  checkLimit({
    limiter: verificationResendRateLimiter,
    key: email.toLowerCase(),
    policy: "fail-closed",
    label: "verification resend",
  });

/**
 * Get remaining time until rate limit resets (in seconds)
 * @param resetTimestamp Unix timestamp when rate limit resets
 * @returns Seconds until reset
 */
export function getRateLimitResetSeconds(resetTimestamp?: number): number {
  if (!resetTimestamp) {
    return 0;
  }
  const now = Date.now();
  const diff = resetTimestamp - now;
  return Math.ceil(diff / 1000);
}

/**
 * Check if a payment status request is rate limited. The request is allowed
 * when the limiter cannot be checked.
 * @param identifier The IP address or user ID checking payment status
 */
export const checkPaymentStatusRateLimit = (
  identifier: string
): Promise<RateLimitResult> =>
  checkLimit({
    limiter: paymentStatusRateLimiter,
    key: identifier,
    policy: "fail-open",
    label: "payment status",
  });

/**
 * Check if a user's POST /api/chat request is rate limited. The request is
 * allowed when the limiter cannot be checked.
 * @param userId The authenticated user sending the message
 */
export const checkChatRateLimit = (userId: string): Promise<RateLimitResult> =>
  checkLimit({
    limiter: chatRequestRateLimiter,
    key: userId,
    policy: "fail-open",
    label: "chat",
  });
