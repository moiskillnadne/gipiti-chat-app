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
 * Check if password reset request is rate limited
 * @param email The email address requesting password reset
 * @returns Object with success status and remaining attempts
 */
export async function checkPasswordResetRateLimit(email: string): Promise<{
  success: boolean;
  remaining?: number;
  reset?: number;
}> {
  // If rate limiter is not configured, allow the request
  if (!passwordResetRateLimiter) {
    console.warn(
      "Rate limiting is not configured. Please set one of the following:\n" +
        "1. KV_REST_API_URL and KV_REST_API_TOKEN, or\n" +
        "2. REDIS_URL (with Upstash REST format)\n" +
        "Password reset requests will proceed without rate limiting."
    );
    return { success: true };
  }

  try {
    // Check rate limit using email as identifier
    const { success, remaining, reset } = await passwordResetRateLimiter.limit(
      email.toLowerCase()
    );

    return {
      success,
      remaining,
      reset,
    };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    // If rate limiting fails, allow the request to proceed
    // Better to have a temporarily broken rate limit than block legitimate users
    return { success: true };
  }
}

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
 * Check if verification resend request is rate limited
 * @param email The email address requesting verification resend
 * @returns Object with success status and remaining attempts
 */
export async function checkVerificationResendRateLimit(email: string): Promise<{
  success: boolean;
  remaining?: number;
  reset?: number;
}> {
  // If rate limiter is not configured, allow the request
  if (!verificationResendRateLimiter) {
    console.warn(
      "Rate limiting is not configured. Verification resend requests will proceed without rate limiting."
    );
    return { success: true };
  }

  try {
    // Check rate limit using email as identifier
    const { success, remaining, reset } =
      await verificationResendRateLimiter.limit(email.toLowerCase());

    return {
      success,
      remaining,
      reset,
    };
  } catch (error) {
    console.error("Error checking verification resend rate limit:", error);
    return { success: true };
  }
}

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
 * Check if payment status request is rate limited
 * @param identifier The IP address or user ID checking payment status
 * @returns Object with success status and remaining attempts
 */
export async function checkPaymentStatusRateLimit(identifier: string): Promise<{
  success: boolean;
  remaining?: number;
  reset?: number;
}> {
  // If rate limiter is not configured, allow the request
  if (!paymentStatusRateLimiter) {
    console.warn(
      "Payment status rate limiting is not configured. Requests will proceed without rate limiting."
    );
    return { success: true };
  }

  try {
    // Check rate limit using identifier (IP or sessionId)
    const { success, remaining, reset } =
      await paymentStatusRateLimiter.limit(identifier);

    return {
      success,
      remaining,
      reset,
    };
  } catch (error) {
    console.error("Error checking payment status rate limit:", error);
    return { success: true };
  }
}

/**
 * Check if a user's POST /api/chat request is rate limited. Like the other
 * limiters here, the request is allowed when Redis is not configured or the
 * check itself fails.
 * @param userId The authenticated user sending the message
 * @returns Object with success status and remaining requests
 */
export async function checkChatRateLimit(userId: string): Promise<{
  success: boolean;
  remaining?: number;
  reset?: number;
}> {
  if (!chatRequestRateLimiter) {
    return { success: true };
  }

  try {
    const { success, remaining, reset } =
      await chatRequestRateLimiter.limit(userId);

    return { success, remaining, reset };
  } catch (error) {
    console.error("Error checking chat rate limit:", { userId, error });
    return { success: true };
  }
}
