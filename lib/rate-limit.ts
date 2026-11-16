import { Ratelimit } from "@upstash/ratelimit";
import { toRateLimitIpKey } from "@/lib/http/client-ip";
import { getUpstashClient } from "@/lib/redis";

// POST /api/chat: requests per user per sliding window.
const CHAT_REQUEST_LIMIT = 30;
const CHAT_REQUEST_WINDOW = "1 m";

// Initialize rate limiters with Upstash client
let passwordResetRateLimiter: Ratelimit | null = null;
let verificationResendRateLimiter: Ratelimit | null = null;
let verificationAttemptRateLimiter: Ratelimit | null = null;
let loginPairRateLimiter: Ratelimit | null = null;
let loginIpRateLimiter: Ratelimit | null = null;
let loginEmailRateLimiter: Ratelimit | null = null;
let registerIpRateLimiter: Ratelimit | null = null;
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

  // Checks of an email verification code per address. A code already dies
  // after 5 checks, but a new code can be requested every minute; this caps
  // how many guesses an hour of that buys.
  verificationAttemptRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(10, "1 h"),
    analytics: true,
    prefix: "ratelimit:verification-attempt",
  });

  // Login attempts for one account from one address. Reset by a successful
  // login, so only a run of wrong passwords reaches the limit.
  loginPairRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(10, "15 m"),
    analytics: true,
    prefix: "ratelimit:login-pair",
  });

  // Failed logins from one address, across all accounts (password spraying).
  loginIpRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(60, "15 m"),
    analytics: true,
    prefix: "ratelimit:login-ip",
  });

  // Failed logins for one account, from any address. Past it every attempt
  // on the account is slowed down, never refused: refusing would let anyone
  // lock a user out by guessing wrong on purpose.
  loginEmailRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(50, "1 h"),
    analytics: true,
    prefix: "ratelimit:login-email",
  });

  // Sign-ups from one address. Loose on purpose: mobile carriers put many
  // people behind one IPv4 address.
  registerIpRateLimiter = new Ratelimit({
    redis: upstashClient,
    limiter: Ratelimit.slidingWindow(20, "1 h"),
    analytics: true,
    prefix: "ratelimit:register-ip",
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
      "limited. Password reset, verification resend, verification code " +
      "checks, login and sign-up are not rate limited either, except in " +
      "production, where they are refused."
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
 * Check if a verification code check is rate limited. Refuses in production
 * when the limiter cannot be checked.
 * @param email The email address whose code is being checked
 */
export const checkVerificationAttemptRateLimit = (
  email: string
): Promise<RateLimitResult> =>
  checkLimit({
    limiter: verificationAttemptRateLimiter,
    key: email.toLowerCase(),
    policy: "fail-closed",
    label: "verification attempt",
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
 * Like `checkLimit`, but only looks: no attempt is counted.
 */
const peekLimit = async ({
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
    const { remaining, reset } = await limiter.getRemaining(key);

    return { success: remaining > 0, remaining, reset };
  } catch (error) {
    console.error(`[RateLimit] The ${label} check failed:`, error);
    return resultWhenUnavailable(policy);
  }
};

const VERCEL_ENVIRONMENTS_WITH_SIGN_IN_LIMITS = ["production", "preview"];

/**
 * The login and sign-up limits apply only on deployed environments. Locally
 * and in CI the e2e suite signs in with wrong passwords on purpose, many times
 * from one address, and would lock its own test account out.
 */
const areSignInLimitsEnforced = (): boolean =>
  VERCEL_ENVIRONMENTS_WITH_SIGN_IN_LIMITS.includes(
    process.env.VERCEL_ENV ?? ""
  );

const UNKNOWN_IP_KEY = "unknown";

export type LoginIdentity = {
  /** The email as typed on the form. */
  email: string;
  /** From `getClientIp`; null when the platform reported no address. */
  ip: string | null;
};

export type LoginAttemptDecision = {
  isAllowed: boolean;
  /** Refused because a limiter could not be checked, not because of a limit. */
  isUnavailable: boolean;
  /** The account is under a slow guessing attack: answer, but slowly. */
  shouldDelay: boolean;
};

const loginKeysOf = ({
  email,
  ip,
}: LoginIdentity): {
  emailKey: string;
  ipKey: string | null;
  pairKey: string;
} => {
  const emailKey = email.trim().toLowerCase();
  const ipKey = ip ? toRateLimitIpKey(ip) : null;

  return { emailKey, ipKey, pairKey: `${emailKey}|${ipKey ?? UNKNOWN_IP_KEY}` };
};

/**
 * Decide whether a login attempt may check the password, and count it.
 *
 * Three limits (numbers next to the limiters above):
 * - account + address: counted here, before the password is checked, so a
 *   burst of parallel guesses cannot all slip past it; a successful login
 *   resets it (`recordSuccessfulLogin`);
 * - address: only failures count (`recordFailedLogin`), so many people
 *   behind one address signing in normally never reach it;
 * - account: only failures count; past it the attempt is delayed, not refused.
 *
 * The first two refuse in production when the limiter cannot be checked.
 */
export const beginLoginAttempt = async (
  identity: LoginIdentity
): Promise<LoginAttemptDecision> => {
  if (!areSignInLimitsEnforced()) {
    return { isAllowed: true, isUnavailable: false, shouldDelay: false };
  }

  const { emailKey, ipKey, pairKey } = loginKeysOf(identity);
  const [pairLimit, ipLimit, emailLimit] = await Promise.all([
    checkLimit({
      limiter: loginPairRateLimiter,
      key: pairKey,
      policy: "fail-closed",
      label: "login (account and address)",
    }),
    ipKey
      ? peekLimit({
          limiter: loginIpRateLimiter,
          key: ipKey,
          policy: "fail-closed",
          label: "login (address)",
        })
      : Promise.resolve<RateLimitResult>({ success: true }),
    peekLimit({
      limiter: loginEmailRateLimiter,
      key: emailKey,
      policy: "fail-open",
      label: "login (account)",
    }),
  ]);

  return {
    isAllowed: pairLimit.success && ipLimit.success,
    isUnavailable: Boolean(pairLimit.isUnavailable || ipLimit.isUnavailable),
    shouldDelay: !emailLimit.success,
  };
};

/**
 * Count a wrong password (or an unknown account) against the address and the
 * account. Never throws: a limiter failure must not turn a wrong password
 * into a server error.
 */
export const recordFailedLogin = async (
  identity: LoginIdentity
): Promise<void> => {
  if (!areSignInLimitsEnforced()) {
    return;
  }

  const { emailKey, ipKey } = loginKeysOf(identity);

  await Promise.all([
    ipKey
      ? checkLimit({
          limiter: loginIpRateLimiter,
          key: ipKey,
          policy: "fail-open",
          label: "failed login (address)",
        })
      : Promise.resolve(),
    checkLimit({
      limiter: loginEmailRateLimiter,
      key: emailKey,
      policy: "fail-open",
      label: "failed login (account)",
    }),
  ]);
};

/**
 * Give the account + address limit back after a successful login, so signing
 * in normally never adds up to a block. Never throws.
 */
export const recordSuccessfulLogin = async (
  identity: LoginIdentity
): Promise<void> => {
  if (!(areSignInLimitsEnforced() && loginPairRateLimiter)) {
    return;
  }

  try {
    await loginPairRateLimiter.resetUsedTokens(loginKeysOf(identity).pairKey);
  } catch (error) {
    console.error("[RateLimit] Resetting the login limit failed:", error);
  }
};

/**
 * Check if a sign-up from this address is rate limited. Refuses in production
 * when the limiter cannot be checked. Without an address there is nothing to
 * key on, and the sign-up is allowed.
 * @param ip From `getClientIp`
 */
export const checkRegisterRateLimit = (
  ip: string | null
): Promise<RateLimitResult> => {
  if (!(areSignInLimitsEnforced() && ip)) {
    return Promise.resolve({ success: true });
  }

  return checkLimit({
    limiter: registerIpRateLimiter,
    key: toRateLimitIpKey(ip),
    policy: "fail-closed",
    label: "sign-up",
  });
};

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
