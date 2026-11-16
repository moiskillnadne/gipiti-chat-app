import { sql } from "drizzle-orm";
import { db } from "@/lib/db/connection";
import { isRateLimitingEnabled } from "@/lib/rate-limit";
import { getUpstashClient, isUpstashConfigured } from "@/lib/redis";

type CheckStatus = "up" | "down";

/**
 * This endpoint is public and unauthenticated, so a check reports only that
 * it failed. The reason (a driver message with a host name in it, the name of
 * a missing variable) goes to the server log.
 */
type HealthCheck = {
  status: CheckStatus;
  latency?: number;
  error?: string;
};

/**
 * Not a dependency check: reports whether requests are rate limited at all.
 * The limiters fail open, so without an Upstash REST client they are off and
 * nothing else in this response would say so.
 */
type RateLimitingCheck = {
  enabled: boolean;
};

type HealthResponse = {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    environment: HealthCheck;
    rateLimiting: RateLimitingCheck;
  };
};

const REQUIRED_ENV_VARS = ["POSTGRES_URL"];

const DATABASE_CHECK_FAILED = "Database check failed";
const REDIS_CHECK_FAILED = "Redis check failed";
const ENVIRONMENT_CHECK_FAILED = "Required configuration is missing";

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "up", latency: Date.now() - start };
  } catch (error) {
    console.error("[Health] Database check failed:", error);
    return {
      status: "down",
      latency: Date.now() - start,
      error: DATABASE_CHECK_FAILED,
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  if (!isUpstashConfigured()) {
    return { status: "up", error: "Redis not configured (optional)" };
  }

  const start = Date.now();
  try {
    const client = getUpstashClient();
    if (!client) {
      return { status: "up", error: "Redis client unavailable (optional)" };
    }
    await client.ping();
    return { status: "up", latency: Date.now() - start };
  } catch (error) {
    console.error("[Health] Redis check failed:", error);
    return {
      status: "down",
      latency: Date.now() - start,
      error: REDIS_CHECK_FAILED,
    };
  }
}

function checkEnvironment(): HealthCheck {
  const missing = REQUIRED_ENV_VARS.filter((envVar) => !process.env[envVar]);

  if (missing.length === 0) {
    return { status: "up" };
  }

  console.error("[Health] Missing required environment variables:", missing);
  return { status: "down", error: ENVIRONMENT_CHECK_FAILED };
}

function determineOverallStatus(
  checks: HealthResponse["checks"]
): HealthResponse["status"] {
  const dbDown = checks.database.status === "down";
  const envDown = checks.environment.status === "down";
  const redisDown = checks.redis.status === "down";

  if (dbDown || envDown) {
    return "unhealthy";
  }

  if (redisDown) {
    return "degraded";
  }

  return "healthy";
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const environment = checkEnvironment();

  const rateLimiting: RateLimitingCheck = { enabled: isRateLimitingEnabled() };

  const checks = { database, redis, environment, rateLimiting };
  const status = determineOverallStatus(checks);

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? "3.1.0",
    checks,
  };

  return Response.json(response, {
    status: status === "unhealthy" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
