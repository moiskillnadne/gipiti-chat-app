import { Redis as UpstashRedis } from "@upstash/redis";

// Singleton instances
let upstashClient: UpstashRedis | null = null;

/**
 * Get Upstash Redis client for REST API operations (rate limiting, etc.)
 * Uses KV_REST_API_URL/TOKEN or parses REDIS_URL if it's in Upstash format
 */
export function getUpstashClient(): UpstashRedis | null {
  if (upstashClient) {
    return upstashClient;
  }

  try {
    // Option 1: Use explicit REST API credentials (preferred)
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      upstashClient = new UpstashRedis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      });
      return upstashClient;
    }

    // Option 2: Try to parse REDIS_URL as Upstash REST endpoint
    if (process.env.REDIS_URL) {
      const redisUrl = process.env.REDIS_URL;

      // Check if it's an HTTP/HTTPS URL (Upstash REST format)
      if (redisUrl.startsWith("http://") || redisUrl.startsWith("https://")) {
        const url = new URL(redisUrl);
        const token = url.password || process.env.REDIS_TOKEN;

        if (token) {
          upstashClient = new UpstashRedis({
            url: `${url.protocol}//${url.host}`,
            token,
          });
          return upstashClient;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn("Failed to initialize Upstash Redis client:", error);
    return null;
  }
}

/**
 * Check if any Redis configuration is available
 */
export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.REDIS_URL ||
      (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  );
}

/**
 * Check if ioredis (standard Redis) is configured
 */
export function isIoRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

/**
 * Check if Upstash REST API is configured
 */
export function isUpstashConfigured(): boolean {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return true;
  }

  if (process.env.REDIS_URL) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl.startsWith("http://") || redisUrl.startsWith("https://")) {
      const url = new URL(redisUrl);
      return Boolean(url.password || process.env.REDIS_TOKEN);
    }
  }

  return false;
}
