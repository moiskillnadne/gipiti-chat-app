import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Redis client
let redis: Redis | null = null;
let passwordResetRateLimiter: Ratelimit | null = null;

// Try to initialize Redis with either REST credentials or REDIS_URL
try {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // Use explicit REST API credentials (preferred)
    redis = new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  } else if (process.env.REDIS_URL) {
    // Try to parse REDIS_URL as Upstash REST endpoint
    // Upstash REST URLs look like: https://xxx.upstash.io
    // If REDIS_URL is a redis:// URL, this won't work but won't crash
    const redisUrl = process.env.REDIS_URL;

    // Check if it's an HTTP/HTTPS URL (Upstash REST format)
    if (redisUrl.startsWith("http://") || redisUrl.startsWith("https://")) {
      // Extract URL and token from connection string if available
      // Upstash format: https://:token@host
      const url = new URL(redisUrl);
      const token = url.password || process.env.REDIS_TOKEN;

      if (token) {
        redis = new Redis({
          url: `${url.protocol}//${url.host}`,
          token,
        });
      }
    }
  }

  // Create rate limiter if Redis was successfully initialized
  if (redis) {
    passwordResetRateLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      analytics: true,
      prefix: "ratelimit:password-reset",
    });
  }
} catch (error) {
  console.warn("Failed to initialize Redis for rate limiting:", error);
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
