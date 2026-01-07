import { sql } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { getUpstashClient, isUpstashConfigured } from "@/lib/redis";

type CheckStatus = "up" | "down";

interface HealthCheck {
  status: CheckStatus;
  latency?: number;
  error?: string;
  configured?: string[];
  missing?: string[];
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    environment: HealthCheck;
  };
}

const REQUIRED_ENV_VARS = ["POSTGRES_URL"];
const OPTIONAL_ENV_VARS = [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "REDIS_URL",
  "AUTH_SECRET",
];

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { status: "up", latency: Date.now() - start };
  } catch (error) {
    return {
      status: "down",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
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
    return {
      status: "down",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function checkEnvironment(): HealthCheck {
  const configured: string[] = [];
  const missing: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (process.env[envVar]) {
      configured.push(envVar);
    } else {
      missing.push(envVar);
    }
  }

  for (const envVar of OPTIONAL_ENV_VARS) {
    if (process.env[envVar]) {
      configured.push(envVar);
    }
  }

  return {
    status: missing.length === 0 ? "up" : "down",
    configured,
    missing: missing.length > 0 ? missing : undefined,
  };
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

  const checks = { database, redis, environment };
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
