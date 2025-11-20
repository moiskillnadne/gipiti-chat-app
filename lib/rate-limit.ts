import { Ratelimit } from "@upstash/ratelimit";
import { getUpstashClient } from "@/lib/redis";

// Initialize rate limiters with Upstash client
let passwordResetRateLimiter: Ratelimit | null = null;
let verificationResendRateLimiter: Ratelimit | null = null;

const upstashClient = getUpstashClient();
if (upstashClient) {
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
